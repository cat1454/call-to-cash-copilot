import { REFUND_POLICY } from "../refundPolicy.js";

export default // Scenario 5: Da Nang to Nha Trang replay with real Solana Devnet deposit
  [
    { sender: "customer", text: "Tôi muốn đặt vé xe từ Đà Nẵng đến Nha Trang.", updates: {} },
    { sender: "customer", text: "Ngày khởi hành là ngày hai mươi tám tháng sáu.", updates: {} },
    { sender: "customer", text: "Giờ khởi hành là bảy giờ.", updates: {} },
    { sender: "customer", text: "Số lượng hành khách là ba người.", updates: {} },
    {
      sender: "customer",
      text: "Số điện thoại là không chín không một hai ba bốn năm sáu bảy.",
      updates: {}
    },
    {
      sender: "customer",
      text: "Tôi giữ số lượng là ba người nhé.",
      updates: {}
    },
    { sender: "customer", text: "Điểm đốn là bảy xe trung tâm Đà Nẵng.", updates: {} },
    {
      sender: "ai",
      text: `Dạ em xác nhận 3 khách tuyến Đà Nẵng đi Nha Trang lúc 7 giờ ngày 28 tháng 6. Tổng tiền 1.260.000 đồng, cọc 150.000 đồng. ${REFUND_POLICY.spokenSummary} Anh/chị xác nhận để mở cọc Devnet nhé?`,
      updates: {}
    },
    { sender: "customer", text: "Tôi xác nhận đặt cọc theo điều khoản vừa đọc.", updates: {} }
  ];
