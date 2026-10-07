'use strict';

/**
 * EduShare - Signaling Server (LAN)
 * ------------------------------------------------------------------
 * Vai trò: trung gian trao đổi SDP/ICE cho WebRTC + relay metadata
 * (gossip) trong cùng một lớp (room). KHÔNG lưu trữ nội dung tài nguyên.
 *
 * - Chạy trên máy giáo viên (Admin Node) hoặc bất kỳ máy nào trong LAN.
 * - Đồng thời phục vụ bản build tĩnh của PWA nếu thư mục ../app/dist tồn tại,
 *   để học sinh truy cập bằng http://<IP-LAN>:8080.
 *
 * Phụ thuộc: ws (WebSocket). Không cần database, không cần Nginx/Apache.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const HOST = process.env.HOST || '0.0.0.0';
const APP_DIR = path.resolve(__dirname, '..', 'app', 'dist');
const HEARTBEAT_INTERVAL = 15000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

/** @type {Map<string, Room>} roomId -> Room */
const rooms = new Map();

class Room {
  constructor(id) {
    this.id = id;
    /** @type {Map<string, Client>} peerId -> Client */
    this.clients = new Map();
  }
  add(client) {
    this.clients.set(client.peerId, client);
  }
  remove(peerId) {
    this.clients.delete(peerId);
  }
  /** Danh sách peer công khai (không lộ socket). */
  publicPeers() {
    return [...this.clients.values()].map((c) => ({
      peerId: c.peerId,
      name: c.name,
      role: c.role,
      resources: [...c.resources.keys()],
      joinedAt: c.joinedAt,
    }));
  }
  broadcast(message, exceptPeerId) {
    const raw = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.peerId === exceptPeerId) continue;
      if (client.ws.readyState === client.ws.OPEN) client.ws.send(raw);
    }
  }
  sendTo(peerId, message) {
    const client = this.clients.get(peerId);
    if (client && client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  getRoom() {
    return this;
  }
}

class Client {
  constructor(ws, peerId, roomId) {
    this.ws = ws;
    this.peerId = peerId;
    this.roomId = roomId;
    this.name = peerId;
    this.role = 'learner';
    this.joinedAt = Date.now();
    this.alive = true;
    /** @type {Map<string, object>} resourceId -> metadata (chỉ metadata, không phải file) */
    this.resources = new Map();
  }
}

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId);
    rooms.set(roomId, room);
  }
  return room;
}

function safeParse(data) {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTTP: phục vụ PWA tĩnh + endpoint khám phá
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        port: PORT,
        rooms: rooms.size,
        up: process.uptime(),
        time: new Date().toISOString(),
      })
    );
    return;
  }

  if (url.pathname === '/peers') {
    const roomId = url.searchParams.get('room') || 'default';
    const room = rooms.get(roomId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ room: roomId, peers: room ? room.publicPeers() : [] }));
    return;
  }

  // Phục vụ file tĩnh của PWA (nếu đã build)
  serveStatic(url.pathname, res);
});

function serveStatic(pathname, res) {
  if (!fs.existsSync(APP_DIR)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<h1>EduShare Signaling Server</h1>' +
        '<p>Đang chạy. Chưa tìm thấy bản build PWA tại <code>../app/dist</code>.</p>' +
        '<p>Chạy <code>npm run build</code> trong thư mục <code>app/</code> để phục vụ giao diện.</p>' +
        '<p>Health: <a href="/health">/health</a> · Peers: <a href="/peers">/peers</a></p>'
    );
    return;
  }
  let filePath = path.join(APP_DIR, decodeURIComponent(pathname));
  if (pathname === '/' || !path.extname(filePath)) filePath = path.join(APP_DIR, 'index.html');

  // Chống path traversal
  if (!filePath.startsWith(APP_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(APP_DIR, 'index.html'), (e2, index) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(index);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------------------------------------------------------------------------
// WebSocket: signaling + relay
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  const peerId = url.searchParams.get('peerId') || `peer-${Math.random().toString(36).slice(2, 10)}`;
  const room = getRoom(roomId);
  const client = new Client(ws, peerId, roomId);
  room.add(client);

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  log(`[+] ${peerId} vào lớp "${roomId}" (${room.clients.size} thiết bị)`);

  // Thông báo danh sách ban đầu cho peer mới.
  send(client, { type: 'welcome', peerId, room: roomId, peers: room.publicPeers() });
  // Thông báo cho các peer khác.
  room.broadcast({ type: 'peer-joined', peer: { peerId, name: client.name, role: client.role } }, peerId);

  ws.on('message', (data) => {
    const msg = safeParse(data);
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'hello':
        client.name = String(msg.name || peerId).slice(0, 64);
        client.role = msg.role === 'admin' ? 'admin' : 'learner';
        room.broadcast(
          { type: 'peer-updated', peer: { peerId, name: client.name, role: client.role } },
          peerId
        );
        break;

      case 'signal':
        // Relay offer/answer/ice tới đúng peer đích.
        if (msg.to) {
          const ok = room.sendTo(msg.to, { type: 'signal', from: peerId, signal: msg.signal });
          if (!ok) send(client, { type: 'error', code: 'PEER_OFFLINE', to: msg.to });
        }
        break;

      case 'advertise':
        // Lưu metadata (bản mỏng) và lan truyền.
        if (msg.resource && msg.resource.resourceId) {
          client.resources.set(msg.resource.resourceId, msg.resource);
          room.broadcast({ type: 'resource-advertise', from: peerId, resource: msg.resource }, peerId);
        }
        break;

      case 'withdraw':
        if (msg.resourceId) client.resources.delete(msg.resourceId);
        room.broadcast({ type: 'resource-withdraw', from: peerId, resourceId: msg.resourceId }, peerId);
        break;

      case 'query':
        // Truy vấn metadata: trả lời trực tiếp từ registry phía server (nhanh),
        // đồng thời chuyển tiếp cho các peer để hỏi nguồn có bản mới hơn.
        if (msg.requestId) {
          const hits = [];
          for (const c of room.clients.values()) {
            for (const r of c.resources.values()) {
              if (matchesQuery(r, msg.query)) hits.push({ owner: c.peerId, resource: r });
            }
          }
          send(client, {
            type: 'query-result',
            requestId: msg.requestId,
            hits,
            ttl: msg.ttl ?? 3,
          });
          room.broadcast(
            { type: 'resource-query', from: peerId, requestId: msg.requestId, query: msg.query, ttl: (msg.ttl ?? 3) - 1 },
            peerId
          );
        }
        break;

      case 'bye':
        cleanup();
        break;

      default:
        break;
    }
  });

  ws.on('close', cleanup);
  ws.on('error', () => cleanup());

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    room.remove(peerId);
    room.broadcast({ type: 'peer-left', peerId }, peerId);
    if (room.clients.size === 0) rooms.delete(roomId);
    log(`[-] ${peerId} rời lớp "${roomId}" (${room.clients.size} thiết bị)`);
  }
});

// Heartbeat để phát hiện peer chết ở tầng TCP.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, HEARTBEAT_INTERVAL);

wss.on('close', () => clearInterval(heartbeat));

function send(client, message) {
  if (client.ws.readyState === client.ws.OPEN) client.ws.send(JSON.stringify(message));
}

function matchesQuery(resource, query) {
  if (!query) return true;
  const q = String(query).toLowerCase();
  return (
    (resource.title || '').toLowerCase().includes(q) ||
    (resource.subject || '').toLowerCase().includes(q) ||
    (resource.grade || '').toLowerCase().includes(q) ||
    (resource.tags || []).some((t) => String(t).toLowerCase().includes(q))
  );
}

function log(...args) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}]`, ...args);
}

server.listen(PORT, HOST, () => {
  console.log('==========================================================');
  console.log('  EduShare Signaling Server');
  console.log(`  Đang lắng nghe tại http://${HOST}:${PORT}`);
  console.log(`  PWA tĩnh: ${fs.existsSync(APP_DIR) ? APP_DIR : '(chưa build)'}`);
  console.log('  Nhấn Ctrl+C để dừng');
  console.log('==========================================================');
});
