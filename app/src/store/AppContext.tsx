// Tầng trạng thái ứng dụng: khởi tạo & điều phối toàn bộ manager P2P,
// cung cấp state và hành động cho UI qua React Context.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { PeerInfo, ResourceMeta, Role, TransferJob } from '../lib/types';
import { SignalingClient, makePeerId, type ServerPeer } from '../lib/signaling';
import { PeerManager } from '../lib/peer';
import { GossipEngine } from '../lib/gossip';
import { TransferManager } from '../lib/transfer';
import { ReplicationManager } from '../lib/replication';
import {
  assembleBlob,
  deleteResource,
  getResource,
  listResources,
  listTransfers,
  putResource,
  removePeer,
  logStat
} from '../lib/db';
import { canonicalMetadata, hmacSign, hmacVerify } from '../lib/crypto';

export interface Identity {
  peerId: string;
  name: string;
  role: Role;
  room: string;
  adminKey: string;
}

const IDENTITY_KEY = 'edushare.identity.v1';

export type ConnStatus = 'connecting' | 'online' | 'offline';

interface PublishInput {
  file: File;
  title: string;
  subject: string;
  grade: string;
  tags?: string[];
}

interface AppContextValue {
  ready: boolean;
  identity: Identity | null;
  conn: ConnStatus;
  browserOnline: boolean;
  peers: PeerInfo[];
  catalog: ResourceMeta[];
  transfers: TransferJob[];
  logs: string[];
  popularity: Record<string, number>;
  join: (identity: Omit<Identity, 'peerId'> & { peerId?: string }) => void;
  leave: () => void;
  publish: (input: PublishInput) => Promise<ResourceMeta>;
  removeResource: (resourceId: string) => Promise<void>;
  download: (resourceId: string) => Promise<void>;
  pause: (transferId: string) => void;
  resume: (transferId: string) => void;
  refreshCatalog: () => Promise<void>;
  searchRemote: (q: string) => Promise<void>;
  getLocalBlob: (resourceId: string) => Promise<Blob | null>;
  verifyResource: (resourceId: string) => Promise<boolean | null>;
  isAdmin: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed.peerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<ConnStatus>('offline');
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  );
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [catalog, setCatalog] = useState<ResourceMeta[]>([]);
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [popularity, setPopularity] = useState<Record<string, number>>({});

  const signalingRef = useRef<SignalingClient | null>(null);
  const peersRef = useRef<PeerManager | null>(null);
  const gossipRef = useRef<GossipEngine | null>(null);
  const transferRef = useRef<TransferManager | null>(null);
  const replicationRef = useRef<ReplicationManager | null>(null);

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString('vi-VN')} · ${line}`, ...prev].slice(0, 100));
  }, []);

  const refreshCatalog = useCallback(async () => {
    const all = await listResources();
    setCatalog(all);
  }, []);

  // -------- khởi tạo managers khi có identity --------
  useEffect(() => {
    if (!identity) return;

    const signaling = new SignalingClient({
      room: identity.room,
      peerId: identity.peerId,
      name: identity.name,
      role: identity.role
    });
    const peerMgr = new PeerManager(signaling);
    const gossip = new GossipEngine(signaling, peerMgr, identity.peerId);
    const transfer = new TransferManager(peerMgr, identity.peerId);
    const replication = new ReplicationManager(gossip, peerMgr, 3);

    signalingRef.current = signaling;
    peersRef.current = peerMgr;
    gossipRef.current = gossip;
    transferRef.current = transfer;
    replicationRef.current = replication;

    // --- Signaling events ---
    signaling.on('status', (s) => setConn(s));
    signaling.on('welcome', ({ peers: list }) => {
      const mapped = list.map((p) => fromServerPeer(p));
      setPeers(mapped);
      for (const p of list) {
        if (p.peerId !== identity.peerId) peerMgr.ensure(p.peerId);
      }
    });
    signaling.on('peer-joined', ({ peer }) => {
      setPeers((prev) => mergePeer(prev, fromServerPeer(peer)));
      if (peer.peerId !== identity.peerId) peerMgr.ensure(peer.peerId);
      pushLog(`${peer.name} đã tham gia lớp`);
    });
    signaling.on('peer-updated', ({ peer }) =>
      setPeers((prev) => mergePeer(prev, fromServerPeer(peer)))
    );
    signaling.on('peer-left', ({ peerId }) => {
      setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
      void removePeer(peerId);
    });
    signaling.on('error', ({ message }) => pushLog(`Lỗi mạng: ${message}`));

    // --- PeerManager events ---
    peerMgr.on('peer-open', ({ peerId }) => {
      setPeers((prev) => mergePeer(prev, { peerId, name: peerId, role: 'learner', resources: [], connected: true }));
      pushLog(`Đã kết nối trực tiếp với ${peerId.slice(0, 12)}…`);
    });
    peerMgr.on('peer-close', ({ peerId }) =>
      setPeers((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, connected: false } : p)))
    );

    // --- Gossip events ---
    gossip.on('catalog', (list) => setCatalog(list));
    gossip.on('log', (l) => pushLog(l));

    // --- Transfer events ---
    transfer.on('update', (job) => {
      setTransfers((prev) => {
        const idx = prev.findIndex((t) => t.id === job.id);
        if (idx === -1) return [job, ...prev];
        const copy = [...prev];
        copy[idx] = job;
        return copy;
      });
    });
    transfer.on('download-done', ({ resourceId }) => {
      pushLog(`Tải xong tài nguyên ${resourceId.slice(0, 10)}…`);
      void refreshCatalog();
    });
    transfer.on('publish-done', () => void refreshCatalog());
    transfer.on('error', ({ message }) => pushLog(`Lỗi truyền: ${message}`));

    // --- Replication events ---
    replication.on('popularity', (p) => setPopularity(p));
    replication.on('log', (l) => pushLog(l));

    signaling.connect();
    gossip.start();
    replication.start();
    void replication.load();
    void refreshCatalog();
    void listTransfers().then(setTransfers);

    return () => {
      gossip.stop();
      replication.stop();
      peerMgr.closeAll();
      signaling.disconnect();
      signalingRef.current = null;
      peersRef.current = null;
      gossipRef.current = null;
      transferRef.current = null;
      replicationRef.current = null;
    };
  }, [identity, pushLog, refreshCatalog]);

  // online/offline indicator
  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // -------- auto resume identity --------
  useEffect(() => {
    const id = loadIdentity();
    if (id) {
      setIdentity(id);
      setReady(true);
    } else {
      setReady(true);
    }
  }, []);

  const join = useCallback(
    (input: Omit<Identity, 'peerId'> & { peerId?: string }) => {
      const id: Identity = {
        peerId: input.peerId || makePeerId(),
        name: input.name.trim() || 'Thiết bị',
        role: input.role,
        room: input.room.trim() || 'lop-hoc',
        adminKey: input.adminKey || 'edushare-class-secret'
      };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
      setIdentity(id);
      pushLog(`Đã tham gia lớp "${id.room}" với tên "${id.name}"`);
    },
    [pushLog]
  );

  const leave = useCallback(() => {
    localStorage.removeItem(IDENTITY_KEY);
    signalingRef.current?.disconnect();
    setIdentity(null);
    setPeers([]);
    setConn('offline');
  }, []);

  const publish = useCallback(
    async (input: PublishInput): Promise<ResourceMeta> => {
      const t = transferRef.current;
      if (!t || !identity) throw new Error('Chưa sẵn sàng');
      const meta = await t.publish({
        file: input.file,
        title: input.title || input.file.name,
        subject: input.subject,
        grade: input.grade,
        tags: input.tags,
        ownerId: identity.peerId,
        ownerName: identity.name
      });
      if (identity.role === 'admin') {
        const signature = await hmacSign(
          identity.adminKey,
          canonicalMetadata(meta as unknown as Record<string, unknown>)
        );
        const signed = { ...meta, signature };
        await putResource(signed);
        gossipRef.current?.advertise(signed);
      } else {
        gossipRef.current?.advertise(meta);
      }
      await logStat({ resourceId: meta.resourceId, event: 'publish', value: meta.size, at: Date.now() });
      await refreshCatalog();
      pushLog(`Đã chia sẻ "${meta.title}" vào mạng lớp`);
      return meta;
    },
    [identity, pushLog, refreshCatalog]
  );

  const removeResource = useCallback(
    async (resourceId: string) => {
      await deleteResource(resourceId);
      gossipRef.current?.withdraw(resourceId);
      await refreshCatalog();
      pushLog('Đã gỡ tài nguyên khỏi thiết bị');
    },
    [pushLog, refreshCatalog]
  );

  const download = useCallback(
    async (resourceId: string) => {
      const meta = await getResource(resourceId);
      if (!meta) return;
      const t = transferRef.current;
      if (!t) return;

      // Chọn nguồn: các peer đang kết nối được (ưu tiên) + holders đã biết.
      const openIds = peersRef.current?.openPeers() ?? [];
      const known = meta.holders ?? [];
      const candidates = [...new Set([...openIds, ...known])].filter((id) => id !== identity?.peerId);
      if (candidates.length === 0) {
        pushLog('Chưa tìm thấy thiết bị nào đang giữ tài nguyên này');
        // Hỏi mạng lưới.
        await gossipRef.current?.query(meta.title);
        return;
      }
      await replicationRef.current?.recordRequest(resourceId);
      await t.download(meta, candidates);
      pushLog(`Bắt đầu tải "${meta.title}" từ mạng lớp`);
    },
    [identity, pushLog]
  );

  const pause = useCallback((id: string) => transferRef.current?.pause(id), []);
  const resume = useCallback((id: string) => transferRef.current?.resume(id), []);

  const searchRemote = useCallback(
    async (q: string) => {
      const hits = await gossipRef.current?.query(q);
      if (hits && hits.length) {
        for (const h of hits) {
          const existing = await getResource(h.resource.resourceId);
          if (!existing) await putResource({ ...h.resource, availability: 'network', holders: [h.owner] });
        }
        await refreshCatalog();
      }
    },
    [refreshCatalog]
  );

  const getLocalBlob = useCallback(async (resourceId: string): Promise<Blob | null> => {
    const meta = await getResource(resourceId);
    if (!meta || meta.availability !== 'local') return null;
    return assembleBlob(resourceId);
  }, []);

  const verifyResource = useCallback(async (resourceId: string): Promise<boolean | null> => {
    const meta = await getResource(resourceId);
    if (!meta?.signature) return null;
    const key = loadIdentity()?.adminKey ?? 'edushare-class-secret';
    return hmacVerify(key, canonicalMetadata(meta as unknown as Record<string, unknown>), meta.signature);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      identity,
      conn,
      browserOnline,
      peers,
      catalog,
      transfers,
      logs,
      popularity,
      join,
      leave,
      publish,
      removeResource,
      download,
      pause,
      resume,
      refreshCatalog,
      searchRemote,
      getLocalBlob,
      verifyResource,
      isAdmin: identity?.role === 'admin'
    }),
    [
      ready,
      identity,
      conn,
      browserOnline,
      peers,
      catalog,
      transfers,
      logs,
      popularity,
      join,
      leave,
      publish,
      removeResource,
      download,
      pause,
      resume,
      refreshCatalog,
      searchRemote,
      getLocalBlob,
      verifyResource
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải dùng trong AppProvider');
  return ctx;
}

function fromServerPeer(p: ServerPeer): PeerInfo {
  return {
    peerId: p.peerId,
    name: p.name || p.peerId,
    role: p.role,
    resources: p.resources ?? [],
    connected: false,
    lastSeen: Date.now()
  };
}

function mergePeer(list: PeerInfo[], peer: PeerInfo): PeerInfo[] {
  const idx = list.findIndex((p) => p.peerId === peer.peerId);
  if (idx === -1) return [...list, peer];
  const copy = [...list];
  copy[idx] = { ...copy[idx], ...peer };
  return copy;
}
