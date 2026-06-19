# Hướng dẫn giữ gìn Code Sạch & Dễ bảo trì (Maintainability Guidelines)

Tài liệu này quy định các tiêu chuẩn và nguyên tắc thiết kế mã nguồn nhằm ngăn ngừa tình trạng code bẩn, code rác, chồng chéo chức năng và các file quá dài khó bảo trì trong dự án **Call-to-Cash Risk Copilot**.

---

## 1. Giới hạn số dòng của File (Strict File Length Cap)
- **Nguyên tắc**: Các file React component không được vượt quá **350 - 400 dòng code**.
- **Khi file quá dài**: Nếu một component bắt đầu phình to, bắt buộc phải tách nhỏ các phần giao diện phụ hoặc logic xử lý riêng ra thành các component con hoặc utility helper:
  - Ví dụ: `DesktopConsole.jsx` hiện tại chứa Scenarios, Transcript Console, Telemetry và Replay. Nếu cần mở rộng thêm, ta phải tách chúng thành:
    - `src/components/ScenarioSelector.jsx`
    - `src/components/AgoraConsole.jsx`
    - `src/components/TelemetryDashboard.jsx`
    - `src/components/TimelineReplay.jsx`
- **Mã nguồn chức năng**: Tuyệt đối không nhét chung logic tính toán, dữ liệu mock lớn hoặc các thuật toán phức tạp vào cùng file giao diện. Dữ liệu hội thoại phải được cô lập ở [scenarios.js](src/data/scenarios.js).

---

## 2. Phân tách rạch ròi Vai trò (Separation of Concerns)
Để giữ code sạch và dễ maintain, cấu trúc thư mục và vai trò của từng tầng cần tuân thủ nghiêm ngặt:
- **Tầng Giao diện (Presentational Components)**: Chỉ nhận props, hiển thị và gọi hàm callback từ props. Ví dụ: `PhoneScreen.jsx` và `DesktopConsole.jsx` không trực tiếp quản lý state mô phỏng hay thời gian cọc; mọi dữ liệu đều nhận từ `App.jsx`.
- **Tầng Quản lý Trạng thái (App.jsx - State Controller)**: Đóng vai trò là bộ não quản lý toàn bộ state dùng chung (Lifting State Up). Phối hợp hành động giữa điện thoại của khách hàng và console đối soát của Auditor.
- **Tầng Kiểu dáng (Styling Layer)**:
  - Tránh lạm dụng inline-style trong React JSX. Chỉ dùng inline-style cho các giá trị động cần thay đổi theo state (như tỷ lệ % của progress bar hay màu sắc trạng thái cuộc gọi).
  - Tất cả style cố định phải được khai báo tập trung trong [index.css](src/index.css) để dễ tùy chỉnh responsive và đồng bộ giao diện.

---

## 3. Quản lý State & Sử dụng React Hook Đúng cách
- **Tính bất biến (Immutability)**: Không bao giờ đột biến trực tiếp state của React (ví dụ: `bookingData.route = "Hà Nội"` là sai). Luôn dùng cơ chế shallow copy để cập nhật giá trị thông qua hàm set:
  ```javascript
  // ĐÚNG:
  setBookingData(prev => ({ ...prev, route: "Hà Nội -> Sa Pa" }));
  ```
- **Xử lý Timeout/Interval**: Mọi hành động chạy mô phỏng hội thoại (SetTimeout) hay chạy bộ đếm thời gian (Interval) bắt buộc phải được theo dõi thông qua `useRef` hoặc dọn dẹp sạch sẽ (`clearTimeout` / `clearInterval`) khi reset hoặc khi component bị unmount để tránh rò rỉ bộ nhớ (memory leaks).

---

## 4. Tận dụng Thư viện Icon Standard (Lucide React)
- Tuyệt đối không sử dụng các ký tự Emoji thô (`🚌`, `🎙️`, `🔒`) trong các dòng text hiển thị chính vì chúng không đồng bộ kích thước và hiển thị khác nhau trên các hệ điều hành (iOS, Android, Windows).
- Luôn sử dụng thư viện **Lucide React** (`lucide-react`) để hiển thị các vector icon SVG sắc nét, đồng bộ màu sắc thương hiệu và dễ dàng thêm các hiệu ứng hoạt ảnh động.

---

## 5. Viết Code Tự Tài liệu hóa (Self-Documenting Code)
- Đặt tên biến và hàm rõ ràng, phản ánh đúng mục tiêu nghiệp vụ thay vì đặt tên chung chung:
  - Thay vì: `const handlePlay = () => {}`
  - Hãy đặt: `const startDialogueSimulation = () => {}`
- Tránh viết ghi chú (comment) giải thích *code hoạt động thế nào*. Hãy viết ghi chú giải thích *tại sao lại làm thế* ở những đoạn logic nghiệp vụ đặc thù (như thuật toán băm giao dịch mock sha256).
