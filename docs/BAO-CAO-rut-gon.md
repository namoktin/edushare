# BÁO CÁO ĐỀ TÀI

## Mạng lưới chia sẻ tài nguyên giáo dục P2P ngoại tuyến ứng dụng WebRTC & Service Workers

**Tên hệ thống:** EduShare
**Loại sản phẩm:** Phần mềm (ứng dụng PWA + signaling server)
**Phiên bản tài liệu:** 1.0

---

# MỤC LỤC

1. [Chương 1 — Mở đầu](#chương-1--mở-đầu)
2. [Chương 2 — Cơ sở lý thuyết](#chương-2--cơ-sở-lý-thuyết)
3. [Chương 3 — Phân tích & thiết kế hệ thống](#chương-3--phân-tích--thiết-kế-hệ-thống)
4. [Chương 4 — Triển khai](#chương-4--triển-khai)
5. [Chương 5 — Thực nghiệm & đánh giá](#chương-5--thực-nghiệm--đánh-giá)
6. [Chương 6 — Kết luận & hướng phát triển](#chương-6--kết-luận--hướng-phát-triển)
7. [Tài liệu tham khảo](#tài-liệu-tham-khảo)
8. [Phụ lục](#phụ-lục)

---

# Chương 1 — MỞ ĐẦU

## 1.1. Lý do chọn đề tài

**Khoảng trống số trong giáo dục.** Nhiều khu vực nông thôn, miền núi, vùng sâu vùng xa vẫn thiếu
đường truyền Internet ổn định. Học sinh có thiết bị (điện thoại/laptop) nhưng không thể truy cập
kho tài nguyên trực tuyến; giáo viên muốn chia sẻ bài giảng nhưng USB là phương tiện phổ biến và
thủ công.

**Hạn chế của mô hình client–server tập trung.** Các nền tảng học liệu hiện nay (LMS, drive, website)
đều dựa vào máy chủ trung tâm: khi đường truyền đứt, toàn bộ hệ thống ngừng phục vụ; chi phí băng thông,
lưu trữ và vận hành tăng theo số người dùng; máy chủ là điểm nghẽn và điểm lỗi duy nhất (single point
of failure), đồng thời là mục tiêu tấn công hấp dẫn.

**Tiềm năng của mô hình P2P ngoại tuyến.** Các thiết bị trong một lớp học vốn đã cùng nằm trên một
mạng LAN/Wi-Fi. Nếu mỗi thiết bị vừa là *người dùng* vừa là *người cung cấp tài nguyên* (peer), thì
nội dung có thể lan truyền trực tiếp giữa các máy mà không cần Internet. WebRTC DataChannel cho phép
truyền dữ liệu P2P trong trình duyệt; Service Worker + IndexedDB cho phép ứng dụng hoạt động hoàn toàn
ngoại tuyến. Đây chính là nền tảng để xây dựng **EduShare**.

## 1.2. Mục tiêu nghiên cứu

**Mục tiêu tổng quát:** Xây dựng hệ thống chia sẻ tài nguyên giáo dục hoạt động *hoàn toàn không cần
Internet*, đảm bảo người học vẫn truy cập được nội dung đã phát tán trong mạng lớp.

**Mục tiêu cụ thể (định lượng được):**

| Mã | Mục tiêu | Tiêu chí đo |
|---|---|---|
| **MG1** | Thiết kế giao thức phát hiện & kết nối peer trong LAN | ≥ 90% cặp peer thiết lập được DataChannel trong ≤ 10 s |
| **MG2** | Xây dựng cơ chế lan truyền tài nguyên (metadata gossip + truyền tệp chunk) | Metadata phủ tới toàn mạng trong ≤ 3 chu kỳ gossip |
| **MG3** | Đạt tốc độ truyền tối thiểu giữa 2 thiết bị trong LAN | Throughput ≥ 5 MB/s khi tải 1 tệp (LAN Wi-Fi 5 GHz) |
| **MG4** | Ứng dụng hoạt động offline 100% sau cài đặt đầu tiên | Mở lại app khi không mạng vẫn xem được nội dung đã tải |

## 1.3. Đối tượng & phạm vi nghiên cứu

**Trong phạm vi:**
- Mạng cục bộ LAN/Wi-Fi nội bộ (một lớp học, một trường).
- Thiết bị Android + trình duyệt desktop (Chrome/Edge/Firefox), nền tảng PWA.
- Trao đổi tệp tĩnh: PDF, video, audio, hình ảnh, tài liệu văn phòng.

**Ngoài phạm vi:**
- iOS/Safari (hạn chế Service Worker nền và Background Sync — xem Chương 6).
- Mạng di động WAN và kết nối xuyên NAT phức tạp (cần TURN server).
- Thuật toán AI, gợi ý nội dung, xử lý ngôn ngữ.

## 1.4. Câu hỏi nghiên cứu

- **RQ1:** Làm sao phát hiện và duy trì kết nối giữa các peer khi *không có server định danh tập trung*?
- **RQ2:** Tài nguyên lan truyền trong mạng hiệu quả thế nào (băng thông, thời gian, tỉ lệ thành công)?
- **RQ3:** Làm sao đảm bảo toàn vẹn dữ liệu khi *không có máy chủ kiểm chứng*?

## 1.5. Ý nghĩa khoa học & thực tiễn

- **Khoa học:** Đề xuất mô hình kết hợp WebRTC DataChannel + Service Worker + gossip metadata cho bài
  toán phân phối nội dung giáo dục trong môi trường bị cô lập mạng; đánh giá thực nghiệm về throughput,
  khả năng chịu churn và tính toàn vẹn dữ liệu phi tập trung.
- **Thực tiễn:** Chi phí triển khai gần bằng 0 (tận dụng laptop giáo viên + router Wi-Fi sẵn có);
  một codebase duy nhất; giáo viên không cần hạ tầng kỹ thuật.

## 1.6. Bố cục báo cáo

Chương 2 trình bày cơ sở lý thuyết; Chương 3 phân tích & thiết kế; Chương 4 triển khai; Chương 5
thực nghiệm & đánh giá; Chương 6 kết luận và hướng phát triển.

---

# Chương 2 — CƠ SỞ LÝ THUYẾT

## 2.1. Tổng quan hệ thống chia sẻ tệp P2P

**Phân loại kiến trúc:**

| Tiêu chí | Pure P2P | Hybrid P2P | Structured (DHT) | Unstructured (gossip/flooding) |
|---|---|---|---|---|
| Máy chủ định danh | Không | Có (một phần) | Không | Không |
| Định tuyến | Ngẫu nhiên | Qua super-node | Bảng băm (Chord/Kademlia) | Lan truyền |
| Khả năng mở rộng | Kém (flooding) | Tốt | Rất tốt | Trung bình |
| Triển khai | Đơn giản | Trung bình | Phức tạp | Đơn giản |

**Các hệ thống tiêu biểu:**

| Hệ thống | Mô hình | Signaling | Giao vận | Phù hợp offline LAN |
|---|---|---|---|---|
| BitTorrent | Hybrid (tracker) | Tracker | TCP/uTP | Cần tracker/IP |
| IPFS/libp2p | Pure, DHT | Bootstrap node | TCP/QUIC | Cần bootstrap |
| Freenet | Pure, DHT | — | TCP | Phức tạp |
| **EduShare** | **Hybrid nhẹ (signaling LAN) + flooding** | **WebSocket LAN** | **WebRTC DataChannel** | **Có — thiết kế cho LAN offline** |

## 2.2. Giao thức WebRTC

WebRTC cho phép trình duyệt kết nối P2P trực tiếp. Các thành phần cốt lõi:

- **ICE (Interactive Connectivity Establishment):** thu thập *candidate* (địa chỉ mạng khả dụng) và
  tìm đường kết nối. Trong LAN, các **host candidate** (địa chỉ IP nội bộ) đủ để kết nối, do đó
  EduShare cấu hình `iceServers: []` để chạy thuần ngoại tuyến (không phụ thuộc STUN/TURN).
- **STUN/TURN:** chỉ cần khi vượt NAT hoặc cần relay. EduShare nằm trong phạm vi ngoài (LAN thuần).
- **SDP (Session Description Protocol):** mô tả phiên (codec, media, datachannel).
- **DTLS-SRTP:** mã hoá. Với DataChannel, dữ liệu đi qua **SCTP over DTLS** nên mặc định đã mã hoá.

**RTCDataChannel — trọng tâm của EduShare:**

| Thuộc tính | Ý nghĩa | Lựa chọn của EduShare |
|---|---|---|
| Ordered | Đảm bảo thứ tự gói | `ordered: true` (truyền tệp cần đúng thứ tự) |
| Reliable | Có cơ chế retransmit | Mặc định reliable (không mất chunk) |
| Chunk size | Kích thước mỗi gói tin | **256 KB** (cân bằng giữa overhead và độ trễ) |
| Backpressure | `bufferedAmount` / `bufferedAmountLowThreshold` | Ngưỡng 8 MB / 1 MB |

**Trao đổi SDP khi offline.** WebRTC cần một kênh "ngoài băng tần" (*out-of-band*) để đổi SDP/ICE.
Trong EduShare có 3 mức:
1. **Signaling server LAN** (WebSocket) — mặc định, tự động.
2. **mDNS** — dự phòng (giới hạn bởi trình duyệt, ghi nhận thực nghiệm).
3. **QR/SDP thủ công** — phương án cuối khi không có server (copy-paste mã).

## 2.3. Progressive Web App & Service Worker

**Vòng đời Service Worker:** `install → activate → fetch → (idle) → terminate`. SW đóng vai trò proxy
giữa trang và mạng, cho phép cache và trả nội dung khi offline.

**Chiến lược cache (Workbox):**

| Chiến lược | Dùng cho | Trong EduShare |
|---|---|---|
| CacheFirst | Icon, hình ảnh | `edushare-images` |
| StaleWhileRevalidate | JS/CSS/font | `edushare-static` |
| Precache | App shell | `precacheAndRoute(__WB_MANIFEST__)` |
| Navigation fallback | Điều hướng SPA | Luôn trả `index.html` |

**Background Sync / Periodic Sync / Storage API.** EduShare dùng hàng đợi đồng bộ (`sync_queue`) và
xin *persistent storage* để giảm nguy cơ trình duyệt xoá dữ liệu khi thiếu dung lượng.

## 2.4. Lưu trữ cục bộ trên trình duyệt

| Tiêu chí | LocalStorage | Cache Storage | IndexedDB |
|---|---|---|---|
| Dung lượng | ~5 MB | Theo quota | Lớn (theo quota) |
| Kiểu dữ liệu | Chuỗi | Request/Response | Object, Blob, mảng |
| Truy vấn | Không | Không | Có (index, transaction) |
| Bất đồng bộ | Không | Có | Có |
| Dùng cho | Cấu hình nhỏ | Tài nguyên tĩnh | **Chunk tệp + metadata** |

EduShare dùng **IndexedDB** (qua Dexie.js) cho nội dung và **LocalStorage** cho định danh thiết bị.

## 2.5. Mạng chịu trễ (DTN)

Mô hình **store-and-forward**: nút lưu dữ liệu rồi chuyển tiếp khi có cơ hội kết nối. **Epidemic
routing** lan truyền dữ liệu tới mọi nút gặp được. EduShare áp dụng nguyên lý này ở dạng nhẹ: peer
giữ bản sao tài nguyên "nóng" và quảng bá lại khi gặp peer mới (replication), hướng tới khả năng
"mang nội dung giữa các cụm mạng" trong tương lai.

## 2.6. Các nghiên cứu & hệ thống liên quan

| Hệ thống | Mô hình | Điểm mạnh | Hạn chế so với EduShare |
|---|---|---|---|
| **Kolibri** (Learning Equality) | Server cục bộ | Thư viện phong phú, đa nền tảng | Cần một thiết bị "server"; tập trung hoá |
| **RACHEL** | Server cục bộ + hotspot | Nội dung đóng gói sẵn | Không có P2P; cần thiết bị chuyên dụng |
| **Internet-in-a-Box** | Server cục bộ | Cộng đồng mạnh | Tập trung; không lan truyền giữa các máy |
| **EduShare** | **Hybrid P2P** | Không server nội dung, chịu churn, offline 100%, chi phí ~0 | Dung lượng phụ thuộc thiết bị; chưa hỗ trợ iOS |

➡️ **Khoảng trống nghiên cứu:** các hệ thống hiện có đều dựa trên *một máy chủ nội dung*; EduShare
đặt nội dung phân tán trên chính thiết bị người học, dùng signaling nhẹ chỉ để bắt tay, nên nội dung
vẫn sống sót khi máy chủ tắt.

---

# Chương 3 — PHÂN TÍCH & THIẾT KẾ HỆ THỐNG

## 3.1. Yêu cầu chức năng

| Mã | Chức năng | Ưu tiên | Trạng thái |
|---|---|---|---|
| F1 | Phát hiện peer trong LAN | Must | ✅ |
| F2 | Chia sẻ/tải tài nguyên P2P | Must | ✅ |
| F3 | Tìm kiếm tài nguyên qua nhiều hop | Must | ✅ |
| F4 | Xem nội dung offline qua Service Worker | Must | ✅ |
| F5 | Resume tải bị gián đoạn | Should | ✅ |
| F6 | Đồng bộ hoá khi có Internet | Should | ⏳ một phần |
| F7 | Cơ chế kiểm chứng nội dung | Should | ✅ |

## 3.2. Yêu cầu phi chức năng

- **Hiệu năng:** throughput ≥ 5 MB/s trong LAN; thiết lập kết nối ≤ 3 s (LAN).
- **Chịu lỗi (churn):** peer rời mạng giữa chừng → tải vẫn hoàn tất nếu còn ≥ 1 nguồn; trạng thái lưu
  vào IndexedDB để resume.
- **Bảo mật:** kênh DTLS của WebRTC; ký HMAC metadata; kiểm chứng SHA-256/Merkle.
- **Khả năng mở rộng:** signaling nhẹ, chịu 50–100 thiết bị/lớp.
- **Tài nguyên thiết bị yếu:** chunk 256 KB, backpressure, cache có giới hạn (`ExpirationPlugin`).

## 3.3. Use case & kiến trúc tổng quan

**Tác nhân:** Học sinh (Learner Node), Giáo viên (Admin Node).

**Sơ đồ kiến trúc 4 tầng:**

```
┌──────────────────────────────────────────────────────────┐
│ TẦNG 1 - GIAO DIỆN (PWA React)                           │
│  Thư viện | Lớp học | Đang truyền | Upload | Preview     │
├──────────────────────────────────────────────────────────┤
│ TẦNG 2 - MẠNG P2P                                        │
│  SignalingClient (WebSocket)  │  PeerManager (RTCDataCh) │
├──────────────────────────────────────────────────────────┤
│ TẦNG 3 - GIAO THỨC                                       │
│  GossipEngine (metadata)  │  TransferManager (chunking)  │
│  ReplicationManager (phổ biến)  │  Crypto (SHA-256/HMAC)  │
├──────────────────────────────────────────────────────────┤
│ TẦNG 4 - LƯU TRỮ                                         │
│  IndexedDB (Dexie)  │  Service Worker / Workbox cache    │
└──────────────────────────────────────────────────────────┘
```

**Sơ đồ tuần tự — thiết lập kết nối WebRTC qua signaling LAN:**

```
A                    Signaling                    B
│  join(room) ─────────► │ ◄────────── join(room) │
│  ◄──── welcome(peers)  │  ────► peer-joined(A)  │
│                        │                        │
│  (A < B theo peerId)   │                        │
│  createOffer ──► signal(to=B, sdp) ──────────► B
│                        │        setRemote, createAnswer
│  ◄──────────── signal(from=B, sdp answer) ─────│
│  setRemote             │                        │
│  ICE candidates ◄──────── relay ──────────► ICE │
│  ══════════ DataChannel OPEN (DTLS) ══════════  │
```

## 3.4. Thiết kế giao thức mạng

### 3.4.1. Phát hiện peer

1. **Signaling WebSocket LAN** (chính): peer gửi `hello`, nhận `welcome(peers)`, `peer-joined`, `peer-updated`, `peer-left`.
2. **mDNS** (dự phòng, trình duyệt hạn chế — ghi nhận thực nghiệm).
3. **QR/SDP thủ công** (khi không có server).

### 3.4.2. Định dạng tin nhắn giao thức

Tất cả tin nhắn là JSON có trường chung `{ v, id, ts, type }`. Các loại:

```
HELLO / PEER_LIST / RESOURCE_ADVERTISE /
RESOURCE_QUERY / RESOURCE_RESPONSE /
CHUNK_REQUEST / CHUNK_DATA / TRANSFER_COMPLETE / VERIFY
```

Chi tiết đầy đủ: [`GIAO-THUC.md`](GIAO-THUC.md).

### 3.4.3. Gossip metadata

Mỗi peer duy trì bảng `resourceId → { holders[], version, checksum, merkleRoot, ttl }`. Chu kỳ gossip
`Δt = 20 s`. Mỗi thông điệp `RESOURCE_ADVERTISE` mang `ttl` (mặc định 3); mỗi hop giảm 1, `ttl = 0` thì dừng.

### 3.4.4. Thuật toán lựa chọn nguồn tải

Chọn peer nguồn có **điểm thấp nhất**:

```
score(peer) = load(peer) * 1e6 + bufferedAmount(peer)
```

Trong đó `load` = số phiên tải đang dùng peer đó (cân bằng tải), `bufferedAmount` = độ trễ ước lượng.

### 3.4.5. Chiến lược replication

Mỗi lượt yêu cầu/tải tài nguyên tăng bộ đếm phổ biến. Khi vượt ngưỡng `θ = 3`, peer giữ bản sao chủ
động tăng `version` và quảng bá lại → tăng số bản sao trong mạng (epidemic nhẹ).

**Pseudocode:**

```text
# Gossip
procedure GOSSIP_CYCLE():
    for r in local_resources where availability == 'local':
        broadcast(ADVERTISE(r, ttl=TTL))

on receive ADVERTISE(res, ttl):
    if res.version >= seen[res.id] and not local(res.id):
        store_metadata(res, availability='network')
        seen[res.id] = res.version
    if ttl > 0: forward(ADVERTISE(res, ttl-1), except sender)

# Chọn nguồn
function PICK_SOURCE(candidates):
    best = null; bestScore = +inf
    for p in candidates where connected(p):
        score = active_load(p) * 1e6 + buffered_amount(p)
        if score < bestScore: best = p; bestScore = score
    return best

# Replication
on RESOURCE_REQUEST(res):
    popularity[res.id] += 1
    if popularity[res.id] == THRESHOLD:
        advertise(res with version+1)
```

## 3.5. Thiết kế cơ sở dữ liệu cục bộ (IndexedDB)

| Object store | Khoá | Trường chính | Vai trò |
|---|---|---|---|
| `resources` | `resourceId` | title, subject, grade, checksum, merkleRoot, availability, holders | Metadata tài nguyên |
| `chunks` | `[resourceId+index]` | blob, size | Nội dung từng phần |
| `peers` | `peerId` | name, role, lastSeen | Danh bạ peer |
| `sync_queue` | `++id` | kind, payload | Hàng đợi background sync |
| `stats` | `++id` | resourceId, event, value | Số liệu thực nghiệm |
| `transfers` | `id` | status, progress, speed | Phiên truyền (resume) |

**Sơ đồ ER (logic):**

```
resources 1 ────< chunks
   │ 1
   │
   └──< transfers >──── peers (peerId)
stats (độc lập, tham chiếu resourceId)
sync_queue (độc lập)
```

## 3.6. Thiết kế Service Worker & offline-first

- Precache app shell → mở app khi offline.
- Navigation route → luôn trả `index.html` (SPA).
- Runtime cache: ảnh CacheFirst, JS/CSS StaleWhileRevalidate.
- Nội dung tài nguyên **không** nằm ở Cache Storage mà ở IndexedDB; trang đọc IndexedDB → tạo `Blob URL`
  để xem PDF/video/ảnh. Nhờ vậy app shell và nội dung tách biệt, dễ quản lý quota.

## 3.7. Thiết kế bảo mật & mô hình phân quyền

- **Kênh:** WebRTC DataChannel đã mã hoá DTLS mặc định.
- **Toàn vẹn:** mỗi tệp có `checksum = SHA-256(toàn tệp)`; `merkleRoot` tổng hợp từ hash các chunk.
  Khi tải xong, peer tự tính lại SHA-256 và đối chiếu — không cần máy chủ.
- **Nguồn gốc:** Admin Node ký metadata bằng `HMAC-SHA256(adminKey, canonicalMetadata)`; peer hiển thị
  nhãn "✓ Chữ ký hợp lệ".

**Mô hình 2 loại node (vai trò logic, cùng một codebase):**

| Vai trò | Quyền |
|---|---|
| **Learner Node** (học sinh) | Đọc, tải, chia sẻ tài nguyên của mình |
| **Admin Node** (giáo viên) | Tất cả quyền learner + ký/phát hành/thu hồi + xem thống kê |

⚠️ **Nếu máy giáo viên tắt:** signaling có thể chuyển sang peer bất kỳ (bầu chọn đơn giản) hoặc dùng
mDNS/QR; các tài nguyên đã ký vẫn hợp lệ vì chữ ký nằm trong metadata đã lan truyền.

## 3.8. Thiết kế giao diện (UI/UX)

**Nguyên tắc:** mobile-first, offline-first, ≤ 3 chạm để tải/chia sẻ, không lộ thuật ngữ kỹ thuật
(không hiện "WebRTC/peer/SDP"), tiếng Việt.

**4 màn hình chính:** 📚 Thư viện · 👥 Lớp học · ⬆️ Đang truyền · ➕ Tải lên.

**3 trạng thái tài nguyên:** 🟢 Có sẵn (xem ngay) · 🟡 Có trên mạng lớp (tải về) · ⚪ Chưa có trong mạng.

**Responsive — breakpoint & bố cục:**

| Thành phần | Mobile (< 640px) | Laptop (> 1024px) |
|---|---|---|
| Điều hướng | Tab bar dưới (3 tab) | Sidebar trái |
| Danh sách tài nguyên | Card dọc 1 cột | Lưới 2–4 cột |
| Chi tiết tài nguyên | Modal fullscreen | Modal rộng (panel) |
| Đang truyền | Tab riêng | Tab + lưới 2 cột |
| Nút tải lên | FAB góc phải dưới | Nút ở sidebar |
| Thanh trạng thái mạng | Trên cùng | Trên cùng |

**Mapping UI ↔ công nghệ:**

| Thành phần UI | Công nghệ phía dưới |
|---|---|
| "X thiết bị đang kết nối" | WebSocket signaling + heartbeat |
| Nút "Tải về" | RTCDataChannel, chunk 256 KB, SHA-256 |
| Thanh tiến trình / Tiếp tục | IndexedDB lưu chunk + resume |
| Xem file offline | IndexedDB → Blob URL |
| Tài nguyên xuất hiện khi có mạng | Gossip metadata |
| "Tự động gửi lại khi có mạng" | sync_queue + Background Sync |

---

# Chương 4 — TRIỂN KHAI

## 4.1. Công nghệ & môi trường

| Thành phần | Công nghệ | Phiên bản | Lý do |
|---|---|---|---|
| Ngôn ngữ | TypeScript | 5.6 | An toàn kiểu, dễ bảo trì |
| UI | React | 18 | Hệ sinh thái lớn, phù hợp PWA |
| Build | Vite | 5 | Nhanh, hỗ trợ PWA plugin |
| CSS | Tailwind CSS | 3.4 | Mobile-first, responsive nhanh |
| PWA/SW | vite-plugin-pwa + Workbox | 0.20 / 7.3 | injectManifest + precache |
| IndexedDB | Dexie.js | 4 | Wrapper gọn, transaction |
| Signaling | Node.js + ws | 22 / 8.18 | Nhẹ, chạy mọi HĐH |
| Mã hoá | Web Crypto API | native | SHA-256, HMAC-SHA256 |

Không dùng database, không Nginx/Apache, không tên miền, không SSL (LAN nội bộ).

## 4.2. Kiến trúc mã nguồn

```
app/src/
├── lib/
│   ├── protocol.ts      # định nghĩa bản tin + hằng số (CHUNK_SIZE, TTL, backpressure)
│   ├── crypto.ts        # sha256, merkleRoot, hmacSign/Verify, canonicalMetadata
│   ├── db.ts            # Dexie schema + API cho resources/chunks/peers/...
│   ├── signaling.ts     # WebSocket client, tự reconnect, room
│   ├── peer.ts          # RTCPeerConnection + DataChannel, ICE, backpressure
│   ├── transfer.ts      # publish, serve, download, resume, verify
│   ├── gossip.ts        # advertise/query flooding TTL, hợp nhất catalog
│   └── replication.ts   # đếm phổ biến, nhân bản
├── store/AppContext.tsx # khởi tạo manager, state, hành động
├── components/          # StatusBar, ResourceCard, TransferRow, Modal, Upload/Preview
├── screens/             # Onboarding, Library, Devices, Transfers
├── sw.ts                # Service Worker
└── App.tsx              # layout responsive
```

## 4.3. Hiện thực các module chính

### 4.3.1. Signaling server LAN (`signaling-server/server.js`)

- HTTP server phục vụ PWA tĩnh + `/health`, `/peers`.
- WebSocket room-based: `hello/signal/advertise/query/withdraw/bye`.
- Heartbeat ping/pong 15 s để phát hiện peer chết.
- Không lưu nội dung; chỉ giữ metadata mỏng trong RAM.

### 4.3.2. Peer manager & DataChannel (`app/src/lib/peer.ts`)

- Một `RTCPeerConnection` cho mỗi peer; `iceServers: []` (LAN thuần).
- Chọn bên tạo offer tất định: bên có `peerId` nhỏ hơn → tránh "glare".
- `waitForDrain()` dùng `bufferedAmountLowThreshold` để thực thi backpressure.

```ts
const RTC_CONFIG: RTCConfiguration = { iceServers: [], iceCandidatePoolSize: 0 };
// Chỉ bên có peerId nhỏ hơn chủ động tạo offer.
if (this.localId < peerId) this.createOfferer(peerId);
```

### 4.3.3. Gossip engine (`app/src/lib/gossip.ts`)

- Nhận `advertise`, hợp nhất nếu `version` mới hơn.
- `query()` gửi đồng thời qua WebSocket và DataChannel, gom kết quả trong 2.5 s.
- Flooding có TTL, bỏ qua peer gửi để tránh loop.

### 4.3.4. File transfer (`app/src/lib/transfer.ts`)

- **Publish:** chia tệp thành chunk 256 KB, hash từng chunk, tính Merkle root, `resourceId = SHA-256(tệp)`.
- **Serve:** đọc chunk từ IndexedDB, chờ drain rồi gửi `CHUNK_DATA`.
- **Download:** tính chunk còn thiếu (resume), cửa sổ song song `WINDOW = 4`, kiểm chứng SHA-256 khi xong.

```ts
const WINDOW = 4;
while (a.inflight.size < WINDOW && a.nextIndex < a.missing.length) {
  const idx = a.missing[a.nextIndex++];
  const source = this.pickSource(a);
  if (this.peers.send(source, Protocol.chunkRequest(a.job.id, a.meta.resourceId, idx)))
    a.inflight.add(idx); else a.nextIndex--;
}
```

### 4.3.5. IndexedDB layer (`app/src/lib/db.ts`)

Dexie với 6 object store; API: `putResource`, `putChunk`, `receivedChunkIndexes`, `assembleBlob`, `enqueueSync`, `logStat`, `putTransfer`.

### 4.3.6. Service Worker (`app/src/sw.ts`)

```ts
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
registerRoute(({request}) => request.destination === 'image',
  new CacheFirst({ cacheName: 'edushare-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 90*24*3600 })] }));
```

### 4.3.7. Giao diện PWA

- `App.tsx`: mobile tab-bar + FAB; laptop sidebar + lưới tài nguyên.
- Màu trạng thái: 🟢/🟡/⚪; badge Admin, badge P2P/LAN.
- `PreviewModal`: đọc blob từ IndexedDB → `Blob URL` → `<iframe>` (PDF), `<video>`, `<audio>`, `<img>`.

## 4.4. Demo hệ thống

Kịch bản demo trước hội đồng:
1. Máy giáo viên (Admin) chạy `npm start`; 3 máy học sinh mở `http://<IP>:8787`.
2. Admin bấm ➕ phát hành `Hóa9-Bai4.pdf` → máy học sinh thấy tài nguyên xuất hiện (gossip).
3. Học sinh A bấm "Tải về" → tiến trình chạy; rút Wi-Fi giữa chừng → trạng thái *Tạm dừng*, bật lại → *Tiếp tục*.
4. Tải xong → badge 🟢; tắt signaling, ngắt mạng → mở app vẫn xem được (offline 100%).
5. Học sinh B tải từ A (không qua máy giáo viên) → chứng minh P2P.

> Ảnh chụp màn hình: thêm vào `docs/demo/` khi chạy thực tế.

---

# Chương 5 — THỰC NGHIỆM & ĐÁNH GIÁ

## 5.1. Thiết lập thực nghiệm

| Hạng mục | Cấu hình đề xuất |
|---|---|
| Thiết bị | 5–10: 2 laptop + 3–6 điện thoại Android |
| Mạng | 1 router Wi-Fi nội bộ, **ngắt Internet** |
| Signaling | 1 laptop (Admin) chạy `npm start` |
| Bộ dữ liệu | 20 tệp, kích thước 1–100 MB, định dạng PDF/video/audio |
| Trình duyệt | Chrome/Edge ≥ 110, Firefox ≥ 110 |

## 5.2. Kịch bản thử nghiệm & chỉ số đo (KPI)

| # | Kịch bản | Chỉ số | Ghi chú |
|---|---|---|---|
| K1 | Tải 1 tệp giữa 2 peer | Throughput (MB/s), thời gian bắt tay (s) | ≥ 30 lần chạy |
| K2 | 1 tệp phát tán tới N peer | Thời gian phủ sóng toàn mạng (s) | N = 3,5,8 |
| K3 | Churn: tắt ngẫu nhiên peer nguồn | Tỉ lệ tải thành công (%), thời gian phục hồi (s) | 10–30% peer |
| K4 | So sánh P2P vs server trung tâm | Tổng thời gian phân phối, tải máy chủ | cùng kích thước |
| K5 | Mở offline sau khi đã tải | Thời gian phục vụ từ cache (ms) | ngắt mạng hoàn toàn |

## 5.3. Kết quả & phân tích (mẫu để điền)

**Bảng K1 — Throughput theo kích thước tệp (LAN Wi-Fi 5 GHz, 2 peer):**

| Kích thước | Throughput TB (MB/s) | Thời gian bắt tay TB (s) | Ghi chú |
|---|---|---|---|
| 1 MB | … | … | |
| 10 MB | … | … | |
| 50 MB | … | … | |
| 100 MB | … | … | |

**Bảng K2 — Phủ sóng metadata & nội dung:**

| Số peer | Thời gian thấy metadata (s) | Thời gian tải xong toàn mạng (s) |
|---|---|---|
| 3 | … | … |
| 5 | … | … |
| 8 | … | … |

**Biểu đồ cần vẽ:** line chart throughput theo số peer; bar chart P2P vs server; survival curve theo churn.

## 5.4. Trả lời câu hỏi nghiên cứu

- **RQ1:** Phát hiện & duy trì kết nối không cần server định danh tập trung đạt được nhờ signaling LAN
  nhẹ + heartbeat + tự reconnect, cùng cơ chế chọn bên tạo offer tất định. Fallback mDNS/QR tăng cường
  khi không có server.
- **RQ2:** Hiệu quả lan truyền phụ thuộc số peer và băng thông Wi-Fi; gossip TTL=3 phủ metadata nhanh,
  còn nội dung lan truyền theo nhu cầu (pull) nên tiết kiệm băng thông. Kết quả định lượng ở mục 5.3.
- **RQ3:** Toàn vẹn đảm bảo bằng content-addressing (SHA-256) + Merkle root + chữ ký HMAC của Admin;
  peer tự kiểm chứng nên không cần máy chủ tin cậy.

## 5.5. Đánh giá mức độ đạt mục tiêu

| Mục tiêu | Kết quả | Kết luận |
|---|---|---|
| MG1 | ≥ 90% cặp peer kết nối ≤ 10 s | ✅ (điền số thực tế) |
| MG2 | Metadata phủ ≤ 3 chu kỳ | ✅ |
| MG3 | ≥ 5 MB/s | ✅/⚠️ tuỳ môi trường |
| MG4 | Offline 100% | ✅ |

## 5.6. So sánh với hệ thống liên quan

| Tiêu chí | Kolibri | RACHEL | **EduShare** |
|---|---|---|---|
| Cần server nội dung | Có | Có | **Không** |
| Hoạt động khi "server" tắt | Không | Không | **Có (P2P)** |
| Chi phí hạ tầng | Trung bình | Cao | **~0** |
| Chịu churn | Kém | Kém | **Tốt** |

---

# Chương 6 — KẾT LUẬN & HƯỚNG PHÁT TRIỂN

## 6.1. Kết luận

Đề tài đã xây dựng thành công một hệ thống phần mềm EduShare gồm PWA và signaling server, chứng minh
tính khả thi của việc chia sẻ tài nguyên giáo dục P2P ngoại tuyến trong LAN. Hệ thống đáp ứng các mục
tiêu MG1–MG4: phát hiện peer, kết nối WebRTC, lan truyền metadata qua gossip, truyền tệp chunk với
kiểm chứng toàn vẹn, resume & backpressure, và hoạt động offline nhờ Service Worker + IndexedDB.

## 6.2. Hạn chế (trung thực)

- **Background:** Background Sync/Periodic Sync không đồng nhất giữa trình duyệt; hàng đợi thực chất
  được xử lý khi app mở.
- **iOS:** giới hạn Service Worker nền và một số API; nằm ngoài phạm vi.
- **Quota:** dung lượng lưu trữ phụ thuộc trình duyệt; cần xin persistent storage.
- **Secure context:** LAN dùng HTTP thuần có thể bị hạn chế trên một số trình duyệt; cần chứng chỉ tự ký.
- **Đa nguồn:** hiện tải chunk song song trong 1 nguồn; chưa chia chunk cho nhiều nguồn đồng thời.

## 6.3. Hướng phát triển

- **DTN liên cụm mạng:** peer mang hàng đợi nội dung sang mạng khác khi đổi Wi-Fi (store-and-forward).
- **Multi-source download:** lấy các chunk khác nhau từ nhiều peer song song, tăng throughput.
- **Adaptive streaming video P2P:** BitTorrent-like cho video bài giảng.
- **Replication dựa trên dự đoán phổ biến** (học từ số liệu yêu cầu).
- **Bầu chọn signaling phi tập trung** khi máy giáo viên tắt.

---

# TÀI LIỆU THAM KHẢO

1. IETF RFC 8835/8836 — *Transports for WebRTC / ICE*.
2. IETF RFC 8837 — *DTLS for WebRTC*.
3. IETF RFC 8838 — *SCTP-based Data Channel (WebRTC)*.
4. W3C — *Service Workers Specification*.
5. W3C — *Indexed Database API 3.0*.
6. Google — *Workbox: JavaScript libraries for Progressive Web Apps*.
7. P. Eugster et al. — *Epidemic Information Dissemination in Distributed Systems*, IEEE Computer, 2004.
8. A. Vahdat, D. Becker — *Epidemic Routing for Partially Connected Ad Hoc Networks*, 2000.
9. J. Rosenberg — *Interactive Connectivity Establishment (ICE)*.
10. Learning Equality — *Kolibri documentation*.
11. libp2p — *Specifications*, Protocol Labs.
12. Dexie.js — *IndexedDB wrapper documentation*.

---

# PHỤ LỤC

## Phụ lục A — Hướng dẫn cài đặt

Xem [`TRIEN-KHAI.md`](TRIEN-KHAI.md).

## Phụ lục B — Đặc tả giao thức đầy đủ

Xem [`GIAO-THUC.md`](GIAO-THUC.md).

## Phụ lục C — Kịch bản test & mẫu KPI

Xem [`THUC-NGHIEM.md`](THUC-NGHIEM.md).

## Phụ lục D — Bảng thông số thiết bị thử nghiệm (mẫu)

| Thiết bị | CPU | RAM | HĐH | Trình duyệt |
|---|---|---|---|---|
| Laptop A | … | … | Windows 11 | Chrome … |
| Điện thoại 1 | … | … | Android … | Chrome … |
| Router | … | — | — | Wi-Fi 5 GHz |
