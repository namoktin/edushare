// Cơ chế replication theo mức độ phổ biến.
// Mỗi lần một tài nguyên được yêu cầu/tải, tăng bộ đếm "độ phổ biến".
// Khi vượt ngưỡng, peer đang giữ bản sao chủ động quảng bá lại (tăng số bản sao
// trong mạng) và ghi nhận vào stats để phân tích.

import { Emitter } from './emitter';
import type { GossipEngine } from './gossip';
import type { PeerManager } from './peer';
import { allStats, db, logStat } from './db';

export interface ReplicationEvents {
  log: string;
  popularity: Record<string, number>;
}

export class ReplicationManager extends Emitter<ReplicationEvents> {
  private popularity = new Map<string, number>();
  private readonly threshold: number;
  private timer: number | null = null;

  constructor(
    private gossip: GossipEngine,
    private peers: PeerManager,
    threshold = 3
  ) {
    super();
    this.threshold = threshold;
  }

  async load(): Promise<void> {
    const stats = await allStats();
    for (const s of stats) {
      if (s.resourceId && (s.event === 'request' || s.event === 'download')) {
        this.popularity.set(s.resourceId, (this.popularity.get(s.resourceId) ?? 0) + 1);
      }
    }
    this.emitPopularity();
  }

  /** Ghi nhận một yêu cầu tài nguyên (tăng độ phổ biến). */
  async recordRequest(resourceId: string): Promise<void> {
    const n = (this.popularity.get(resourceId) ?? 0) + 1;
    this.popularity.set(resourceId, n);
    await logStat({ resourceId, event: 'request', value: n, at: Date.now() });
    this.emitPopularity();

    if (n === this.threshold) {
      const meta = await db.resources.get(resourceId);
      if (meta) {
        // Tài nguyên "nóng": chủ động quảng bá để nhân bản tới các peer.
        this.gossip.advertise({ ...meta, version: meta.version + 1 });
        this.emit('log', `Tài nguyên "${meta.title}" phổ biến (${n} yêu cầu) - kích hoạt nhân bản`);
      }
    }
  }

  /** Vòng lặp định kỳ: nhân bản các tài nguyên nóng tới peer mới. */
  start(intervalMs = 30000): void {
    if (this.timer) return;
    this.timer = window.setInterval(() => void this.replicateCycle(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async replicateCycle(): Promise<void> {
    const locals = await db.resources.where('availability').equals('local').toArray();
    for (const r of locals) {
      if ((this.popularity.get(r.resourceId) ?? 0) >= this.threshold) {
        this.gossip.advertise(r);
      }
    }
  }

  getPopularity(resourceId: string): number {
    return this.popularity.get(resourceId) ?? 0;
  }

  private emitPopularity(): void {
    this.emit('popularity', Object.fromEntries(this.popularity));
  }
}
