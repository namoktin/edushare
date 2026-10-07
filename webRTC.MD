# CẤU TRÚC BÁO CÁO & KẾ HOẠCH TRIỂN KHAI
## Đề tài: Mạng lưới chia sẻ tài nguyên giáo dục P2P ngoại tuyến ứng dụng WebRTC & Service Workers

---

# PHẦN I — CẤU TRÚC BÁO CÁO

## Chương 1: MỞ ĐẦU (≈ 10–15 trang)

**1.1. Lý do chọn đề tài**
- Bức tranh khoảng trống số trong giáo dục (vùng thiếu Internet ổn định)
- Hạn chế của mô hình client–server tập trung (điểm nghẽn, chi phí, độ tin cậy)
- Tiềm năng của mô hình P2P ngoại tuyến

**1.2. Mục tiêu nghiên cứu**
- Mục tiêu tổng quát: xây dựng hệ thống chia sẻ tài nguyên giáo dục hoạt động hoàn toàn không cần Internet
- Mục tiêu cụ thể (định lượng được):
  - MG1: Thiết kế giao thức phát hiện và kết nối peer trong mạng LAN
  - MG2: Xây dựng cơ chế lan truyền tài nguyên (gossip/replication)
  - MG3: Đạt tốc độ truyền tối thiểu X MB/s giữa 2 thiết bị trong LAN
  - MG4: Ứng dụng hoạt động offline 100% sau lần cài đặt đầu tiên

**1.3. Đối tượng & phạm vi nghiên cứu**
- Phạm vi trong: mạng LAN/Wi-Fi Direct, thiết bị Android + desktop, PWA
- Phạm vi ngoài: iOS (nêu lý do giới hạn), mạng di động WAN, thuật toán AI

**1.4. Câu hỏi nghiên cứu (Research Questions)**
- RQ1: Làm sao phát hiện và duy trì kết nối giữa các peer khi không có server định danh?
- RQ2: Tài nguyên lan truyền trong mạng hiệu quả như thế nào (băng thông, thời gian, tỉ lệ thành công)?
- RQ3: Làm sao đảm bảo toàn vẹn dữ liệu khi không có máy chủ kiểm chứng?

**1.5. Ý nghĩa khoa học & thực tiễn**

**1.6. Bố cục báo cáo**

---

## Chương 2: CƠ SỞ LÝ THUYẾT (≈ 20–25 trang)

**2.1. Tổng quan hệ thống chia sẻ tệp P2P**
- Kiến trúc P2P: pure vs hybrid, structured (DHT: Chord, Kademlia) vs unstructured (gossip, flooding)
- Các hệ thống tiêu biểu: BitTorrent, IPFS/libp2p, Freenet — bảng so sánh

**2.2. Giao thức WebRTC**
- Kiến trúc: ICE, STUN/TURN, SDP, DTLS-SRTP
- **RTCDataChannel**: reliable/unreliable mode, SCTP, kích thước chunk, backpressure (bufferedAmount)
- Trao đổi SDP trong môi trường offline (signaling ngoài băng tần — out-of-band)

**2.3. Progressive Web App & Service Worker**
- Vòng đời Service Worker (install → activate → fetch → terminate)
- Các chiến lược cache: CacheFirst, NetworkFirst, StaleWhileRevalidate
- Background Sync API, Periodic Background Sync, Storage API & persistent storage

**2.4. Lưu trữ cục bộ trên trình duyệt**
- So sánh: LocalStorage vs Cache Storage vs IndexedDB (bảng: dung lượng, kiểu dữ liệu, hiệu năng)
- IndexedDB: object store, index, transaction, giới hạn quota

**2.5. Mạng chịu trễ (Delay-Tolerant Networking — DTN)**
- Mô hình store-and-forward, epidemic routing
- Ứng dụng vào bài toán "mang nội dung giữa các cụm mạng"

**2.6. Các nghiên cứu & hệ thống liên quan**
- Kolibri (Learning Equality), RACHEL, Internet-in-a-Box — mô hình server cục bộ
- Bảng so sánh hệ thống đề xuất vs. các hệ thống hiện có → **rút ra khoảng trống nghiên cứu**

---

## Chương 3: PHÂN TÍCH & THIẾT KẾ HỆ THỐNG (≈ 25–30 trang)

**3.1. Yêu cầu chức năng**
| Mã | Chức năng | Ưu tiên |
|---|---|---|
| F1 | Phát hiện peer trong LAN | Must |
| F2 | Chia sẻ/tải tài nguyên P2P | Must |
| F3 | Tìm kiếm tài nguyên qua nhiều hop | Must |
| F4 | Xem nội dung offline qua Service Worker | Must |
| F5 | Resume tải bị gián đoạn | Should |
| F6 | Đồng bộ hóa khi có Internet | Should |
| F7 | Cơ chế kiểm chứng nội dung | Should |

**3.2. Yêu cầu phi chức năng**: hiệu năng, khả năng chịu lỗi (churn), bảo mật, khả năng mở rộng, tiêu thụ pin/tài nguyên thiết bị yếu

**3.3. Use case & sơ đồ tổng quan kiến trúc**
- Sơ đồ use case (tác nhân: Học sinh, Giáo viên/Admin Node)
- Sơ đồ kiến trúc tổng thể 4 tầng (đã trình bày ở phần trước)
- Sơ đồ tuần tự: thiết lập kết nối WebRTC qua signaling LAN

**3.4. Thiết kế giao thức mạng (phần có giá trị nghiên cứu nhất)**
- **3.4.1. Phát hiện peer**: mDNS → fallback WebSocket LAN → fallback QR/SDP thủ công
- **3.4.2. Định dạng tin nhắn giao thức** (JSON message types):
  ```
  HELLO / PEER_LIST / RESOURCE_ADVERTISE /
  RESOURCE_QUERY / RESOURCE_RESPONSE /
  CHUNK_REQUEST / CHUNK_DATA / TRANSFER_COMPLETE / VERIFY
  ```
- **3.4.3. Gossip metadata**: mỗi peer duy trì bảng `resourceId → {peers[], version, checksum, ttl}`; chu kỳ gossip Δt, giới hạn hop (TTL)
- **3.4.4. Thuật toán lựa chọn nguồn tải**: chọn peer có độ trễ thấp nhất + ít peer đang tải từ nó (load balancing đơn giản)
- **3.4.5. Chiến lược replication**: file có mức "phổ biến" (tần suất được yêu cầu) cao → tự sao chép sang peer mới sau khi tải xong → đảm bảo khả năng sống của nội dung
- Pseudocode các thuật toán chính (2–3 thuật toán: gossip, chọn nguồn, replication)

**3.5. Thiết kế cơ sở dữ liệu cục bộ (IndexedDB)**
- Schema: `resources`, `chunks`, `peers`, `sync_queue`, `stats`
- Sơ đồ ER + lý do chọn cấu trúc

**3.6. Thiết kế Service Worker & offline-first**
- Chiến lược cache theo loại tài nguyên
- Luồng Background Sync cho hàng đợi đồng bộ

**3.7. Thiết kế bảo mật**
- DTLS của WebRTC, chữ ký HMAC metadata bởi node giáo viên, kiểm chứng Merkle hash per chunk
- Mô hình "Admin Node" có quyền phát hành/ thu hồi tài nguyên

---

## Chương 4: TRIỂN KHAI (≈ 20–25 trang)

**4.1. Công nghệ & môi trường**: bảng công nghệ + phiên bản + lý do chọn

**4.2. Kiến trúc mã nguồn** (tree thư mục + giải thích từng module)

**4.3. Hiện thực các module chính** (mỗi module: mục đích → sơ đồ → code tiêu biểu → giải thích):
- 4.3.1. Signaling server LAN
- 4.3.2. Peer manager & kết nối DataChannel
- 4.3.3. Gossip engine
- 4.3.4. File transfer (chunking, resume, backpressure)
- 4.3.5. IndexedDB layer (Dexie.js)
- 4.3.6. Service Worker (Workbox + custom sync)
- 4.3.7. Giao diện PWA

**4.4. Demo hệ thống**: ảnh chụp màn hình các tình huống (phát hiện peer, tải file, ngắt kết nối giữa chừng, mở offline)

---

## Chương 5: THỰC NGHIỆM & ĐÁNH GIÁ (≈ 15–20 trang)

**5.1. Thiết lập thực nghiệm**
- Môi trường: N thiết bị (ví dụ 5–10: điện thoại Android + laptop), router Wi-Fi nội bộ, không Internet
- Bộ dữ liệu tài nguyên: ví dụ 20 file, phân bố kích thước 1–100 MB

**5.2. Kịch bản thử nghiệm & chỉ số đo (KPI)**

| Kịch bản | Chỉ số đo |
|---|---|
| Tải 1 file giữa 2 peer | Throughput (MB/s), độ trễ thiết lập kết nối |
| 1 file → lan truyền tới N peer | Thời gian phủ sóng toàn mạng |
| Churn: peer rời mạng ngẫu nhiên | Tỉ lệ tải thành công, thời gian phục hồi |
| So sánh P2P vs server trung tâm (máy giáo viên) | Tổng thời gian phân phối, tải server |
| Mở offline sau khi đã tải | Thời gian phục vụ từ cache |

**5.3. Kết quả & phân tích**: bảng số liệu + biểu đồ (line chart throughput theo số peer, bar chart so sánh P2P vs server, survival curve theo churn)

**5.4. Trả lời các câu hỏi nghiên cứu RQ1–RQ3**

**5.5. Đánh giá mức độ đạt được mục tiêu MG1–MG4**

**5.6. So sánh với hệ thống liên quan (Kolibri...)**

---

## Chương 6: KẾT LUẬN & HƯỚNG PHÁT TRIỂN (≈ 3–5 trang)
- Kết luận theo mục tiêu
- Hạn chế (trung thực: background, iOS, quota)
- Hướng phát triển: DTN liên cụm mạng, tối ưu video adaptive streaming qua P2P, nghiên cứu replication dựa trên mức độ phổ biến dự đoán

**TÀI LIỆU THAM KHẢO** (chuẩn IEEE): RFC 8835/8836 (ICE), RFC 8837 (DTLS), RFC 8838 (SCTP/WebRTC), W3C Service Worker spec, bài báo gossip (Eugster et al.), DTN (Vahdat & Becker 2000), tài liệu libp2p/Workbox chính thức.

**PHỤ LỤC**: source code, hướng dẫn cài đặt, bảng thông số thiết bị thử nghiệm.

---

# PHẦN II — CÁC BƯỚC TRIỂN KHAI

## Giai đoạn 0: Chuẩn bị (Tuần 1–2)
1. Khảo sát thực tế (nếu có thể): 1 trường/lớp có nhu cầu → xác nhận use case thật
2. Dựng môi trường: repo Git, CI đơn giản, thiết bị thử nghiệm (tối thiểu 2 laptop + 2 điện thoại Android + 1 router)
3. Spike công nghệ: chạy thử WebRTC DataChannel giữa 2 trình duyệt trong cùng LAN

## Giai đoạn 1: Prototype lõi P2P (Tuần 3–6) ✅ **Milestone M1: 2 peer truyền file được**
- Bước 1.1: Signaling thủ công (copy-paste SDP) để hiểu bản chất WebRTC
- Bước 1.2: Đóng gói file thành chunk (256KB), truyền qua DataChannel reliable, kiểm chứng SHA-256
- Bước 1.3: Resume: lưu chunk đã nhận vào IndexedDB, reconnect thì hỏi lại chunk thiếu
- Bước 1.4: Backpressure: kiểm soát `bufferedAmount`, dừng gửi khi đầy

## Giai đoạn 2: Mạng nhiều peer + discovery (Tuần 7–11) ✅ **Milestone M2: N peer tự phát hiện và tìm thấy tài nguyên**
- Bước 2.1: Signaling server LAN (Node.js + WebSocket) chạy trên máy giáo viên
- Bước 2.2: mDNS discovery (thử nghiệm giới hạn trình duyệt, ghi nhận kết quả)
- Bước 2.3: Định nghĩa message protocol (JSON), bảng tin nhắn chuẩn
- Bước 2.4: Gossip engine: quảng bá & truy vấn metadata qua nhiều hop (TTL=3)
- Bước 2.5: Multi-source download (tải chunk khác nhau từ nhiều peer song song — nếu kịp, không thì để hướng phát triển)

## Giai đoạn 3: Offline-first & PWA (Tuần 12–15) ✅ **Milestone M3: Mở lại app offline xem được nội dung**
- Bước 3.1: Service Worker + Workbox: cache shell + tài nguyên đã tải
- Bước 3.2: IndexedDB hoàn chỉnh (Dexie): schema, index tìm kiếm theo môn/lớp
- Bước 3.3: Background Sync: hàng đợi thống kê/đồng bộ
- Bước 3.4: UI hoàn chỉnh: danh sách peer, thư viện tài nguyên, tiến trình tải, trình xem PDF/video offline
- Bước 3.5: Xin persistent storage, xử lý quota

## Giai đoạn 4: Tính năng nâng cao & bảo mật (Tuần 16–18)
- Bước 4.1: Admin node: ký metadata (HMAC), phát hành tài nguyên mới
- Bước 4.2: Replication tự động theo mức phổ biến (đếm số lượt yêu cầu)
- Bước 4.3: Store-and-forward cơ bản: peer mang hàng đợi sang mạng khác khi đổi Wi-Fi

## Giai đoạn 5: Thực nghiệm & đo lường (Tuần 19–22) ✅ **Milestone M4: Bộ số liệu hoàn chỉnh**
- Bước 5.1: Viết kịch bản test tự động (script giả lập peer trên nhiều trình duyệt headless)
- Bước 5.2: Chạy 4 kịch bản đo ở mục 5.2, thu ít nhất 30 lần chạy/kịch bản
- Bước 5.3: Vẽ biểu đồ, phân tích, trả lời RQ

## Giai đoạn 6: Viết báo cáo (song song từ tuần 10, hoàn thiện tuần 23–26)
- Viết Chương 1–2 trong khi chờ code giai đoạn 2
- Chương 3 viết ngay sau khi thiết kế xong (tuần 11)
- Chương 4 viết dần theo module, chụp demo khi hoàn thành giai đoạn 3
- Chương 5 sau giai đoạn 5; Chương 6 + chỉnh sửa toàn văn cuối

---

## ⏱️ Tóm tắt tiến độ & rủi ro lịch trình

| Tuần | Hồ sơ công việc | Milestone |
|---|---|---|
| 1–2 | Khảo sát, môi trường, spike | — |
| 3–6 | Prototype 2-peer transfer | **M1** |
| 7–11 | Discovery, gossip, N-peer | **M2** |
| 12–15 | PWA, IndexedDB, SW | **M3** |
| 16–18 | Bảo mật, replication | — |
| 19–22 | Thực nghiệm, số liệu | **M4** |
| 23–26 | Hoàn thiện báo cáo | 🏁 |

**Rủi ro cần đệm thời gian:** mDNS hoạt động không ổn định (đệm 1 tuần, có fallback sẵn), hiệu năng trên điện thoại yếu (đệm 1 tuần để tối ưu chunk size).

---

Bạn có muốn mình bổ sung chi tiết một phần cụ thể — ví dụ **schema tin nhắn giao thức đầy đủ**, **sơ đồ use case chi tiết**, hay **kịch bản test + bảng KPI mẫu để điền số liệu** không?

Sản phẩm của đề tài là PHẦN MỀM — cụ thể là một hệ thống gồm các thành phần phần mềm chạy trên thiết bị của người dùng. "Admin Node" không phải một sản phẩm riêng, mà là một thiết bị chạy cùng phần mềm đó, nhưng được gán quyền cao hơn trong mạng.
Phân tích rõ ràng
1. Sản phẩm là gì?
Sản phẩm nghiên cứu gồm 3 thành phần phần mềm:
Bảng
Thành phần	Bản chất	Chạy ở đâu
EduShare PWA (tên gọi gợi ý)	Ứng dụng web/PWA — giao diện, P2P client, Service Worker, IndexedDB	Mọi thiết bị (điện thoại, máy tính bảng, laptop) của học sinh và giáo viên
Signaling Server	Chương trình nhẹ (Node.js + WebSocket), chỉ làm trung gian trao đổi SDP, không lưu nội dung	Một máy bất kỳ trong LAN (thường là máy giáo viên)
Admin Tool (gói cấu hình)	Bộ tính năng bên trong PWA được bật bằng khóa/quyền	Cùng chạy trên PWA
➡️ Chỉ có MỘT codebase phần mềm duy nhất. Không có phần cứng hay thiết bị chuyên dụng nào cả.
2. Admin Node là gì?
Trong mạng P2P, mỗi thiết bị gọi là một node (peer). Tùy vai trò người dùng, node mang quyền khác nhau:
plain
┌─────────────────────────────────────────────┐
│              MẠNG P2P (tất cả chạy cùng     │
│               phần mềm EduShare PWA)        │
│                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │Node học  │   │Node học  │   │Node học  │ │
│  │sinh A    │◄─►│sinh B    │◄─►│sinh C    │ │
│  │(quyền đọc│   │(quyền đọc│   │(quyền đọc│ │
│  │+ chia sẻ)│   │+ chia sẻ)│   │+ chia sẻ)│ │
│  └──────────┘   └──────────┘   └──────────┘ │
│       ▲              ▲              ▲       │
│       └──────────────┼──────────────┘       │
│                      ▼                      │
│              ┌──────────────┐               │
│              │ ADMIN NODE   │               │
│              │ (máy giáo    │               │
│              │  viên)       │               │
│              │ • Ký/phát    │               │
│              │   hành tài   │               │
│              │   nguyên     │               │
│              │ • Thu hồi    │               │
│              │ • Thống kê   │               │
│              │ • Có thể đồng│               │
│              │   thời chạy  │               │
│              │   signaling  │               │
│              │   server     │               │
│              └──────────────┘               │
└─────────────────────────────────────────────┘
Admin Node = một chiếc laptop của giáo viên chạy đúng phần mềm PWA đó, nhưng đăng nhập bằng tài khoản "giáo viên" nên có thêm quyền:
Phát hành tài nguyên mới (kèm chữ ký HMAC để mọi peer kiểm chứng)
Thu hồi/gỡ nội dung không phù hợp
Xem thống kê mạng
(Tùy chọn) đồng thời chạy signaling server — vì máy giáo viên thường mở đầu tiên và để cố định
3. Tại sao thiết kế theo hướng này? (lập luận để viết vào báo cáo)
Đúng tinh thần P2P phân tán: không có máy chủ riêng → admin node cũng chỉ là một peer đặc biệt, mất nó thì mạng vẫn hoạt động (học sinh vẫn chia sẻ được với nhau).
Chi phí triển khai = 0: trường học không cần mua server hay thiết bị mới — chỉ cần máy giáo viên sẵn có + 1 router Wi-Fi.
Giảm tải phát triển: một codebase, một quy trình cài đặt (truy cập URL → "Add to Home Screen"), giáo viên chỉ khác ở tài khoản.
Tránh điểm nghẽn: signaling server chỉ cần cho lúc bắt tay; các peer có thể tự làm signaling cho nhau bằng mDNS hoặc QR code nếu máy giáo viên tắt.
4. Cách trình bày trong báo cáo
Mục "Sản phẩm nghiên cứu" (Chương 1): ghi là "hệ thống phần mềm EduShare gồm ứng dụng PWA và signaling server"
Mục thiết kế (Chương 3): có mục "3.7 Mô hình phân quyền trong mạng" mô tả 2 loại node: Learner Node và Admin Node — nhấn mạnh đây là vai trò logic, không phải thành phần phần mềm riêng
Phần demo: quay 1 máy giáo viên (admin) + 3–4 máy học sinh — thể hiện rõ cả 2 vai trò cùng chạy một phần mềm
⚠️ Lưu ý khi bảo vệ: hội đồng có thể hỏi "Nếu máy giáo viên tắt thì sao?" — câu trả lời chuẩn: signaling có thể chuyển sang peer bất kỳ (election đơn giản) hoặc dùng mDNS/QR; các tài nguyên đã ký vẫn hợp lệ vì chữ ký được lưu kèm metadata lan truyền trong mạng. Đây chính là điểm mạnh của thiết kế so với Kolibri.
Bạn cần mình vẽ chi tiết hơn mô hình phân quyền + cơ chế ký/chứng thực tài nguyên của Admin Node để đưa vào Chương 3 không?
thế là edu share chạy máy chủ, máy chủ yêu cầu gì hệ điều hành nào
Chỉnh sửa
Sao chép
Chia sẻ
Đã suy nghĩ xong
Yêu cầu máy chủ (Signaling Server) của EduShare
1. Bản chất: server rất nhẹ — chỉ làm "mai mối" kết nối
Trước hết cần nhấn mạnh lại: đây KHÔNG phải server kiểu truyền thống (không lưu file, không xử lý nội dung, không yêu cầu cấu hình mạnh). Signaling server chỉ làm một việc duy nhất: truyền tin nhắn SDP/ICE giữa các peer trong vài giây đầu để WebRTC thiết lập kết nối P2P trực tiếp. Sau khi kết nối xong, dữ liệu chạy thẳng giữa các thiết bị, server không đụng vào.
Nó tương đương một ứng dụng chat nội bộ ~100 dòng code, nặng chưa tới 50 MB RAM khi chạy.
2. Yêu cầu hệ điều hành
Server viết bằng Node.js (JavaScript) nên chạy được trên mọi hệ điều hành phổ biến:
Bảng
Hệ điều hành	Hỗ trợ	Ghi chú thực tế
Windows 10/11	✅	Phù hợp nhất với bối cảnh trường học — máy giáo viên thường chạy Windows. Chỉ cần cài Node.js → node server.js
Linux (Ubuntu/Debian...)	✅	Lựa chọn tốt nếu trường có sẵn máy tính cũ cài Ubuntu; ổn định, chạy lâu dài tốt
macOS	✅	Chạy được nhưng hiếm gặp trong trường học Việt Nam
➡️ Khuyến nghị cho đề tài/demo: Windows 10/11 — vì máy giáo viên ở trường phổ thông hầu hết là Windows, demo trước hội đồng cũng tự nhiên nhất.
3. Yêu cầu phần cứng (rất thấp)
Bảng
Hạng mục	Tối thiểu	Khuyến nghị
CPU	Bất kỳ CPU 2 nhân (đời 2012 trở lên)	Không yêu cầu
RAM	512 MB tự do	1 GB
Ổ cứng	< 100 MB cho Node.js + code	—
Card mạng	Wi-Fi hoặc LAN nối cùng mạng với học sinh	Wi-Fi băng tần 2.4/5 GHz ổn định
Số lượng peer đồng thời	—	Thoải mái với 50–100 thiết bị (WebSocket nhẹ, chỉ giữ kết nối mở)
➡️ Một chiếc laptop cũ giá 2–3 triệu, thậm chí Raspberry Pi, cũng chạy tốt. Đây là lập luận mạnh khi bảo vệ: "hệ thống không đòi hỏi đầu tư phần cứng".
4. Yêu cầu phần mềm kèm theo
Chỉ cần cài duy nhất Node.js LTS (v20/v22) từ nodejs.org — không cần cơ sở dữ liệu, không cần web server (Apache/Nginx), không cần cấu hình tên miền hay SSL (vì chạy nội bộ LAN, dùng địa chỉ IP như http://192.168.1.10:8080).
⚠️ Một lưu ý kỹ thuật quan trọng để ghi vào báo cáo:
WebRTC yêu cầu HTTPS hoặc localhost ở phía client (trình duyệt bắt buộc "secure context" để dùng getUserMedia/RTCPeerConnection — với DataChannel thuần một số trình duyệt cho phép HTTP thuần, nhưng không nên dựa vào).
Trong môi trường LAN offline, không có chứng chỉ SSL thật → giải pháp: cấu hình một CA nội bộ tự ký (self-signed cert cho IP LAN), hoặc dùng cơ chế exception của trình duyệt, hoặc khai báo origin là localhost bằng cách chạy PWA qua file:///ứng dụng đóng gói. Đây là một điểm bạn nên dành 1 mục nhỏ trong Chương 4 (hiện thực) và Chương 5 (rủi ro triển khai).
5. Tóm tắt câu trả lời cho hội đồng
"Server của hệ thống chỉ là signaling server viết bằng Node.js, chạy được trên Windows, Linux, macOS — thực tế triển khai trên chính laptop Windows của giáo viên, không cần mua thêm thiết bị hay phần mềm nào ngoài Node.js. Yêu cầu phần cứng cực thấp (laptop cũ cũng chạy được), và server sập thì mạng P2P vẫn duy trì nhờ peer đã kết nối với nhau."


xây dựng giao diện (UI), và đây là phần bắt buộc của sản phẩm
Nhắc lại một chút để phân biệt rõ: giao thức P2P/WebRTC chỉ là "đường ống" ngầm bên dưới. Người dùng (giáo viên, học sinh) không bao giờ đụng vào WebRTC — họ chỉ thao tác trên giao diện web. Nên đề tài của bạn thực chất có 2 phần việc: (1) xây dựng mạng lưới P2P phía dưới, và (2) thiết kế UI/UX offline-first phía trên.
Dưới đây là thiết kế giao diện đề xuất để bạn đưa vào báo cáo (Chương 3 – thiết kế, Chương 4 – hiện thực).
1. Nguyên tắc thiết kế UI cho ngữ cảnh này
Bảng
Nguyên tắc	Lý do
Mobile-first	Học sinh dùng điện thoại là chủ yếu
Offline-first	Mọi màn hình phải hoạt động khi không có Internet; có indicator trạng thái mạng LAN (đang kết nối mấy peer)
Ít bước thao tác	Tải/chia sẻ file ≤ 3 chạm (tap)
Không dùng thuật ngữ kỹ thuật	Không hiện chữ "WebRTC", "peer", "SDP" — thay bằng "thiết bị trong lớp", "đang gửi cho Lan..."
Ngôn ngữ tiếng Việt	Đối tượng học sinh/phổ thông
2. Cấu trúc màn hình (4 màn hình chính, điều hướng bằng tab dưới)
plain
┌─────────────────────────┐
│   [Logo]  EduShare      │
│  ● 5 thiết bị đang kết  │  ← thanh trạng thái mạng LAN
│     nối trong lớp       │
├─────────┬───────────────┤
│ 📚 Thư  │ 👥 Lớp học  │  ← TAB 1: Thư viện | TAB 2: Thiết bị
│  viện   │ ⬆️ Đang gửi  │     TAB 3: Tải lên/đang truyền
├─────────┴───────────────┤
│                         │
│      [NỘI DUNG TAB]     │
│                         │
└─────────────────────────┘
📚 TAB 1 — Thư viện tài nguyên (màn hình chính)
Danh sách tài nguyên dạng thẻ (card): tên, môn học, lớp, dung lượng, trạng thái
3 trạng thái rõ ràng bằng màu/badge:
🟢 "Có sẵn — xem ngay" (đã tải về máy, mở offline được)
🟡 "Có trên mạng lớp — tải về" (peer khác đang giữ, bấm để tải P2P)
⚪ "Chưa có trong mạng" (hiện nút "Yêu cầu" → gossip tìm kiếm)
Thanh tìm kiếm + bộ lọc theo môn học/lớp
Bấm vào tài nguyên → màn hình chi tiết (xem trước PDF/video ngay trong app nhờ Service Worker cache)
👥 TAB 2 — Thiết bị trong lớp (mạng lưới)
Danh sách peer đang online: tên thiết bị/ghi danh (ví dụ "Máy cô Hoa", "Máy của Minh"), avatar, dung lượng tài nguyên họ đang chia sẻ
Nút "Gửi file cho thiết bị này" (chọn file → chuyển sang Tab 3)
(Chỉ Admin Node) thêm badge 🛡️ và các nút quản trị: phát hành tài nguyên, thu hồi
⬆️ TAB 3 — Đang truyền (quản lý tải lên/tải xuống)
Mỗi phiên truyền một dòng: tên file → thiết bị đích/nguồn, thanh tiến trình %, tốc độ MB/s
Nút "Tạm dừng / Tiếp tục" (tận dụng cơ chế resume bằng chunk + IndexedDB)
Badge "Sẽ tự gửi lại khi có mạng" cho hàng đợi Background Sync
➕ Nút nổi (+) — Tải tài nguyên lên
Chọn file từ máy (ảnh, PDF, video, audio) → điền tên, môn, lớp → "Chia sẻ vào mạng lớp"
(Admin Node) kèm bước ký phát hành tự động phía sau
3. Luồng tương tác điển hình (để vẽ sơ đồ tuần tự trong báo cáo)
Luồng A — Học sinh tải tài nguyên từ bạn:
plain
Mở app → Thấy badge 🟡 "Bài giảng Hóa 9 - Bài 4"
→ Bấm "Tải về"
→ UI hiện "Đang kết nối với máy của Minh..." (signaling qua LAN)
→ Thanh tiến trình chạy qua Tab 3
→ Xong → badge chuyển 🟢 "Xem ngay" (đã lưu IndexedDB + cache SW)
→ Tắt hết kết nối, mở app vẫn xem được ✅ (offline 100%)
Luồng B — Giáo viên phát hành tài nguyên:
plain
Đăng nhập Admin → nút (+) → chọn file → "Phát hành"
→ App ký metadata (HMAC) → gossip lan truyền danh mục
→ Mọi máy học sinh thấy tài nguyên mới xuất hiện ở Tab 1
→ Ai cần thì tải P2P từ máy giáo viên (hoặc từ bạn đã tải trước)
4. Mapping UI ↔ công nghệ (bảng này rất nên có trong Chương 3)
Bảng
Thành phần UI	Công nghệ phía dưới
Badge "X thiết bị đang kết nối"	WebSocket signaling + heartbeat peer
Nút "Tải về"	RTCDataChannel, chunk 256KB, SHA-256 kiểm chứng
Thanh tiến trình, nút Tiếp tục	IndexedDB lưu chunk đã nhận + resume
Xem file offline	Service Worker serve từ Cache Storage/IndexedDB
Tài nguyên "xuất hiện" khi có mạng	Gossip metadata qua LAN
"Sẽ gửi lại khi có mạng"	Background Sync queue
5. Gợi ý công cụ xây dựng UI
React + Vite + TypeScript (hoặc Vue 3) — PWA scaffolding
Tailwind CSS (hoặc Material UI) — nhanh, đẹp, mobile-first
Workbox — tích hợp Service Worker
Dexie.js — wrapper IndexedDB
Nếu muốn demo ấn tượng trước hội đồng: vẽ mockup trước bằng Figma (miễn phí), đưa vào Chương 3 làm "thiết kế giao diện"
➡️ Kết luận cho câu hỏi của bạn: Đúng — phải xây dựng giao diện web hoàn chỉnh, và giao diện này không đơn giản là "form gửi file": nó là lớp duy nhất người dùng nhìn thấy, phải giấu hết độ phức tạp P2P đi, đồng thời phản ánh trung thực trạng thái mạng ngoại tuyến. Trong báo cáo, phần thiết kế giao diện nên chiếm một mục riêng (~4–6 trang ở Chương 3) kèm mockup.

Thiết kế giao diện Responsive — phù hợp cả Mobile và Laptop
1. Chiến lược chung: Mobile-first + Adaptive (không phải chỉ co giãn)
Điểm mấu chốt: trên mobile màn hình nhỏ, ngón tay chạm → ưu tiên đơn giản, tab dưới; trên laptop màn hình rộng, chuột → tận dụng không gian hiển thị đồng thời nhiều thông tin. Dùng 1 codebase duy nhất, CSS responsive + điều kiện theo kích thước màn hình (breakpoint).
2. Breakpoint đề xuất
Bảng
Tên	Kích thước	Thiết bị
sm	< 640px	Điện thoại dọc
md	640–1024px	Điện thoại ngang, máy tính bảng
lg	> 1024px	Laptop, màn hình lớn
3. Bố cục theo từng kích thước
📱 Mobile (< 640px) — "Một việc tại một thời điểm"
plain
┌─────────────────────┐
│ ● 5 thiết bị | 🔍   │ ← thanh trạng thái + tìm kiếm
├─────────────────────┤
│                     │
│   [NỘI DUNG TAB]    │ ← 1 tab mỗi lúc
│                     │
│  ➕ (nút nổi)        │
├─────────────────────┤
│ 📚Thư viện 👥Lớp ⬆️ │ ← thanh tab dưới, 3 mục
└─────────────────────┘
3 tab dưới: Thư viện / Lớp học / Đang truyền
Thẻ tài nguyên: xếp dọc 1 cột, nút bấm lớn (≥ 44px)
Phiên truyền file: mỗi cái 1 dòng, thanh tiến trình dạng dọc đầy chiều ngang
💻 Laptop (> 1024px) — "Bảng điều khiển 2 cột"
plain
┌──────────────────────────────────────────────────┐
│ ● 5 thiết bị đang kết nối | 🔍 Tìm kiếm... | ➕ Tải lên │
├────────────────────┬─────────────────────────────┤
│  📚 Thư viện       │  👥 Thiết bị trong lớp       │
│  (danh sách, lưới  │  + ⬆️ Đang truyền           │
│   2–3 cột)         │                             │
│                    │                             │
├────────────────────┴─────────────────────────────┤
│ ▶ Đang truyền: Hóa9-Bai4.pdf → 68% (2.1 MB/s)   │ ← thanh trạng thái cố định dưới
└──────────────────────────────────────────────────┘
Bỏ tab, chuyển sang bố cục 2–3 cột (sidebar + nội dung)
Danh sách tài nguyên: dạng bảng (tên | môn | dung lượng | trạng thái | hành động) — xem nhiều hơn, so sánh nhanh hơn
Phiên truyền hiện đồng thời ở panel phải + thanh trạng thái dưới
Có thể xem trước file (preview PDF/video) ngay trong cửa sổ chính
4. Mapping thành phần cụ thể
Bảng
Thành phần	Mobile	Laptop
Điều hướng	Tab bar dưới (3 tab)	Sidebar trái hoặc navbar ngang
Danh sách tài nguyên	Card xếp dọc, 1 cột	Bảng (table) hoặc lưới 2–3 cột
Chi tiết tài nguyên	Màn hình riêng (fullscreen)	Panel phải / modal lớn
Thiết bị trong lớp	Tab riêng	Panel sidebar
Đang truyền	Tab riêng	Panel phải + thanh trạng thái dưới
Nút tải lên	Nút nổi (FAB) góc phải dưới	Nút "Tải lên" ở navbar
Preview file	Fullscreen, vuốt để đóng	Inline trong panel, nút đóng
Bộ lọc môn/lớp	Dropdown gọn	Checkbox/sidebar đa chọn
5. Kỹ thuật cài đặt (với Tailwind CSS)
HTML
<!-- Thanh điều hướng: tab dưới trên mobile, sidebar trên laptop -->
<nav class="fixed bottom-0 w-full lg:static lg:w-64 lg:h-screen">
  ...
</nav>

<!-- Danh sách: card dọc mobile, bảng laptop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- card tài nguyên -->
</div>

<!-- Panel chi tiết: fullscreen mobile, panel phải laptop -->
<aside class="fixed inset-0 lg:relative lg:w-96 lg:inset-auto">
  ...
</aside>
Nguyên tắc CSS:
Dùng lg: prefix cho mọi thay đổi bố cục lớn
Tránh hover-only interactions (không có trên mobile)
Font size: text-sm mobile, text-base laptop
Nút chạm: tối thiểu 44×44px trên mobile
6. Ưu điểm của thiết kế này
✅ 1 codebase — không cần app riêng cho mobile/desktop
✅ PWA — trên mobile "Add to Home Screen" như app native; trên laptop chạy trong trình duyệt bình thường
✅ Offline đều tốt — Service Worker hoạt động giống nhau trên mọi kích thước màn hình
✅ Demo trước hội đồng: mở cùng lúc trên điện thoại + laptop → thấy ngay tính responsive
7. Lưu ý khi viết báo cáo
Trong Chương 3 (Thiết kế), bạn nên có:
Hình vẽ wireframe cho 2 phiên bản: mobile + laptop (vẽ bằng Figma hoặc Excalidraw)
Bảng mapping breakpoint như mục 2, 4 ở trên
Giải thích lý do chọn mobile-first (đối tượng học sinh dùng điện thoại nhiều nhất)