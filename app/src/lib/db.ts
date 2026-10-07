// Tầng lưu trữ cục bộ (IndexedDB qua Dexie.js)
// Schema: resources, chunks, peers, sync_queue, stats, transfers

import Dexie, { type Table } from 'dexie';
import type {
  ResourceMeta,
  ChunkRecord,
  PeerInfo,
  SyncItem,
  StatEntry,
  TransferJob
} from './types';

export class EduShareDB extends Dexie {
  resources!: Table<ResourceMeta, string>;
  chunks!: Table<ChunkRecord, [string, number]>;
  peers!: Table<PeerInfo, string>;
  sync_queue!: Table<SyncItem, number>;
  stats!: Table<StatEntry, number>;
  transfers!: Table<TransferJob, string>;

  constructor() {
    super('edushare');
    this.version(1).stores({
      resources: 'resourceId, title, subject, grade, createdAt, ownerId, availability',
      chunks: '[resourceId+index], resourceId',
      peers: 'peerId, name, role, lastSeen',
      sync_queue: '++id, kind, createdAt',
      stats: '++id, resourceId, event, at',
      transfers: 'id, resourceId, direction, status, updatedAt'
    });
  }
}

export const db = new EduShareDB();

// ---------------- Resources ----------------

export async function putResource(meta: ResourceMeta): Promise<void> {
  await db.resources.put(meta);
}

export async function getResource(resourceId: string): Promise<ResourceMeta | undefined> {
  return db.resources.get(resourceId);
}

export async function listResources(): Promise<ResourceMeta[]> {
  return db.resources.orderBy('createdAt').reverse().toArray();
}

export async function hasResource(resourceId: string): Promise<boolean> {
  return (await db.resources.get(resourceId)) !== undefined;
}

export async function deleteResource(resourceId: string): Promise<void> {
  await db.transaction('rw', db.resources, db.chunks, async () => {
    await db.chunks.where('resourceId').equals(resourceId).delete();
    await db.resources.delete(resourceId);
  });
}

export async function searchResources(q: string): Promise<ResourceMeta[]> {
  const all = await db.resources.toArray();
  const needle = q.trim().toLowerCase();
  if (!needle) return all;
  return all.filter(
    (r) =>
      r.title.toLowerCase().includes(needle) ||
      r.subject.toLowerCase().includes(needle) ||
      r.grade.toLowerCase().includes(needle) ||
      r.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

// ---------------- Chunks ----------------

export async function putChunk(rec: ChunkRecord): Promise<void> {
  await db.chunks.put(rec);
}

export async function getChunk(resourceId: string, index: number): Promise<ChunkRecord | undefined> {
  return db.chunks.get([resourceId, index]);
}

export async function receivedChunkIndexes(resourceId: string): Promise<number[]> {
  const rows = await db.chunks.where('resourceId').equals(resourceId).toArray();
  return rows.map((r) => r.index).sort((a, b) => a - b);
}

export async function countChunks(resourceId: string): Promise<number> {
  return db.chunks.where('resourceId').equals(resourceId).count();
}

/** Ghép các chunk đã nhận thành Blob hoàn chỉnh (theo đúng thứ tự). */
export async function assembleBlob(resourceId: string): Promise<Blob | null> {
  const rows = await db.chunks.where('resourceId').equals(resourceId).toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.index - b.index);
  return new Blob(rows.map((r) => r.blob));
}

// ---------------- Peers ----------------

export async function upsertPeer(peer: PeerInfo): Promise<void> {
  const existing = await db.peers.get(peer.peerId);
  await db.peers.put({ ...existing, ...peer, lastSeen: Date.now() });
}

export async function listPeers(): Promise<PeerInfo[]> {
  return db.peers.toArray();
}

export async function removePeer(peerId: string): Promise<void> {
  await db.peers.delete(peerId);
}

// ---------------- Sync queue (Background Sync) ----------------

export async function enqueueSync(item: Omit<SyncItem, 'id'>): Promise<number> {
  return db.sync_queue.add(item as SyncItem);
}

export async function pendingSync(): Promise<SyncItem[]> {
  return db.sync_queue.orderBy('createdAt').toArray();
}

export async function dequeueSync(id: number): Promise<void> {
  await db.sync_queue.delete(id);
}

// ---------------- Stats ----------------

export async function logStat(entry: Omit<StatEntry, 'id'>): Promise<number> {
  return db.stats.add(entry as StatEntry);
}

export async function allStats(): Promise<StatEntry[]> {
  return db.stats.toArray();
}

// ---------------- Transfers ----------------

export async function putTransfer(job: TransferJob): Promise<void> {
  await db.transfers.put(job);
}

export async function listTransfers(): Promise<TransferJob[]> {
  const jobs = await db.transfers.orderBy('updatedAt').reverse().toArray();
  // Không giữ lại job đã xong quá lâu trong bộ nhớ UI (vẫn nằm trong DB)
  return jobs;
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfers.delete(id);
}
