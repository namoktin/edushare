# EduShare

> Mạng lưới chia sẻ tài nguyên giáo dục **P2P ngoại tuyến** cho lớp học, ứng dụng **WebRTC DataChannel** và **Service Worker**.
> Hoạt động trong mạng LAN, **không cần Internet**; tài nguyên đã tải xem được 100% offline.

Đây là mã nguồn minh hoạ (reference implementation) cho đề tài nghiên cứu
*"Mạng lưới chia sẻ tài nguyên giáo dục P2P ngoại tuyến ứng dụng WebRTC & Service Workers"*.

---

## 1. Sản phẩm gồm những gì?

Chỉ **một codebase phần mềm**, gồm 2 thành phần chạy trên thiết bị người dùng:

| Thành phần | Bản chất | Chạy ở đâu |
|---|---|---|
| **EduShare PWA** (`app/`) | Ứng dụng web/PWA: giao diện + P2P client + Service Worker + IndexedDB | Mọi thiết bị (điện thoại, laptop) của học sinh & giáo viên |
| **Signaling Server** (`signaling-server/`) | Chương trình Node.js nhẹ: trung gian trao đổi SDP/ICE + relay metadata, **không lưu nội dung** | Một máy bất kỳ trong LAN (thường là máy giáo viên) |

**Admin Node** (giáo viên) *không phải* sản phẩm riêng — chỉ là một peer đăng nhập với vai trò `admin`,
có thêm quyền ký (HMAC) và phát hành/thu hồi tài nguyên. Máy giáo viên tắt thì mạng P2P vẫn chạy.

---

## 2. Kiến trúc tổng quan

```
        ┌──────────── MẠNG LAN (Wi-Fi trường học, KHÔNG Internet) ────────────┐
        │                                                                     │
  ┌──────────┐   WebRTC DataChannel (P2P trực tiếp, DTLS)   ┌──────────┐
  │ Máy HS A │◄──────────────────────────────────────────► │ Máy HS B │
  │  (PWA)   │                                              │  (PWA)   │
  └────┬─────┘                                              └────┬─────┘
       │                                                     │
       │        ┌─────────────────────────┐                  │
       └───────►│  SIGNALING SERVER (LAN)  │◄─────────────────┘
                │  Node.js + WebSocket     │   chỉ trao đổi SDP/ICE + metadata
                │  máy giáo viên :8787     │
                └─────────────────────────┘
                         ▲
                ┌────────┴─────────┐
                │  ADMIN NODE (GV) │  ký HMAC, phát hành/thu hồi, thống kê
                │  cũng chạy PWA   │
                └──────────────────┘
```

- **4 tầng**: UI (PWA) → Mạng P2P (Signaling + PeerManager) → Giao thức (Gossip + Transfer) → Lưu trữ (IndexedDB/Service Worker).
- Chi tiết: [`docs/KIEN-TRUC.md`](docs/KIEN-TRUC.md) và [`docs/GIAO-THUC.md`](docs/GIAO-THUC.md).

---

## 3. Cấu trúc thư mục

```
EduShare/
├── README.md                  ← tài liệu này
├── package.json               ← script điều khiển cả dự án
├── webRTC.MD                  ← đề cương gốc (yêu cầu)
├── docs/                      ← tài liệu dự án
│   ├── BAO-CAO.md             ← BÁO CÁO ĐẦY ĐỦ (6 chương)
│   ├── KIEN-TRUC.md           ← thiết kế hệ thống & cơ sở dữ liệu
│   ├── GIAO-THUC.md           ← đặc tả giao thức tin nhắn P2P
│   ├── TRIEN-KHAI.md          ← hướng dẫn cài đặt & vận hành
│   └── THUC-NGHIEM.md         ← kịch bản thực nghiệm & mẫu bảng KPI
├── signaling-server/          ← Node.js + WebSocket
│   ├── server.js
│   ├── package.json
│   └── test/signaling.test.mjs
└── app/                       ← PWA (React + Vite + TypeScript + Tailwind + Dexie + Workbox)
    ├── public/                ← icon, manifest assets
    └── src/
        ├── lib/               ← protocol, crypto, db, signaling, peer, transfer, gossip, replication
        ├── store/AppContext.tsx
        ├── components/        ← StatusBar, ResourceCard, TransferRow, Modals…
        ├── screens/           ← Onboarding, Library, Devices, Transfers
        ├── sw.ts              ← Service Worker (offline-first)
        └── App.tsx            ← layout responsive (tab mobile / sidebar laptop)
```

---

## 4. Chạy nhanh (quick start)

Yêu cầu: **Node.js ≥ 18** (khuyến nghị v20/v22). Không cần database, không cần Nginx/Apache.

```bash
# 1) Cài phụ thuộc cho cả hai thành phần
npm run install:all

# 2) Build giao diện PWA
npm run build

# 3) Chạy signaling server (đồng thời phục vụ luôn PWA tĩnh tại app/dist)
npm start
# -> mở http://<IP-LAN>:8787 trên mọi thiết bị cùng Wi-Fi
```

Mở ứng dụng trên **2 thiết bị trở lên** cùng mạng Wi-Fi, cùng **mã lớp** (room) → thấy nhau ở tab *Lớp học*.

### Chế độ phát triển (hot reload)

```bash
npm run dev:server     # terminal 1 - signaling :8787
npm run dev:app        # terminal 2 - Vite :5173  (tự trỏ signaling sang :8787)
```

---

## 5. Chạy kiểm thử

```bash
npm test          # 6 kiểm thử chức năng signaling (tự dựng & tắt server)
npm run typecheck # kiểm tra kiểu TypeScript
```

---

## 6. Tính năng đã hiện thực

- [x] **Phát hiện peer** trong LAN qua signaling server (WebSocket, có heartbeat).
- [x] **Kết nối P2P** trực tiếp bằng WebRTC DataChannel (ICE host candidate, không cần STUN/TURN khi offline).
- [x] **Giao thức JSON** đầy đủ: `HELLO / PEER_LIST / RESOURCE_ADVERTISE / RESOURCE_QUERY / RESOURCE_RESPONSE / CHUNK_REQUEST / CHUNK_DATA / TRANSFER_COMPLETE / VERIFY`.
- [x] **Truyền tệp chia nhỏ** 256 KB, kiểm chứng **SHA-256** và **Merkle root**.
- [x] **Resume** tải bị gián đoạn (lưu từng chunk vào IndexedDB).
- [x] **Backpressure** kiểm soát `bufferedAmount` của DataChannel.
- [x] **Gossip metadata** nhiều hop với TTL để tìm tài nguyên trên mạng.
- [x] **Replication** tự động theo mức độ phổ biến (số lượt yêu cầu).
- [x] **Offline-first**: Service Worker (Workbox) cache app shell; nội dung lưu IndexedDB xem lại không cần mạng.
- [x] **Admin Node**: ký metadata bằng HMAC-SHA256, peer khác kiểm chứng chữ ký khi xem.
- [x] **UI responsive** tiếng Việt: 3 tab trên mobile, sidebar 2 cột trên laptop.

---

## 7. Lưu ý kỹ thuật

- **Secure context**: `WebRTC`/Service Worker yêu cầu HTTPS hoặc `localhost`. Khi demo qua IP LAN bằng HTTP thuần,
  một số trình duyệt vẫn cho phép `RTCPeerConnection` với DataChannel, nhưng để chắc chắn hãy dùng
  chứng chỉ tự ký nội bộ hoặc mở qua `localhost`. Xem mục "Rủi ro" trong [`docs/TRIEN-KHAI.md`](docs/TRIEN-KHAI.md).
- **Cổng mặc định** là `8787` (đổi bằng biến môi trường `PORT`, và chỉnh `defaultUrl()` trong `app/src/lib/signaling.ts` nếu khác).
- **iOS**: không nằm trong phạm vi (giới hạn Service Worker/background). Xem báo cáo Chương 6.

---

## 8. Giấy phép

Mã nguồn phục vụ mục đích học thuật/nghiên cứu. Sử dụng tự do cho mục đích giáo dục.
