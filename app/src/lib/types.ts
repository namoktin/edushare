// Kiểu dữ liệu dùng chung cho EduShare

export type Role = 'learner' | 'admin';

export interface PeerInfo {
  peerId: string;
  name: string;
  role: Role;
  resources: string[];
  joinedAt?: number;
  /** Trạng thái kết nối DataChannel thực tế (phía client). */
  connected?: boolean;
  /** Số hop để tới peer này (0 = trực tiếp). */
  hops?: number;
  lastSeen?: number;
}

export type ResourceAvailability = 'local' | 'network' | 'unknown';

export interface ResourceMeta {
  resourceId: string; // sha256 của nội dung (content-addressed)
  title: string;
  subject: string;
  grade: string;
  tags: string[];
  size: number; // bytes
  mime: string;
  chunkSize: number;
  chunkCount: number;
  /** checksum tổng (sha256 hex) của toàn file */
  checksum: string;
  /** Merkle root của các chunk (sha256 hex) */
  merkleRoot: string;
  ownerId: string; // peer phát hành đầu tiên
  ownerName: string;
  createdAt: number;
  version: number;
  /** HMAC-SHA256(metadata không gồm signature) bởi Admin Node */
  signature?: string;
  availability?: ResourceAvailability;
  /** Nguồn đang giữ bản sao (cập nhật qua gossip). */
  holders?: string[];
}

export interface ChunkRecord {
  resourceId: string;
  index: number;
  blob: Blob;
  size: number;
  receivedAt: number;
}

export interface TransferJob {
  id: string;
  resourceId: string;
  direction: 'download' | 'upload';
  peerId: string;
  peerName: string;
  title: string;
  totalBytes: number;
  transferredBytes: number;
  totalChunks: number;
  receivedChunks: number;
  status: 'queued' | 'connecting' | 'active' | 'paused' | 'verifying' | 'done' | 'error';
  speed: number; // MB/s
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export interface SyncItem {
  id?: number;
  kind: 'stats' | 'advertise' | 'withdraw';
  payload: unknown;
  createdAt: number;
  tries: number;
}

export interface StatEntry {
  id?: number;
  resourceId?: string;
  event: string;
  value: number;
  at: number;
}

export interface GossipEntry {
  resourceId: string;
  holders: Map<string, number>; // peerId -> lastSeen
  version: number;
  checksum: string;
  merkleRoot: string;
  ttl: number;
}
