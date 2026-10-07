// Định nghĩa giao thức tin nhắn P2P của EduShare (JSON qua DataChannel/WebSocket)
// Tương ứng mục 3.4.2 trong báo cáo.

import type { ResourceMeta } from './types';

export const PROTOCOL_VERSION = 1;
export const CHUNK_SIZE = 256 * 1024; // 256 KB
export const DEFAULT_TTL = 3;
export const BUFFER_HIGH_WATER = 8 * 1024 * 1024; // 8 MB - ngưỡng backpressure
export const BUFFER_LOW_WATER = 1 * 1024 * 1024; // 1 MB

export type MessageType =
  | 'HELLO'
  | 'PEER_LIST'
  | 'RESOURCE_ADVERTISE'
  | 'RESOURCE_QUERY'
  | 'RESOURCE_RESPONSE'
  | 'CHUNK_REQUEST'
  | 'CHUNK_DATA'
  | 'TRANSFER_COMPLETE'
  | 'VERIFY';

interface Base {
  v: number;
  id: string;
  ts: number;
}

export interface HelloMsg extends Base {
  type: 'HELLO';
  peerId: string;
  name: string;
  role: 'learner' | 'admin';
}

export interface PeerListMsg extends Base {
  type: 'PEER_LIST';
  peers: { peerId: string; name: string }[];
}

export interface AdvertiseMsg extends Base {
  type: 'RESOURCE_ADVERTISE';
  resource: ResourceMeta;
  ttl: number;
}

export interface QueryMsg extends Base {
  type: 'RESOURCE_QUERY';
  requestId: string;
  query: string;
  ttl: number;
}

export interface ResponseMsg extends Base {
  type: 'RESOURCE_RESPONSE';
  requestId: string;
  hits: { owner: string; resource: ResourceMeta }[];
}

export interface ChunkRequestMsg extends Base {
  type: 'CHUNK_REQUEST';
  transferId: string;
  resourceId: string;
  index: number;
}

export interface ChunkDataMsg extends Base {
  type: 'CHUNK_DATA';
  transferId: string;
  resourceId: string;
  index: number;
  total: number;
  data: ArrayBuffer;
}

export interface CompleteMsg extends Base {
  type: 'TRANSFER_COMPLETE';
  transferId: string;
  resourceId: string;
  checksum: string;
}

export interface VerifyMsg extends Base {
  type: 'VERIFY';
  requestId: string;
  ok: boolean;
  checksum?: string;
}

export type PeerMessage =
  | HelloMsg
  | PeerListMsg
  | AdvertiseMsg
  | QueryMsg
  | ResponseMsg
  | ChunkRequestMsg
  | ChunkDataMsg
  | CompleteMsg
  | VerifyMsg;

let counter = 0;
export function msgId(): string {
  return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function base<T extends MessageType>(type: T): { v: number; id: string; ts: number; type: T } {
  return { v: PROTOCOL_VERSION, id: msgId(), ts: Date.now(), type };
}

export const Protocol = {
  hello(peerId: string, name: string, role: 'learner' | 'admin'): HelloMsg {
    return { ...base('HELLO'), peerId, name, role };
  },
  peerList(peers: { peerId: string; name: string }[]): PeerListMsg {
    return { ...base('PEER_LIST'), peers };
  },
  advertise(resource: ResourceMeta, ttl = DEFAULT_TTL): AdvertiseMsg {
    return { ...base('RESOURCE_ADVERTISE'), resource, ttl };
  },
  query(requestId: string, query: string, ttl = DEFAULT_TTL): QueryMsg {
    return { ...base('RESOURCE_QUERY'), requestId, query, ttl };
  },
  response(requestId: string, hits: { owner: string; resource: ResourceMeta }[]): ResponseMsg {
    return { ...base('RESOURCE_RESPONSE'), requestId, hits };
  },
  chunkRequest(transferId: string, resourceId: string, index: number): ChunkRequestMsg {
    return { ...base('CHUNK_REQUEST'), transferId, resourceId, index };
  },
  chunkData(
    transferId: string,
    resourceId: string,
    index: number,
    total: number,
    data: ArrayBuffer
  ): ChunkDataMsg {
    return { ...base('CHUNK_DATA'), transferId, resourceId, index, total, data };
  },
  complete(transferId: string, resourceId: string, checksum: string): CompleteMsg {
    return { ...base('TRANSFER_COMPLETE'), transferId, resourceId, checksum };
  },
  verify(requestId: string, ok: boolean, checksum?: string): VerifyMsg {
    return { ...base('VERIFY'), requestId, ok, checksum };
  }
};

/** Kiểm tra nông một gói tin đến có hợp lệ không. */
export function isValidMessage(x: unknown): x is PeerMessage {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as { type?: unknown }).type === 'string' &&
    typeof (x as { id?: unknown }).id === 'string'
  );
}
