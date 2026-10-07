# THỰC NGHIỆM & ĐO LƯỜNG (KPI)

Tài liệu hướng dẫn thiết lập, chạy và thu thập số liệu thực nghiệm cho EduShare,
kèm mẫu bảng KPI để điền vào Chương 5 của báo cáo.

---

## 1. Thiết lập môi trường

| Hạng mục | Cấu hình |
|---|---|
| Số thiết bị | 5–10 (2 laptop + 3–6 Android) |
| Mạng | Router Wi-Fi nội bộ, **ngắt Internet** |
| Signaling | 1 laptop chạy `npm start` |
| Bộ dữ liệu | 20 tệp, 1–100 MB (PDF/video/audio) |
| Trình duyệt | Chrome/Edge ≥ 110, Firefox ≥ 110 |
| Số lần chạy | ≥ 30 lần/kịch bản |

**Chuẩn bị tệp mẫu** (Linux/macOS):

```bash
mkdir -p ~/edushare-data && cd ~/edushare-data
for s in 1 10 25 50 100; do
  head -c ${s}M /dev/urandom > "file-${s}MB.bin"
done
```

---

## 2. Kịch bản & chỉ số

### K1 — Tải 1 tệp giữa 2 peer

- **Mục tiêu:** đo throughput và thời gian bắt tay.
- **Cách làm:** 2 peer cùng lớp; peer A phát hành tệp; peer B tải; ghi lại.
- **Chỉ số:** throughput (MB/s), thời gian bắt tay (s), thời gian hoàn tất (s).
- **Nguồn số liệu:** trường `speed` trong `transfers`, `value` trong `stats`.

### K2 — Phủ sóng tới N peer

- **Mục tiêu:** thời gian để N peer đều thấy và tải xong 1 tệp.
- **Cách làm:** lần lượt N = 3, 5, 8 peer cần tải cùng tệp (A giữ bản gốc).
- **Chỉ số:** thời gian thấy metadata (s), thời gian tải xong toàn mạng (s).

### K3 — Churn

- **Mục tiêu:** độ bền khi peer nguồn rời mạng.
- **Cách làm:** tắt ngẫu nhiên 10–30% peer giữa chừng.
- **Chỉ số:** tỉ lệ tải thành công (%), thời gian phục hồi (s).

### K4 — P2P vs server trung tâm

- **Mục tiêu:** so sánh thời gian phân phối và tải máy chủ.
- **Cách làm:** phân phối cùng bộ tệp cho N peer theo 2 cách.
- **Chỉ số:** tổng thời gian (s), băng thông qua máy chủ (MB).

### K5 — Mở offline

- **Mục tiêu:** thời gian phục vụ nội dung từ cache/IndexedDB.
- **Cách làm:** ngắt mạng hoàn toàn, mở lại app, mở tệp đã tải.
- **Chỉ số:** thời gian từ bấm "Xem ngay" đến hiển thị (ms).

---

## 3. Thu thập số liệu

### 3.1. Từ giao diện

- Tab **⬆️ Đang truyền** hiển thị tiến trình và tốc độ MB/s theo thời gian thực.
- Tab **👥 Lớp học** hiển thị nhật ký hoạt động (kết nối, quảng bá, tải xong).

### 3.2. Từ IndexedDB (Console trình duyệt)

Mở DevTools → Console:

```js
// Liệt kê toàn bộ số liệu sự kiện
const db = indexedDB.open('edushare');
// (đơn giản nhất: dùng ứng dụng) hoặc import Dexie trong bundless:
[...document.querySelectorAll('*')], console.log('Xem tab Đang truyền');

// Xuất bảng transfers:
const req = indexedDB.open('edushare');
req.onsuccess = () => {
  const tx = req.result.transaction('stats').objectStore('stats').getAll();
  tx.onsuccess = () => console.table(tx.result);
};
```

### 3.3. Từ server

```bash
curl "http://localhost:8787/health"     # uptime, số room
curl "http://localhost:8787/peers?room=lop-9a"
```

### 3.4. Kiểm thử tự động tầng signaling

```bash
npm test    # 6 test: welcome, join, advertise, query, signal relay, leave
```

---

## 4. Mẫu bảng KPI (điền số)

**K1 — Throughput (TB ± độ lệch chuẩn, n = 30):**

| Kích thước | Throughput (MB/s) | Bắt tay (s) | Hoàn tất (s) |
|---|---|---|---|
| 1 MB | | | |
| 10 MB | | | |
| 50 MB | | | |
| 100 MB | | | |

**K2 — Phủ sóng:**

| N peer | Thấy metadata (s) | Tải xong toàn mạng (s) | Tỉ lệ thành công (%) |
|---|---|---|---|
| 3 | | | |
| 5 | | | |
| 8 | | | |

**K3 — Churn (nguồn bị tắt ngẫu nhiên):**

| % peer tắt | Tỉ lệ tải thành công (%) | Thời gian phục hồi (s) |
|---|---|---|
| 10% | | |
| 20% | | |
| 30% | | |

**K4 — P2P vs Server:**

| Tiêu chí | P2P | Server trung tâm |
|---|---|---|
| Tổng thời gian phân phối (s) | | |
| Băng thông máy chủ (MB) | 0 | |
| Tải trung bình mỗi peer (%) | | |

**K5 — Offline:**

| Hành động | Thời gian (ms) |
|---|---|
| Mở app offline | |
| Mở PDF từ cache | |
| Phát video từ cache | |

---

## 5. Vẽ biểu đồ

- **Line chart:** throughput theo số peer (K1/K2).
- **Bar chart:** P2P vs server (K4).
- **Survival curve:** tỉ lệ thành công theo % churn (K3).

Có thể dùng thư viện Chart.js/Recharts khi bổ sung màn hình "Thống kê" (hướng phát triển).

---

## 6. Ghi chú phương pháp

- Mỗi lần chạy dùng tệp mới (tránh cache).
- Xoá dữ liệu trang giữa các lần chạy để đảm bảo điều kiện đồng nhất.
- Ghi lại nhiệt độ/tải thiết bị nếu đo trên điện thoại yếu.
- Loại bỏ giá trị ngoại lai (outlier) khi tính trung bình.
