# HƯỚNG DẪN TRIỂN KHAI & VẬN HÀNH EDU SHARE

Hướng dẫn từ A→Z để dựng hệ thống trong một lớp học (LAN, không Internet).

---

## 1. Yêu cầu

| Hạng mục | Tối thiểu | Khuyến nghị |
|---|---|---|
| CPU (máy signaling) | 2 nhân (2012+) | — |
| RAM | 512 MB tự do | 1 GB |
| Ổ cứng | < 200 MB | — |
| Phần mềm | **Node.js ≥ 18** | Node.js LTS v20/v22 |
| Mạng | Wi-Fi/LAN chung lớp | Wi-Fi 5 GHz ổn định |
| Số peer đồng thời | — | 50–100 thiết bị |

Hỗ trợ **Windows 10/11, Linux (Ubuntu/Debian), macOS**. Không cần database, Nginx, tên miền hay SSL.

---

## 2. Cài đặt nhanh

```bash
git clone <repo> EduShare       # hoặc copy thư mục
cd EduShare
npm run install:all             # cài deps cho server + app
npm run build                   # build PWA -> app/dist
npm start                       # chạy signaling server (:8787)
```

Sau khi chạy, terminal hiển thị:

```
==========================================================
  EduShare Signaling Server
  Đang lắng nghe tại http://0.0.0.0:8787
  PWA tĩnh: /…/app/dist
  Nhấn Ctrl+C để dừng
==========================================================
```

Tìm **IP LAN** của máy giáo viên:

- Windows: `ipconfig` → dòng `IPv4 Address` (vd `192.168.1.10`).
- Linux/macOS: `hostname -I` hoặc `ip addr`.

Trên mọi thiết bị học sinh cùng Wi-Fi, mở:

```
http://192.168.1.10:8787
```

Chọn **"Thêm vào màn hình chính / Add to Home Screen"** để cài như app.

---

## 3. Cấu hình cổng

Mặc định cổng **8787**. Đổi bằng biến môi trường:

```bash
PORT=9000 npm start              # Linux/macOS
set PORT=9000 && npm start       # Windows CMD
$env:PORT=9000; npm start        # Windows PowerShell
```

Nếu đổi cổng, chỉnh `defaultUrl()` trong `app/src/lib/signaling.ts` rồi build lại:

```ts
const port = location.port === '5173' || location.port === '' ? '9000' : location.port;
```

> **Lưu ý:** kiểm tra cổng đang bận: `ss -ltn` (Linux) hoặc `netstat -ano | findstr :8787` (Windows).

---

## 4. Chế độ phát triển (dev)

```bash
npm run dev:server   # signaling :8787
npm run dev:app      # Vite :5173 (tự trỏ signaling sang :8787)
```

Mở `http://localhost:5173`. Vite proxy WebSocket trực tiếp tới `127.0.0.1:8787`.

---

## 5. Cài đặt trên thiết bị người dùng (PWA)

1. Mở `http://<IP>:8787` bằng Chrome/Edge/Firefox.
2. Điện thoại Android: menu trình duyệt → *Thêm vào Màn hình chính*.
3. Laptop: biểu tượng cài đặt (⊕) trên thanh địa chỉ.
4. Nhập **tên thiết bị** và **mã lớp** (mọi máy cùng mã lớp sẽ thấy nhau).
5. Chọn vai trò:
   - Học sinh → *Learner Node*.
   - Giáo viên → *Admin Node* (nhập khoá ký lớp, mặc định `edushare-class-secret`).

---

## 6. Kịch bản dùng thử

1. Máy Admin bấm **➕ Tải tài nguyên lên**, chọn tệp, điền môn/lớp → **Chia sẻ vào mạng lớp**.
2. Máy học sinh mở tab **📚 Thư viện**, bấm **🌐 Tìm trên mạng lớp** nếu chưa thấy.
3. Bấm **⬇️ Tải** → theo dõi ở tab **⬆️ Đang truyền**.
4. Rút Wi-Fi giữa chừng → **Tạm dừng**; cắm lại → **Tiếp tục** (resume).
5. Tải xong → **Xem ngay** (offline). Tắt signaling/mạng, mở lại app vẫn xem được.

---

## 7. Secure context (WebRTC/Service Worker) — điểm cần lưu ý

Trình duyệt yêu cầu **secure context** (HTTPS hoặc `localhost`) cho `getUserMedia` và Service Worker.
Với DataChannel thuần, nhiều trình duyệt vẫn cho phép qua HTTP LAN, nhưng không đảm bảo.

**Giải pháp khi demo qua IP LAN bằng HTTP:**

| Cách | Mô tả |
|---|---|
| Dùng `localhost` | Demo 2–3 cửa sổ trên cùng máy bằng `http://localhost:8787` |
| Chứng chỉ tự ký | Tạo cert cho IP LAN, phục vụ HTTPS |
| Chrome flag (tạm thời) | `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → thêm `http://192.168.1.10:8787` |
| Đóng gói file | Chạy PWA ở chế độ `file://` (một số trình duyệt coi là secure) |

**Tạo chứng chỉ tự ký** (Linux/macOS, có `openssl`):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 3650 \
  -subj "/CN=192.168.1.10"
```

Sau đó bọc HTTPS cho server (có thể dùng `https.createServer` với `cert.pem`/`key.pem`),
hoặc đặt sau một reverse proxy HTTPS. Khi đó WebSocket dùng `wss://`.

---

## 8. Kiểm thử & kiểm tra

```bash
npm test            # 6 test signaling (tự dựng/tắt server)
npm run typecheck   # kiểm tra kiểu
curl http://localhost:8787/health
curl "http://localhost:8787/peers?room=lop-9a"
```

---

## 9. Khắc phục sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Không thấy thiết bị khác | Khác mã lớp / khác mạng | Kiểm tra room và Wi-Fi |
| Đứng ở "Đang tìm thiết bị" | Sai cổng signaling / firewall | Mở cổng 8787; kiểm tra `defaultUrl` |
| Không tải được | Chưa có peer giữ bản gốc | Admin/học sinh khác phải còn online |
| SW không cache | HTTP không phải localhost | Dùng HTTPS/localhost (mục 7) |
| Trình duyệt xoá dữ liệu | Thiếu quota | Cấp persistent storage, giải phóng ổ đĩa |
| Port bận | Trùng cổng | Đổi `PORT` |

**Mở firewall (Windows):**

```powershell
New-NetFirewallRule -DisplayName "EduShare 8787" -Direction Inbound -LocalPort 8787 -Protocol TCP -Action Allow
```

**Mở firewall (Ubuntu ufw):**

```bash
sudo ufw allow 8787/tcp
```

---

## 10. Cập nhật phiên bản

1. Cập nhật mã nguồn → `npm run build`.
2. Service Worker (`registerType: 'autoUpdate'`) tự phát hiện bản mới; người dùng mở lại app để nhận.

---

## 11. Gỡ cài đặt

- Dừng server: `Ctrl+C`.
- Xoá dữ liệu app: trong trình duyệt → *Xoá dữ liệu trang / Clear site data*.
- Xoá mã nguồn: xoá thư mục `EduShare`.
