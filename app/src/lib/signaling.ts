// Client WebSocket tới Signaling Server trong LAN.
// Chịu trách nhiệm: vào lớp, nhận danh sách peer, chuyển tiếp SDP/ICE,
// relay metadata (advertise/query) và tự động kết nối lại.

import { Emitter } from './emitter';
import type { PeerInfo, ResourceMeta, Role } from './types';

export interface SignalEnvelope {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface SignalingEvents {
  status: 'connecting' | 'online' | 'offline';
  welcome: { peerId: string; room: string; peers: ServerPeer[] };
  'peer-joined': { peer: ServerPeer };
  'peer-updated': { peer: ServerPeer };
  'peer-left': { peerId: string };
  signal: { from: string; signal: SignalEnvelope };
  advertise: { from: string; resource: ResourceMeta };
  withdraw: { from: string; resourceId: string };
  'resource-query': { from: string; requestId: string; query: string; ttl: number };
  'query-result': {
    requestId: string;
    hits: { owner: string; resource: ResourceMeta }[];
    ttl: number;
  };
  error: { message: string; code?: string };
}

export interface ServerPeer {
  peerId: string;
  name: string;
  role: Role;
  resources: string[];
  joinedAt: number;
}

function defaultUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost:8787';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location.hostname || 'localhost';
  // Ở chế độ dev (Vite 5173) trỏ signaling sang cổng 8787 của máy chủ hiện tại.
  // Khi PWA được phục vụ trực tiếp bởi signaling server thì dùng cùng cổng.
  const port = location.port === '5173' || location.port === '' || location.port === '80' ? '8787' : location.port;
  return `${proto}//${host}:${port}`;
}

export class SignalingClient extends Emitter<SignalingEvents> {
  readonly room: string;
  readonly peerId: string;
  private url: string;
  private ws: WebSocket | null = null;
  private name = 'Thiết bị';
  private role: Role = 'learner';
  private reconnectTimer: number | null = null;
  private attempts = 0;
  private closedByUser = false;

  constructor(opts: { room: string; peerId: string; url?: string; name?: string; role?: Role }) {
    super();
    this.room = opts.room;
    this.peerId = opts.peerId;
    this.url = opts.url || defaultUrl();
    this.name = opts.name || this.name;
    this.role = opts.role || this.role;
  }

  setIdentity(name: string, role: Role): void {
    this.name = name;
    this.role = role;
    if (this.isOpen()) this.ws!.send(JSON.stringify({ type: 'hello', name, role }));
  }

  connect(): void {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))
      return;
    this.emit('status', 'connecting');
    const url = `${this.url}/?room=${encodeURIComponent(this.room)}&peerId=${encodeURIComponent(this.peerId)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.emit('status', 'online');
      ws.send(JSON.stringify({ type: 'hello', name: this.name, role: this.role }));
    };

    ws.onmessage = (ev) => this.handle(ev.data);
    ws.onclose = () => {
      this.emit('status', 'offline');
      this.scheduleReconnect();
    };
    ws.onerror = () => this.emit('error', { message: 'Lỗi kết nối signaling' });
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendSignal(to: string, signal: SignalEnvelope): void {
    this.raw({ type: 'signal', to, signal });
  }

  advertise(resource: ResourceMeta): void {
    this.raw({ type: 'advertise', resource });
  }

  withdraw(resourceId: string): void {
    this.raw({ type: 'withdraw', resourceId });
  }

  query(requestId: string, query: string, ttl = 3): void {
    this.raw({ type: 'query', requestId, query, ttl });
  }

  private raw(obj: unknown): boolean {
    if (!this.isOpen()) return false;
    this.ws!.send(JSON.stringify(obj));
    return true;
  }

  private handle(data: unknown): void {
    let msg: any;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    switch (msg.type) {
      case 'welcome':
        this.emit('welcome', { peerId: msg.peerId, room: msg.room, peers: msg.peers || [] });
        break;
      case 'peer-joined':
        this.emit('peer-joined', { peer: msg.peer });
        break;
      case 'peer-updated':
        this.emit('peer-updated', { peer: msg.peer });
        break;
      case 'peer-left':
        this.emit('peer-left', { peerId: msg.peerId });
        break;
      case 'signal':
        this.emit('signal', { from: msg.from, signal: msg.signal });
        break;
      case 'resource-advertise':
        this.emit('advertise', { from: msg.from, resource: msg.resource });
        break;
      case 'resource-withdraw':
        this.emit('withdraw', { from: msg.from, resourceId: msg.resourceId });
        break;
      case 'resource-query':
        this.emit('resource-query', {
          from: msg.from,
          requestId: msg.requestId,
          query: msg.query,
          ttl: msg.ttl
        });
        break;
      case 'query-result':
        this.emit('query-result', { requestId: msg.requestId, hits: msg.hits || [], ttl: msg.ttl });
        break;
      case 'error':
        this.emit('error', { message: msg.code || 'error', code: msg.code });
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    if (this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts, 5), 15000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export function makePeerId(): string {
  return `peer-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
}

export type { SignalingEvents };
