// PeerManager: quản lý RTCPeerConnection + RTCDataChannel cho từng peer.
// Kết nối trực tiếp trong LAN (ICE host candidates, không cần STUN khi offline).
// Bên khởi tạo offer được chọn tất định theo thứ tự peerId để tránh "glare".

import { Emitter } from './emitter';
import { BUFFER_HIGH_WATER, BUFFER_LOW_WATER } from './protocol';
import type { PeerMessage } from './protocol';
import type { SignalingClient } from './signaling';

export interface PeerManagerEvents {
  'peer-open': { peerId: string };
  'peer-close': { peerId: string };
  'peer-state': { peerId: string; state: RTCPeerConnectionState };
  message: { peerId: string; msg: PeerMessage };
}

const RTC_CONFIG: RTCConfiguration = {
  // Trong LAN, host candidates đủ để kết nối. Không phụ thuộc STUN/TURN
  // => hoạt động hoàn toàn ngoại tuyến.
  iceServers: [],
  iceCandidatePoolSize: 0
};

const DATA_CHANNEL_LABEL = 'edushare';

export class PeerManager extends Emitter<PeerManagerEvents> {
  private peers = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private readonly localId: string;

  constructor(private signaling: SignalingClient) {
    super();
    this.localId = signaling.peerId;
    this.signaling.on('signal', ({ from, signal }) => this.onSignal(from, signal));
    this.signaling.on('peer-left', ({ peerId }) => this.close(peerId));
  }

  /** Chủ động thiết lập kết nối tới một peer (nếu chưa có). */
  ensure(peerId: string): void {
    if (peerId === this.localId) return;
    if (this.peers.has(peerId)) return;
    // Chỉ bên có peerId nhỏ hơn chủ động tạo offer.
    if (this.localId < peerId) {
      this.createOfferer(peerId);
    } else {
      // Bên kia sẽ gửi offer; tạo sẵn PC để nhận.
      this.createAnswerer(peerId);
    }
  }

  isOpen(peerId: string): boolean {
    return this.channels.get(peerId)?.readyState === 'open';
  }

  openPeers(): string[] {
    return [...this.channels.entries()].filter(([, c]) => c.readyState === 'open').map(([id]) => id);
  }

  send(peerId: string, msg: PeerMessage): boolean {
    const ch = this.channels.get(peerId);
    if (!ch || ch.readyState !== 'open') return false;
    try {
      ch.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.warn('send failed', peerId, e);
      return false;
    }
  }

  broadcast(msg: PeerMessage, peerIds?: string[]): number {
    const targets = peerIds ?? this.openPeers();
    let n = 0;
    for (const id of targets) if (this.send(id, msg)) n++;
    return n;
  }

  bufferedAmount(peerId: string): number {
    return this.channels.get(peerId)?.bufferedAmount ?? 0;
  }

  /** Chờ tới khi bộ đệm gửi xuống dưới ngưỡng (backpressure). */
  async waitForDrain(peerId: string): Promise<void> {
    const ch = this.channels.get(peerId);
    if (!ch) throw new Error('no channel');
    if (ch.bufferedAmount < BUFFER_HIGH_WATER) return;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!this.channels.has(peerId) || ch.readyState !== 'open') return resolve();
        if (ch.bufferedAmount <= BUFFER_LOW_WATER) {
          ch.removeEventListener('bufferedamountlow', check);
          resolve();
        }
      };
      ch.bufferedAmountLowThreshold = BUFFER_LOW_WATER;
      ch.addEventListener('bufferedamountlow', check);
      // Dự phòng: kiểm tra định kỳ nếu sự kiện không bắn.
      const timer = setInterval(() => {
        if (!this.channels.has(peerId) || ch.readyState !== 'open' || ch.bufferedAmount <= BUFFER_LOW_WATER) {
          clearInterval(timer);
          check();
        }
      }, 100);
    });
  }

  close(peerId: string): void {
    this.channels.get(peerId)?.close();
    this.channels.delete(peerId);
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
    this.pendingCandidates.delete(peerId);
    this.emit('peer-close', { peerId });
  }

  closeAll(): void {
    for (const id of [...this.peers.keys()]) this.close(id);
  }

  // -------------------- nội bộ --------------------

  private newConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.signaling.sendSignal(peerId, { candidate: ev.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      this.emit('peer-state', { peerId, state: pc.connectionState });
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        this.emit('peer-close', { peerId });
      }
    };
    return pc;
  }

  private wireChannel(peerId: string, ch: RTCDataChannel): void {
    ch.binaryType = 'arraybuffer';
    ch.bufferedAmountLowThreshold = BUFFER_LOW_WATER;
    this.channels.set(peerId, ch);

    ch.onopen = () => this.emit('peer-open', { peerId });
    ch.onclose = () => {
      this.channels.delete(peerId);
      this.emit('peer-close', { peerId });
    };
    ch.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data) as PeerMessage;
        this.emit('message', { peerId, msg });
      } catch {
        /* bỏ qua gói hỏng */
      }
    };
  }

  private async createOfferer(peerId: string): Promise<void> {
    const pc = this.newConnection(peerId);
    const ch = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
    this.wireChannel(peerId, ch);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.sendSignal(peerId, { sdp: pc.localDescription! });
  }

  private async createAnswerer(peerId: string): Promise<void> {
    const pc = this.newConnection(peerId);
    pc.ondatachannel = (ev) => this.wireChannel(peerId, ev.channel);
  }

  private async onSignal(from: string, signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
    let pc = this.peers.get(from);
    try {
      if (signal.sdp) {
        if (signal.sdp.type === 'offer') {
          if (!pc) pc = this.createAnswererAndGet(from);
          await pc.setRemoteDescription(signal.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signaling.sendSignal(from, { sdp: pc.localDescription! });
          await this.flushCandidates(from, pc);
        } else if (signal.sdp.type === 'answer') {
          if (!pc) return;
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(signal.sdp);
            await this.flushCandidates(from, pc);
          }
        }
      } else if (signal.candidate) {
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate);
        } else {
          (this.pendingCandidates.get(from) ?? this.pendingCandidates.set(from, []).get(from)!).push(
            signal.candidate
          );
        }
      }
    } catch (e) {
      console.warn('signal error', from, e);
    }
  }

  private createAnswererAndGet(peerId: string): RTCPeerConnection {
    const pc = this.peers.get(peerId) ?? this.createAnswererSync(peerId);
    return pc;
  }

  private createAnswererSync(peerId: string): RTCPeerConnection {
    const pc = this.newConnection(peerId);
    pc.ondatachannel = (ev) => this.wireChannel(peerId, ev.channel);
    return pc;
  }

  private async flushCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const list = this.pendingCandidates.get(peerId);
    if (!list) return;
    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
    this.pendingCandidates.delete(peerId);
  }
}
