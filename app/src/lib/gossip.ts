// Gossip engine: lan truyền metadata tài nguyên qua nhiều hop (TTL),
// truy vấn tìm nguồn và hợp nhất danh mục. Chạy cả trên WebSocket (LAN server)
// lẫn DataChannel (P2P trực tiếp) để không phụ thuộc máy chủ.

import { Emitter } from './emitter';
import { Protocol, DEFAULT_TTL } from './protocol';
import type { PeerMessage } from './protocol';
import type { PeerManager } from './peer';
import type { SignalingClient } from './signaling';
import type { ResourceMeta } from './types';
import { db, putResource } from './db';

export interface GossipEvents {
  catalog: ResourceMeta[];
  hits: { owner: string; resource: ResourceMeta }[];
  log: string;
}

export class GossipEngine extends Emitter<GossipEvents> {
  /** resourceId -> last known version (chống loop / cập nhật cũ). */
  private seen = new Map<string, number>();
  private timer: number | null = null;
  private pendingQueries = new Map<string, { resolve: (hits: GossipHits) => void; timer: number }>();

  constructor(
    private signaling: SignalingClient,
    private peers: PeerManager,
    private localId: string
  ) {
    super();

    this.signaling.on('advertise', ({ from, resource }) => this.ingest(resource, from));
    this.signaling.on('query-result', ({ requestId, hits }) => this.resolveQuery(requestId, hits));
    this.signaling.on('resource-query', ({ from, requestId, query, ttl }) =>
      this.answerQuery(from, requestId, query, ttl, 'ws')
    );
    this.signaling.on('withdraw', ({ resourceId }) => this.markUnknown(resourceId));

    this.peers.on('message', ({ peerId, msg }) => this.onMessage(peerId, msg));
  }

  start(intervalMs = 20000): void {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.gossipCycle(), intervalMs);
    window.setTimeout(() => this.gossipCycle(), 1500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Quảng bá metadata một tài nguyên ngay lập tức. */
  advertise(resource: ResourceMeta): void {
    this.seen.set(resource.resourceId, resource.version);
    this.signaling.advertise(resource);
    this.peers.broadcast(Protocol.advertise(resource, DEFAULT_TTL));
    this.emit('log', `Đã quảng bá: ${resource.title}`);
  }

  withdraw(resourceId: string): void {
    this.signaling.withdraw(resourceId);
    this.seen.set(resourceId, Infinity);
  }

  /** Truy vấn tài nguyên trên toàn mạng lưới (WS + P2P), gom kết quả trong timeout. */
  query(q: string, timeoutMs = 2500): Promise<GossipHits> {
    const requestId = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return new Promise<GossipHits>((resolve) => {
      const hits: GossipHits = [];
      const merge = (h: GossipHits) => {
        for (const item of h) if (!hits.some((x) => x.resource.resourceId === item.resource.resourceId)) hits.push(item);
      };
      const timer = window.setTimeout(() => {
        this.pendingQueries.delete(requestId);
        resolve(hits);
      }, timeoutMs);
      this.pendingQueries.set(requestId, {
        resolve: (h) => merge(h),
        timer
      });

      // Nguồn cục bộ trả lời ngay.
      void this.localHits(q).then(merge);

      this.signaling.query(requestId, q, DEFAULT_TTL);
      this.peers.broadcast(Protocol.query(requestId, q, DEFAULT_TTL));
    });
  }

  private resolveQuery(requestId: string, hits: GossipHits): void {
    const p = this.pendingQueries.get(requestId);
    if (p) p.resolve(hits);
  }

  /** Trả lời truy vấn bằng tài nguyên cục bộ + chuyển tiếp nếu còn TTL. */
  private async answerQuery(
    from: string,
    requestId: string,
    query: string,
    ttl: number,
    via: 'ws' | 'p2p'
  ): Promise<void> {
    const hits = await this.localHits(query);
    if (hits.length > 0) {
      if (via === 'ws') {
        // Server gom sẵn; ở client P2P gửi trực tiếp cho người hỏi.
      } else {
        this.peers.send(from, Protocol.response(requestId, hits));
      }
    }
    if (ttl > 0 && via === 'p2p') {
      // Flooding có giới hạn hop: chuyển tiếp tới các peer khác.
      const fwd = Protocol.query(requestId, query, ttl - 1);
      for (const id of this.peers.openPeers()) {
        if (id !== from) this.peers.send(id, fwd);
      }
    }
  }

  private async localHits(q: string): Promise<GossipHits> {
    const all = await db.resources.toArray();
    const needle = q.trim().toLowerCase();
    return all
      .filter(
        (r) =>
          !needle ||
          r.title.toLowerCase().includes(needle) ||
          r.subject.toLowerCase().includes(needle) ||
          r.grade.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.toLowerCase().includes(needle))
      )
      .map((r) => ({ owner: this.localId, resource: r }));
  }

  private onMessage(peerId: string, msg: PeerMessage): void {
    switch (msg.type) {
      case 'RESOURCE_ADVERTISE':
        this.ingest(msg.resource, peerId);
        if (msg.ttl > 0) {
          const fwd = Protocol.advertise(msg.resource, msg.ttl - 1);
          this.peers.broadcast(fwd, this.peers.openPeers().filter((id) => id !== peerId));
        }
        break;
      case 'RESOURCE_QUERY':
        void this.answerQuery(peerId, msg.requestId, msg.query, msg.ttl, 'p2p');
        break;
      case 'RESOURCE_RESPONSE': {
        const p = this.pendingQueries.get(msg.requestId);
        if (p) p.resolve(msg.hits);
        // Hợp nhất metadata trả về.
        for (const h of msg.hits) this.ingest(h.resource, h.owner);
        break;
      }
      default:
        break;
    }
  }

  /** Hợp nhất metadata mới, chỉ nhận nếu version >= bản đã biết. */
  private async ingest(resource: ResourceMeta, from: string): Promise<void> {
    const knownVersion = this.seen.get(resource.resourceId) ?? -1;
    if (resource.version < knownVersion) return;
    this.seen.set(resource.resourceId, resource.version);

    const existing = await db.resources.get(resource.resourceId);
    if (!existing) {
      await putResource({ ...resource, availability: 'network', holders: [from] });
    } else if (existing.availability !== 'local') {
      const holders = new Set(existing.holders ?? []);
      holders.add(from);
      await putResource({ ...resource, availability: 'network', holders: [...holders] });
    }
    await this.emitCatalog();
  }

  private async markUnknown(resourceId: string): Promise<void> {
    const existing = await db.resources.get(resourceId);
    if (existing && existing.availability === 'network') {
      await putResource({ ...existing, availability: 'unknown' });
      await this.emitCatalog();
    }
  }

  private async gossipCycle(): Promise<void> {
    const locals = await db.resources.where('availability').equals('local').toArray();
    for (const r of locals) {
      const adv = Protocol.advertise(r, DEFAULT_TTL);
      this.peers.broadcast(adv);
      this.signaling.advertise(r);
    }
  }

  async emitCatalog(): Promise<void> {
    const all = await db.resources.toArray();
    this.emit('catalog', all);
  }
}

type GossipHits = { owner: string; resource: ResourceMeta }[];
