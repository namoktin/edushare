# ĐẶC TẢ GIAO THỨC EDU SHARE (P2P Message Protocol)

**Phiên bản:** 1 · hằng số: `PROTOCOL_VERSION = 1`
Nguồn tham chiếu: `app/src/lib/protocol.ts`, `signaling-server/server.js`

Giao thức gồm **hai lớp**:
1. **Lớp Signaling** (client ↔ signaling server, JSON qua WebSocket).
2. **Lớp P2P** (peer ↔ peer, JSON qua RTCDataChannel), dùng các bản tin trong Phần B.

Mọi bản tin P2P có header chung:

```json
{ "v": 1, "id": "<msgId>", "ts": 1700000000000, "type": "<TYPE>" }
```

---

## A. Lớp Signaling (WebSocket)

Kết nối: `ws://<host>:8787/?room=<room>&peerId=<peerId>`

### A.1. Client → Server

| type | Payload | Mô tả |
|---|---|---|
| `hello` | `{ name, role }` | Đăng ký tên & vai trò sau khi kết nối |
| `signal` | `{ to, signal: { sdp?, candidate? } }` | Chuyển SDP/ICE tới peer đích |
| `advertise` | `{ resource }` | Quảng bá metadata tài nguyên |
| `withdraw` | `{ resourceId }` | Thu hồi tài nguyên |
| `query` | `{ requestId, query, ttl }` | Truy vấn metadata |
| `bye` | — | Rời phòng chủ động |

### A.2. Server → Client

| type | Payload | Mô tả |
|---|---|---|
| `welcome` | `{ peerId, room, peers[] }` | Danh sách peer hiện có khi vào phòng |
| `peer-joined` | `{ peer }` | Có peer mới |
| `peer-updated` | `{ peer }` | Peer đổi tên/vai trò |
| `peer-left` | `{ peerId }` | Peer rời |
| `signal` | `{ from, signal }` | Chuyển tiếp SDP/ICE |
| `resource-advertise` | `{ from, resource }` | Metadata được quảng bá |
| `resource-withdraw` | `{ from, resourceId }` | Thu hồi |
| `resource-query` | `{ from, requestId, query, ttl }` | Chuyển tiếp truy vấn |
| `query-result` | `{ requestId, hits[], ttl }` | Kết quả truy vấn |
| `error` | `{ code }` | Lỗi (vd `PEER_OFFLINE`) |

**Ví dụ `welcome`:**

```json
{
  "type": "welcome",
  "peerId": "peer-9a1c-2f",
  "room": "lop-9a",
  "peers": [
    { "peerId": "peer-b22e", "name": "Máy cô Hoa", "role": "admin", "resources": ["a1b2…"], "joinedAt": 1700000000000 }
  ]
}
```

---

## B. Lớp P2P (RTCDataChannel)

### B.1. HELLO

Bắt tay giữa hai peer sau khi DataChannel mở.

```json
{ "v":1, "id":"m-1", "ts":1700000000, "type":"HELLO",
  "peerId":"peer-9a1c", "name":"Máy của Minh", "role":"learner" }
```

### B.2. PEER_LIST

Trao đổi danh sách peer đã biết (dùng cho peer discovery nhiều hop).

```json
{ "v":1, "id":"m-2", "ts":1700000000, "type":"PEER_LIST",
  "peers":[ {"peerId":"peer-b22e","name":"Máy cô Hoa"} ] }
```

### B.3. RESOURCE_ADVERTISE

Quảng bá metadata tài nguyên (gossip).

```json
{ "v":1, "id":"m-3", "ts":1700000000, "type":"RESOURCE_ADVERTISE",
  "ttl":3,
  "resource": {
    "resourceId":"e3b0c44298fc…", "title":"Bài giảng Hóa 9 - Bài 4",
    "subject":"Hóa học", "grade":"Lớp 9", "tags":["ôn thi"],
    "size":10485760, "mime":"application/pdf",
    "chunkSize":262144, "chunkCount":40,
    "checksum":"e3b0c442…", "merkleRoot":"9f86d081…",
    "ownerId":"peer-admin1", "ownerName":"Máy cô Hoa",
    "createdAt":1700000000000, "version":1,
    "signature":"a1b2c3…"          // HMAC-SHA256 (chỉ Admin Node)
  }
}
```

Quy tắc: nhận nếu `resource.version >= seen[resourceId]`; nếu `ttl > 0`, chuyển tiếp với `ttl-1`
(bỏ qua peer gửi) trừ khi đã có bản `local`.

### B.4. RESOURCE_QUERY

Tìm tài nguyên theo từ khoá (flooding có TTL).

```json
{ "v":1, "id":"m-4", "ts":1700000000, "type":"RESOURCE_QUERY",
  "requestId":"q-abc123", "query":"hóa 9", "ttl":3 }
```

### B.5. RESOURCE_RESPONSE

```json
{ "v":1, "id":"m-5", "ts":1700000000, "type":"RESOURCE_RESPONSE",
  "requestId":"q-abc123",
  "hits":[ { "owner":"peer-b22e", "resource": { "resourceId":"e3b0…", "title":"…" } } ] }
```

### B.6. CHUNK_REQUEST

Yêu cầu một chunk theo chỉ số.

```json
{ "v":1, "id":"m-6", "ts":1700000000, "type":"CHUNK_REQUEST",
  "transferId":"dl-e3b0c442-1", "resourceId":"e3b0c44298fc…", "index":7 }
```

### B.7. CHUNK_DATA

Trả về dữ liệu chunk nhị phân (`ArrayBuffer`).

```json
{ "v":1, "id":"m-7", "ts":1700000000, "type":"CHUNK_DATA",
  "transferId":"dl-e3b0c442-1", "resourceId":"e3b0c44298fc…",
  "index":7, "total":40, "data":"<ArrayBuffer>" }
```

### B.8. TRANSFER_COMPLETE

Đánh dấu truyền xong và kèm checksum để bên nhận kiểm chứng.

```json
{ "v":1, "id":"m-8", "ts":1700000000, "type":"TRANSFER_COMPLETE",
  "transferId":"dl-e3b0c442-1", "resourceId":"e3b0c44298fc…",
  "checksum":"e3b0c442…" }
```

### B.9. VERIFY

Kết quả kiểm chứng.

```json
{ "v":1, "id":"m-9", "ts":1700000000, "type":"VERIFY",
  "requestId":"v-1", "ok":true, "checksum":"e3b0c442…" }
```

---

## C. Hằng số giao thức

| Hằng số | Giá trị | Ý nghĩa |
|---|---|---|
| `CHUNK_SIZE` | 262144 (256 KB) | Kích thước mỗi chunk |
| `DEFAULT_TTL` | 3 | Số hop tối đa của gossip |
| `BUFFER_HIGH_WATER` | 8388608 (8 MB) | Ngưỡng dừng gửi (backpressure) |
| `BUFFER_LOW_WATER` | 1048576 (1 MB) | Ngưỡng tiếp tục gửi |
| `window` tải song song | 4 | Số chunk yêu cầu đồng thời |

## D. Máy trạng thái phiên tải (transfer)

```
queued → connecting → active → verifying → done
                 ↑          │
                 └── paused ┘   (resume đọc chunk đã có từ IndexedDB)
                 active → error (sai checksum / mất nguồn)
```

## E. Quy tắc an toàn

- `resourceId = SHA-256(toàn bộ nội dung)` → định danh theo nội dung (content-addressed).
- `merkleRoot` tính từ hash các chunk → phát hiện chunk hỏng.
- Chữ ký `signature` chỉ Admin Node tạo; peer kiểm chứng bằng `adminKey` của lớp.
- Bỏ qua bản tin sai định dạng (`isValidMessage`) để tránh crash khi nhận gói độc hại.
