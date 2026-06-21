# Demo Failure Matrix

| Failure | Customer-facing message | Retry | Fallback | State safe? | Internal check |
|---|---|---|---|---|---|
| Microphone denied | Trình duyệt chưa được dùng micro. | Grant permission and retry | Replay | Yes | browser permission |
| No microphone | Không tìm thấy micro. | Connect/select device | Replay | Yes | media devices |
| Agora unavailable/expired | Chưa thể kết nối dịch vụ thoại. | Retry live session | Replay or end | Yes | API readiness/provider status |
| SSE interrupted | Đang khôi phục kết nối và trạng thái mới nhất. | Automatic reconnect | Refresh snapshot | Yes | Last-Event-ID/event sequence |
| API unavailable | Chưa thể cập nhật ngay lúc này. | Restore API | Pause demo | Durable data unchanged | `/health`, `/ready` |
| PostgreSQL unavailable | Hệ thống đang tạm dừng để bảo vệ trạng thái. | Restore DB | Replay only after readiness | Existing committed data yes | database health |
| Phantom unavailable | Chưa mở được ví thanh toán. | Install/open Phantom | Show mock path only if announced | Yes | wallet availability |
| Wrong network | Ví chưa ở mạng Devnet. | Switch to Devnet | Stop payment demo | Yes | wallet cluster |
| User rejects signing | Giao dịch chưa được gửi. | Reopen request | End safely | Yes | no verified transaction |
| RPC/transaction pending | Chưa thể kiểm tra giao dịch ngay. | Automatic/manual retry | Wait; do not duplicate | Yes | provider retryable code |
| Wrong amount/recipient/reference or reused transaction | Giao dịch cần được kiểm tra thủ công. | Do not resubmit as success | Manual review | Yes | structured server error/audit |
| Payment intent expired | Phiên thanh toán đã hết hạn. | Create a new valid intent | Return to booking | Booking yes; old intent closed | server expiry |
| Browser refresh | Đang khôi phục trạng thái đã lưu. | Wait for recovery | Reopen using same browser | Yes | opaque recovery IDs + REST |
