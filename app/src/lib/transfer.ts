// File transfer P2P: chia nhỏ thành chunk 256KB, truyền qua DataChannel
// reliable, kiểm chứng SHA-256/Merkle, hỗ trợ resume & backpressure.

import { Emitter } from './emitter';
import { Protocol, CHUNK_SIZE } from './protocol';
import type { PeerMessage } from './protocol';
import type { PeerManager } from './peer';
import type { ResourceMeta, TransferJob } from './types';
import {
  assembleBlob,
  countChunks,
  db,
  getChunk,
  logStat,
  putChunk,
  putResource,
  putTransfer,
  receivedChunkIndexes
} from './db';
import { merkleRoot, sha256 } from './crypto';

export interface TransferEvents {
  update: TransferJob;
  'publish-done': { resourceId: string };
  'download-done': { resourceId: string };
  error: { transferId: string; message: string };
}

interface PublishInput {
  file: File;
  title: string;
  subject: string;
  grade: string;
  tags?: string[];
  ownerId: string;
  ownerName: string;
  signature?: string;
}

interface ActiveDownload {
  job: TransferJob;
  meta: ResourceMeta;
  candidates: string[];
  nextIndex: number;
  missing: number[];
  lastBytes: number;
  lastTime: number;
  paused: boolean;
  inflight: Set<number>;
  requestTimes: Map<number, number>;
}

export class TransferManager extends Emitter<TransferEvents> {
  private active = new Map<string, ActiveDownload>();

  constructor(
    private peers: PeerManager,
    private localId: string = 'local'
  ) {
    super();
    this.peers.on('message', ({ peerId, msg }) => this.onMessage(peerId, msg));
    this.persistActiveJobs();
  }

  private persistActiveJobs(): void {
    // Đánh dấu các job dở dang từ phiên trước là 'paused' (resume thủ công).
    void (async () => {
      const jobs = await db.transfers.where('status').anyOf('active', 'connecting', 'queued').toArray();
      for (const j of jobs) {
        if (j.direction === 'download') {
          j.status = 'paused';
          await putTransfer(j);
        }
      }
    })();
  }

  // -------------------- PUBLISH (chia sẻ file lên mạng) --------------------

  async publish(input: PublishInput): Promise<ResourceMeta> {
    const { file } = input;
    const chunkCount = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const hashes: string[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
      const hash = await sha256(blob);
      hashes.push(hash);
      await putChunk({ resourceId: '__pending__', index: i, blob, size: blob.size, receivedAt: Date.now() });
    }

    // content-addressed id = sha256 toàn file
    const fullHash = await sha256(await file.arrayBuffer());
    const root = merkleRoot(hashes);

    const meta: ResourceMeta = {
      resourceId: fullHash,
      title: input.title || file.name,
      subject: input.subject || 'Khác',
      grade: input.grade || 'Chung',
      tags: input.tags ?? [],
      size: file.size,
      mime: file.type || 'application/octet-stream',
      chunkSize: CHUNK_SIZE,
      chunkCount,
      checksum: fullHash,
      merkleRoot: root,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      createdAt: Date.now(),
      version: 1,
      signature: input.signature
    };

    // Chuyển các chunk tạm sang đúng resourceId.
    await db.transaction('rw', db.chunks, async () => {
      const pending = await db.chunks.where('resourceId').equals('__pending__').toArray();
      for (const rec of pending) {
        await db.chunks.put({ ...rec, resourceId: meta.resourceId });
      }
    });

    meta.availability = 'local';
    await putResource(meta);
    await logStat({ resourceId: meta.resourceId, event: 'publish', value: file.size, at: Date.now() });
    this.emit('publish-done', { resourceId: meta.resourceId });
    return meta;
  }

  // -------------------- SERVE (phục vụ peer khác) --------------------

  private async onMessage(peerId: string, msg: PeerMessage): Promise<void> {
    switch (msg.type) {
      case 'CHUNK_REQUEST':
        await this.serveChunk(peerId, msg.transferId, msg.resourceId, msg.index);
        break;
      case 'CHUNK_DATA':
        await this.onChunkData(peerId, msg);
        break;
      case 'TRANSFER_COMPLETE':
        break;
      default:
        break;
    }
  }

  private async serveChunk(
    peerId: string,
    transferId: string,
    resourceId: string,
    index: number
  ): Promise<void> {
    const rec = await getChunk(resourceId, index);
    if (!rec) return;
    const meta = await db.resources.get(resourceId);
    const total = meta?.chunkCount ?? 1;
    const buf = await rec.blob.arrayBuffer();
    await this.peers.waitForDrain(peerId);
    this.peers.send(peerId, Protocol.chunkData(transferId, resourceId, index, total, buf));
  }

  // -------------------- DOWNLOAD --------------------

  /** Bắt đầu (hoặc tiếp tục) tải một tài nguyên từ danh sách peer nguồn. */
  async download(meta: ResourceMeta, candidates: string[]): Promise<TransferJob> {
    const transferId = `dl-${meta.resourceId.slice(0, 8)}-${Date.now().toString(36)}`;

    const existing = await db.resources.get(meta.resourceId);

    // Đã có sẵn cục bộ: không tải lại, không hạ cấp trạng thái.
    if (existing?.availability === 'local') {
      const done = emptyJob(transferId, meta, candidates[0] ?? '');
      done.status = 'done';
      done.transferredBytes = meta.size;
      done.receivedChunks = meta.chunkCount;
      await putTransfer(done);
      this.emit('update', done);
      return done;
    }

    // Lưu metadata ở trạng thái "có trên mạng".
    await putResource({ ...meta, availability: 'network' });

    const total = meta.chunkCount;
    const have = new Set(await receivedChunkIndexes(meta.resourceId));
    const missing: number[] = [];
    for (let i = 0; i < total; i++) if (!have.has(i)) missing.push(i);

    const job: TransferJob = {
      id: transferId,
      resourceId: meta.resourceId,
      direction: 'download',
      peerId: candidates[0] ?? '',
      peerName: candidates[0] ?? 'thiết bị trong lớp',
      title: meta.title,
      totalBytes: meta.size,
      transferredBytes: Math.max(0, meta.size - missing.length * meta.chunkSize),
      totalChunks: total,
      receivedChunks: have.size,
      status: 'connecting',
      speed: 0,
      startedAt: Date.now(),
      updatedAt: Date.now()
    };
    await putTransfer(job);
    this.emit('update', job);

    this.active.set(transferId, {
      job,
      meta,
      candidates,
      nextIndex: 0,
      missing,
      lastBytes: job.transferredBytes,
      lastTime: Date.now(),
      paused: false,
      inflight: new Set(),
      requestTimes: new Map()
    });

    this.pump(transferId);
    return job;
  }

  pause(transferId: string): void {
    const a = this.active.get(transferId);
    if (!a) return;
    a.paused = true;
    a.job.status = 'paused';
    a.job.speed = 0;
    void putTransfer(a.job);
    this.emit('update', a.job);
  }

  resume(transferId: string): void {
    const a = this.active.get(transferId);
    if (!a) return;
    a.paused = false;
    a.job.status = 'active';
    void putTransfer(a.job);
    this.emit('update', a.job);
    this.pump(transferId);
  }

  /** Chọn nguồn theo độ trễ thấp nhất + ít kết nối đang tải. */
  private pickSource(a: ActiveDownload): string {
    let best = a.candidates[0];
    let bestScore = Infinity;
    for (const id of a.candidates) {
      if (!this.peers.isOpen(id)) continue;
      const load = [...this.active.values()].filter((x) => x.job.peerId === id && x.job.status === 'active').length;
      const buffered = this.peers.bufferedAmount(id);
      const score = load * 1e6 + buffered;
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }

  /** Gửi yêu cầu cho các chunk còn thiếu, tôn trọng backpressure & cửa sổ song song. */
  private pump(transferId: string): void {
    const a = this.active.get(transferId);
    if (!a || a.paused) return;
    const WINDOW = 4;

    const a_open = a.candidates.find((id) => this.peers.isOpen(id));
    if (!a_open) {
      a.job.status = 'connecting';
      this.emit('update', a.job);
      // Thử lại sau khi kết nối thiết lập.
      setTimeout(() => this.pump(transferId), 800);
      return;
    }
    a.job.status = 'active';

    while (a.inflight.size < WINDOW && a.nextIndex < a.missing.length) {
      const idx = a.missing[a.nextIndex++];
      const source = this.pickSource(a);
      if (this.peers.send(source, Protocol.chunkRequest(a.job.id, a.meta.resourceId, idx))) {
        a.inflight.add(idx);
        a.requestTimes.set(idx, Date.now());
      } else {
        a.nextIndex--; // thử lại sau
        break;
      }
    }
    a.job.peerId = a_open;
    this.updateProgress(a);
  }

  private async onChunkData(peerId: string, msg: Extract<PeerMessage, { type: 'CHUNK_DATA' }>): Promise<void> {
    // Tìm job đang chờ GÓI NÀY (transferId khớp).
    const a = this.active.get(msg.transferId);
    if (!a) return;
    await putChunk({
      resourceId: msg.resourceId,
      index: msg.index,
      blob: new Blob([msg.data]),
      size: msg.data.byteLength,
      receivedAt: Date.now()
    });
    a.inflight.delete(msg.index);
    a.requestTimes.delete(msg.index);
    a.job.receivedChunks += 1;
    a.job.transferredBytes += msg.data.byteLength;

    this.updateProgress(a, peerId);

    if (a.job.receivedChunks >= a.meta.chunkCount) {
      await this.finalizeDownload(a);
    } else {
      this.pump(a.job.id);
    }
  }

  private updateProgress(a: ActiveDownload, peerId?: string): void {
    const now = Date.now();
    const dt = (now - a.lastTime) / 1000;
    if (dt >= 0.5) {
      const dBytes = a.job.transferredBytes - a.lastBytes;
      a.job.speed = dBytes / dt / (1024 * 1024); // MB/s
      a.lastBytes = a.job.transferredBytes;
      a.lastTime = now;
    }
    if (peerId) a.job.peerId = peerId;
    a.job.updatedAt = now;
    void putTransfer(a.job);
    this.emit('update', a.job);
  }

  private async finalizeDownload(a: ActiveDownload): Promise<void> {
    a.job.status = 'verifying';
    this.emit('update', a.job);
    const blob = await assembleBlob(a.meta.resourceId);
    if (!blob) return this.fail(a, 'Không ghép được dữ liệu');
    const checksum = await sha256(blob);
    if (checksum !== a.meta.checksum) {
      return this.fail(a, 'Sai checksum - dữ liệu hỏng');
    }
    // Đánh dấu có sẵn cục bộ.
    await putResource({ ...a.meta, availability: 'local', holders: [this.localId] });
    a.job.status = 'done';
    a.job.speed = 0;
    a.job.updatedAt = Date.now();
    await putTransfer(a.job);
    await logStat({ resourceId: a.meta.resourceId, event: 'download', value: a.meta.size, at: Date.now() });
    this.emit('update', a.job);
    this.emit('download-done', { resourceId: a.meta.resourceId });
    this.active.delete(a.job.id);
  }

  private fail(a: ActiveDownload, message: string): void {
    a.job.status = 'error';
    a.job.error = message;
    a.job.updatedAt = Date.now();
    void putTransfer(a.job);
    this.emit('update', a.job);
    this.emit('error', { transferId: a.job.id, message });
    this.active.delete(a.job.id);
  }
}

function emptyJob(id: string, meta: ResourceMeta, peerId: string): TransferJob {
  return {
    id,
    resourceId: meta.resourceId,
    direction: 'download',
    peerId,
    peerName: peerId,
    title: meta.title,
    totalBytes: meta.size,
    transferredBytes: 0,
    totalChunks: meta.chunkCount,
    receivedChunks: 0,
    status: 'queued',
    speed: 0,
    startedAt: Date.now(),
    updatedAt: Date.now()
  };
}
