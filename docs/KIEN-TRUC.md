# KIẾN TRÚC & THIẾT KẾ HỆ THỐNG EDU SHARE

Tài liệu này mô tả chi tiết kiến trúc, luồng dữ liệu và mô hình lưu trữ của EduShare,
kèm liên kết tới mã nguồn tương ứng.

---

## 1. Sơ đồ thành phần

```
┌──────────────────────── Thiết bị người dùng (PWA) ─────────────────────────┐
│                                                                            │
│  ┌───────────────┐   ┌────────────────┐   ┌──────────────────────────────┐  │
│  │   Screens     │──►│   AppContext   │──►│            lib/*             │  │
│  │ Library       │   │ (state+actions)│   │ signaling peer gossip        │  │
│  │ Devices       │◄──│                │◄──│ transfer replication crypto db│ │
│  │ Transfers     │   └────────────────┘   └──────────────┬───────────────┘  │
│  └───────────────┘                                        │                  │
│         │                                                 │                  │
│         ▼                                                 ▼                  │
│  ┌───────────────┐                            ┌────────────────────────┐    │
│  │ Service Worker│                            │      IndexedDB         │    │
│  │  (Workbox)    │                            │ resources chunks peers  │    │
│  │ app shell+img │                            │ transfers sync stats   │    │
│  └───────────────┘                            └────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
              │ WebSocket (room)                    ▲ RTCDataChannel (P2P)
              ▼                                     │
     ┌─────────────────────┐                        │
     │  Signaling Server   │◄── SDP/ICE relay ──────┘
     │  Node.js + ws :8787 │◄── metadata relay
     └─────────────────────┘
```

---

## 2. Vai trò của Signaling Server

- **Chỉ làm mai mối**: trao đổi SDP/ICE trong vài giây đầu để WebRTC bắt tay.
- **Relay metadata**: advertise/query/withdraw để giảm tải gossip trước khi DataChannel mở.
- **Presence**: danh sách peer trong phòng (room), heartbeat ping/pong 15 s.
- **Không** lưu nội dung tài nguyên.

Nguồn: `signaling-server/server.js`.

| Endpoint HTTP | Mục đích |
|---|---|
| `GET /` | Phục vụ PWA tĩnh (`app/dist`) |
| `GET /health` | Trạng thái server (JSON) |
| `GET /peers?room=` | Danh sách peer công khai |
| `WS /?room=&peerId=` | Kênh signaling |

---

## 3. Các module PWA

| Module | File | Trách nhiệm |
|---|---|---|
| Protocol | `lib/protocol.ts` | Định nghĩa bản tin + hằng số |
| Crypto | `lib/crypto.ts` | SHA-256, Merkle root, HMAC-SHA256, canonical form |
| DB | `lib/db.ts` | Dexie schema + API |
| Signaling | `lib/signaling.ts` | WebSocket client, reconnect, room |
| Peer | `lib/peer.ts` | RTCPeerConnection, DataChannel, ICE, backpressure |
| Transfer | `lib/transfer.ts` | Publish/serve/download/resume/verify |
| Gossip | `lib/gossip.ts` | Advertise/query flooding TTL |
| Replication | `lib/replication.ts` | Đếm phổ biến, nhân bản |
| Store | `store/AppContext.tsx` | Khởi tạo & điều phối |
| SW | `sw.ts` | Cache offline-first |

---

## 4. Luồng dữ liệu chính

### 4.1. Tham gia lớp

```
AppContext.join → SignalingClient.connect
  → server welcome(peers) → với mỗi peer: PeerManager.ensure(peerId)
  → bên có peerId nhỏ hơn tạo offer → ICE → DataChannel OPEN
```

### 4.2. Phát hành tài nguyên (Admin/Giáo viên)

```
UploadModal → AppContext.publish(file, meta)
  → TransferManager.publish: chunk 256KB + hash + merkle + resourceId=SHA256(file)
  → IndexedDB.putResource/putChunk
  → (admin) hmacSign(canonicalMetadata) → signature
  → GossipEngine.advertise → WebSocket + DataChannel broadcast
```

### 4.3. Tải tài nguyên (Học sinh)

```
Library "Tải về" → AppContext.download(resourceId)
  → chọn candidates (peer đang mở + holders)
  → TransferManager.download: tính chunk thiếu (resume)
  → pump(): gửi CHUNK_REQUEST (WINDOW=4), tôn trọng backpressure
  → nhận CHUNK_DATA → IndexedDB.putChunk → tiến trình
  → đủ chunk → assembleBlob → SHA-256 → so checksum → availability='local'
```

### 4.4. Xem offline

```
PreviewModal → AppContext.getLocalBlob → db.assembleBlob → Blob URL
  → <iframe>/<video>/<audio>/<img> (không cần mạng)
```

---

## 5. Mô hình dữ liệu (IndexedDB)

### resources
| Trường | Kiểu | Ghi chú |
|---|---|---|
| resourceId (PK) | string | SHA-256 nội dung |
| title, subject, grade | string | phân loại |
| tags | string[] | tìm kiếm |
| size, chunkSize, chunkCount | number | |
| checksum, merkleRoot | string | toàn vẹn |
| ownerId, ownerName | string | nguồn phát hành |
| version, createdAt | number | gossip |
| signature? | string | HMAC (admin) |
| availability | `local`\|`network`\|`unknown` | trạng thái |
| holders? | string[] | peer đang giữ |

Index: `resourceId, title, subject, grade, createdAt, ownerId, availability`.

### chunks
Khoá ghép `[resourceId+index]`; index phụ `resourceId`. Mỗi bản ghi: `blob, size, receivedAt`.

### peers
`peerId` (PK), `name, role, lastSeen`.

### transfers
`id` (PK), `resourceId, direction, status, totalBytes, transferredBytes, totalChunks,
receivedChunks, speed, peerId, peerName, title, startedAt, updatedAt`.

### stats
`++id`, `resourceId, event, value, at` — dùng cho phân tích (request/download/publish).

### sync_queue
`++id`, `kind, payload, createdAt, tries` — hàng đợi background sync.

---

## 6. Cơ chế chịu lỗi

| Tình huống | Cơ chế |
|---|---|
| Signaling đứt | `SignalingClient` tự reconnect backoff (1s→15s) |
| Peer rời | `peer-left`/DataChannel close → đánh dấu mất kết nối |
| Tải gián đoạn | Chunk đã nhận lưu IndexedDB; resume hỏi lại phần thiếu |
| Sai checksum | Huỷ job, đánh dấu `error`, không lưu `local` |
| Nguồn không phản hồi | `pump()` chọn lại nguồn còn kết nối |
| Server sập | Peer đã kết nối vẫn truyền trực tiếp (DataChannel) |

---

## 7. Bảo mật & tin cậy

- **Mã hoá kênh:** DTLS (mặc định của WebRTC DataChannel).
- **Toàn vẹn:** content-addressing + Merkle root; peer tự kiểm chứng.
- **Nguồn gốc:** chữ ký HMAC của Admin Node; peer kiểm tra bằng `adminKey`.
- **Chống lạm dụng:** metadata sai định dạng bị bỏ qua; giới hạn TTL chống bão gossip.

---

## 8. Sơ đồ triển khai

```
Máy giáo viên (Admin)                     Router Wi-Fi (không Internet)
  ┌─────────────────────────┐                    │
  │ npm start (server :8787)│◄───────────────────┤
  │ phục vụ app/dist        │                    │
  │ chạy PWA (admin role)   │              ┌─────┴─────┬──────────┐
  └─────────────────────────┘              ▼           ▼          ▼
                                      Điện thoại  Laptop B   Máy tính bảng
                                       (PWA)      (PWA)       (PWA)
```

Chỉ cần: Node.js ≥ 18 trên máy giáo viên + một router Wi-Fi.
