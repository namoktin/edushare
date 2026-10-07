# BÁO CÁO ĐỒ ÁN

## Mạng lưới chia sẻ tài nguyên giáo dục P2P ngoại tuyến ứng dụng WebRTC & Service Workers

**Tên hệ thống:** EduShare
**Loại sản phẩm:** Phần mềm (ứng dụng PWA + signaling server)
**Phiên bản tài liệu:** 2.0 (bản đầy đủ, tách chương)
**Năm thực hiện:** 2026

> Bản rút gọn của báo cáo (dạng một tệp) được lưu tại
> [`BAO-CAO-rut-gon.md`](BAO-CAO-rut-gon.md). Bản dưới đây là **bản đầy đủ**, được tách
> thành từng chương theo đúng cấu trúc và mốc số trang của đề cương gốc.

---

## Thông tin đồ án

| Mục | Nội dung |
|---|---|
| Trường / Khoa | *(điền)* |
| Ngành / Chuyên ngành | *(điền)* |
| Giảng viên hướng dẫn | *(điền)* |
| Sinh viên thực hiện | *(điền)* |
| Mã sinh viên | *(điền)* |
| Lớp | *(điền)* |
| Thời gian thực hiện | *(điền)* |

---

## Tóm tắt (Abstract)

Đồ án xây dựng **EduShare** — một hệ thống phần mềm cho phép chia sẻ tài nguyên giáo dục
theo mô hình mạng ngang hàng (P2P) trong mạng cục bộ (LAN), **hoạt động hoàn toàn không cần
Internet**. Hệ thống gồm hai thành phần trên cùng một cơ sở mã nguồn: (1) ứng dụng
Progressive Web App (PWA) chạy trên thiết bị của học sinh và giáo viên, tích hợp giao diện,
trình khách P2P, Service Worker và IndexedDB; (2) một **signaling server** nhẹ viết bằng
Node.js chỉ làm nhiệm vụ trung gian trao đổi SDP/ICE và chuyển tiếp metadata, không lưu trữ
nội dung. Kết nối dữ liệu giữa các thiết bị được thiết lập trực tiếp qua **WebRTC
DataChannel**; tài nguyên được chia nhỏ thành các đơn vị 256 KB, truyền có kiểm soát áp lực
bộ đệm (backpressure), hỗ trợ tạm dừng/tiếp tục (resume) và kiểm chứng toàn vẹn bằng
SHA-256 cùng cây Merkle. Metadata tài nguyên lan truyền trong mạng nhờ cơ chế **gossip**
giới hạn số hop, cho phép tìm kiếm nội dung qua nhiều nút. Ứng dụng có khả năng chạy ngoại
tuyến 100% sau lần cài đặt đầu tiên nhờ Service Worker và IndexedDB.

Báo cáo trình bày đầy đủ từ cơ sở lý thuyết, phân tích — thiết kế, hiện thực, đến thực
nghiệm và đánh giá, kèm các sơ đồ thiết kế và đặc tả giao thức. Kết quả kiểm chứng bước đầu
cho thấy hệ thống cài đặt và build thành công, bộ kiểm thử signaling đạt 6/6, và phần mã hóa
dự phòng SHA-256/HMAC khớp hoàn toàn với thư viện chuẩn của Node.js.

**Từ khoá:** WebRTC, DataChannel, Service Worker, PWA, IndexedDB, mạng P2P, gossip, giáo dục
ngoại tuyến, chia sẻ tệp, DTN.

---

## Mục lục

| Chương | Tên chương | Mốc trang | Tệp |
|---|---|---|---|
| — | Tài liệu gốc (đề cương yêu cầu) | — | [`../webRTC.MD`](../webRTC.MD) |
| **1** | Mở đầu | ≈ 10–15 | [`bao-cao/chuong-1-mo-dau.md`](bao-cao/chuong-1-mo-dau.md) |
| **2** | Cơ sở lý thuyết | ≈ 20–25 | [`bao-cao/chuong-2-co-so-ly-thuyet.md`](bao-cao/chuong-2-co-so-ly-thuyet.md) |
| **3** | Phân tích & thiết kế hệ thống | ≈ 25–30 | [`bao-cao/chuong-3-phan-tich-thiet-ke.md`](bao-cao/chuong-3-phan-tich-thiet-ke.md) |
| **4** | Triển khai | ≈ 20–25 | [`bao-cao/chuong-4-trien-khai.md`](bao-cao/chuong-4-trien-khai.md) |
| **5** | Thực nghiệm & đánh giá | ≈ 15–20 | [`bao-cao/chuong-5-thuc-nghiem-danh-gia.md`](bao-cao/chuong-5-thuc-nghiem-danh-gia.md) |
| **6** | Kết luận & hướng phát triển | ≈ 3–5 | [`bao-cao/chuong-6-ket-luan.md`](bao-cao/chuong-6-ket-luan.md) |
| — | Tài liệu tham khảo | — | [`bao-cao/tai-lieu-tham-khao.md`](bao-cao/tai-lieu-tham-khao.md) |
| — | Phụ lục | — | [`bao-cao/phu-luc.md`](bao-cao/phu-luc.md) |

---

## Cấu trúc chi tiết từng chương

### Chương 1 — Mở đầu (≈ 10–15 trang)
Lý do chọn đề tài; mục tiêu nghiên cứu (MG1–MG4); đối tượng & phạm vi; câu hỏi nghiên cứu
(RQ1–RQ3); ý nghĩa khoa học & thực tiễn; sản phẩm nghiên cứu; phương pháp nghiên cứu; bố cục
báo cáo. → [`bao-cao/chuong-1-mo-dau.md`](bao-cao/chuong-1-mo-dau.md)

### Chương 2 — Cơ sở lý thuyết (≈ 20–25 trang)
Tổng quan hệ thống chia sẻ tệp P2P; giao thức WebRTC (ICE/STUN/TURN/SDP/DTLS-SRTP,
RTCDataChannel, backpressure, signaling ngoài băng tần); PWA & Service Worker; lưu trữ cục bộ
trên trình duyệt; mạng chịu trễ (DTN); các hệ thống liên quan và khoảng trống nghiên cứu.
→ [`bao-cao/chuong-2-co-so-ly-thuyet.md`](bao-cao/chuong-2-co-so-ly-thuyet.md)

### Chương 3 — Phân tích & thiết kế hệ thống (≈ 25–30 trang)
Yêu cầu chức năng (F1–F7) và phi chức năng; use case & kiến trúc 4 tầng; thiết kế giao thức
mạng (phát hiện peer, định dạng tin nhắn, gossip, chọn nguồn, replication); thiết kế
IndexedDB; thiết kế Service Worker & offline-first; thiết kế bảo mật & mô hình phân quyền;
thiết kế giao diện UI/UX responsive.
→ [`bao-cao/chuong-3-phan-tich-thiet-ke.md`](bao-cao/chuong-3-phan-tich-thiet-ke.md)

### Chương 4 — Triển khai (≈ 20–25 trang)
Công nghệ & môi trường; kiến trúc mã nguồn; hiện thực các module chính (signaling server,
peer manager, gossip engine, file transfer, IndexedDB, Service Worker, giao diện PWA, fallback
mã hóa); demo hệ thống.
→ [`bao-cao/chuong-4-trien-khai.md`](bao-cao/chuong-4-trien-khai.md)

### Chương 5 — Thực nghiệm & đánh giá (≈ 15–20 trang)
Thiết lập thực nghiệm; kịch bản & chỉ số (K1–K5); kết quả & phân tích; trả lời RQ1–RQ3; đánh
giá mục tiêu MG1–MG4; so sánh với hệ thống liên quan; đe doạ tính hợp lệ.
→ [`bao-cao/chuong-5-thuc-nghiem-danh-gia.md`](bao-cao/chuong-5-thuc-nghiem-danh-gia.md)

### Chương 6 — Kết luận & hướng phát triển (≈ 3–5 trang)
Tổng kết theo mục tiêu; đóng góp; hạn chế; hướng phát triển; kết luận chung.
→ [`bao-cao/chuong-6-ket-luan.md`](bao-cao/chuong-6-ket-luan.md)

### Tài liệu tham khảo & Phụ lục
Danh mục 24 tài liệu theo chuẩn IEEE; phụ lục hướng dẫn cài đặt, bảng giao thức, kết quả kiểm
thử, thông số thiết bị và danh mục mã nguồn.
→ [`bao-cao/tai-lieu-tham-khao.md`](bao-cao/tai-lieu-tham-khao.md) ·
[`bao-cao/phu-luc.md`](bao-cao/phu-luc.md)

---

## Danh mục sơ đồ (Mermaid)

Các sơ đồ trong báo cáo được vẽ bằng **Mermaid**, hiển thị trực tiếp trên GitHub/GitLab hoặc
trình xem Markdown hỗ trợ Mermaid. Sơ đồ gồm các loại: kiến trúc (flowchart), tuần tự
(sequenceDiagram), thực thể (erDiagram), trạng thái (stateDiagram), luồng (flowchart),
biểu đồ (xychart) và lộ trình (gantt). Danh mục chi tiết nằm trong từng chương.

| Nhóm sơ đồ | Chương |
|---|---|
| Mô hình mạng P2P, luồng người dùng | Chương 1 |
| Bắt tay WebRTC, vòng đời Service Worker, so sánh P2P | Chương 2 |
| Use case, kiến trúc 4 tầng, sequence signaling, gossip, ER, phân quyền, wireframe UI | Chương 3 |
| Luồng publish/download/resume, trạng thái truyền, khởi tạo module | Chương 4 |
| Quy trình thực nghiệm, biểu đồ KPI (xychart) | Chương 5 |
| Lộ trình phát triển (gantt) | Chương 6 |
| Máy trạng thái giao thức | Phụ lục |

---

## Quy ước của báo cáo

- **Ngôn ngữ:** tiếng Việt; thuật ngữ kỹ thuật giữ nguyên tiếng Anh trong ngoặc khi cần.
- **Trích dẫn:** dạng `[n]` khớp danh mục IEEE trong [tài liệu tham khảo](bao-cao/tai-lieu-tham-khao.md).
- **Tham chiếu mã nguồn:** dạng `đường/dẫn/tệp:dòng`, ví dụ `app/src/lib/transfer.ts:264`.
- **Số liệu thực nghiệm** chưa đo đủ được để ở dạng bảng mẫu, ghi rõ *(mẫu — điền số liệu thực đo)*.
- **Sơ đồ:** dùng Mermaid trong khối mã ```` ```mermaid ````.

---

## Lịch sử phiên bản tài liệu

| Phiên bản | Thay đổi |
|---|---|
| 1.0 | Bản rút gọn một tệp (`BAO-CAO-rut-gon.md`) |
| 2.0 | Tách thành 6 chương + tài liệu tham khảo + phụ lục; chuyển sơ đồ sang Mermaid |

---

*Xem thêm tài liệu dự án:* [README](../README.md) ·
[Kiến trúc](KIEN-TRUC.md) ·
[Giao thức](GIAO-THUC.md) ·
[Triển khai](TRIEN-KHAI.md) ·
[Thực nghiệm](THUC-NGHIEM.md)
