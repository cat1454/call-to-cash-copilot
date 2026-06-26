import { REFUND_POLICY } from "../refundPolicy.js";

export default // Scenario 1: Normal Booking
  [
    {
      sender: "customer",
      text: "Chào em, anh muốn đặt xe giường nằm đi Sa Pa tối nay lúc 22:30.",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa", time: "22:30" },
        scores: { completeness: 35, dispute: 10, readiness: 40 },
        performance: { ttfr: "320ms", turngap: "1.2s", clarify: 0, reduction: "10%" },
        brainMode: "fast",
        prefetch: "Đang tải chuyến xe Hà Nội -> Sa Pa chuyến 22:30 tối nay... Còn 12 ghế trống.",
        timeline: [1, 2]
      }
    },
    {
      sender: "ai",
      text: "Dạ em chào anh! Em đã ghi nhận hành trình Hà Nội đi Sa Pa chuyến 22:30 tối nay. Cho em xin số điện thoại và số lượng người đi cùng anh để em soạn dự thảo đặt vé nhé?",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa", time: "22:30" },
        scores: { completeness: 45, dispute: 8, readiness: 45 },
        performance: { ttfr: "280ms", turngap: "1.0s", clarify: 0, reduction: "15%" },
        brainMode: "fast",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "customer",
      text: "Anh đi 3 người nhé, số điện thoại anh là 0912345678.",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "3 khách",
          phone: "0912345678",
          price: "1.050.000đ",
          deposit: "300.000đ"
        },
        scores: { completeness: 85, dispute: 5, readiness: 75 },
        performance: { ttfr: "310ms", turngap: "1.1s", clarify: 0, reduction: "40%" },
        brainMode: "fast",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "ai",
      text: `Dạ em xin xác nhận lại thông tin: 3 vé xe đi Sa Pa chuyến 22:30 tối nay, đăng ký cho SĐT 0912345678. Tổng tiền vé là 1.050.000đ, anh cần đặt cọc trước 300.000đ để giữ ghế trong 10 phút. ${REFUND_POLICY.spokenSummary} Anh xác nhận thông tin này để em mở cổng cọc nhé?`,
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "3 khách",
          phone: "0912345678",
          price: "1.050.000đ",
          deposit: "300.000đ"
        },
        scores: { completeness: 95, dispute: 5, readiness: 85 },
        performance: { ttfr: "240ms", turngap: "0.9s", clarify: 0, reduction: "60%" },
        brainMode: "fast",
        timeline: [1, 2, 3, 4]
      }
    },
    {
      sender: "customer",
      text: "Nhất trí em ơi, thông tin chuẩn rồi đó. Mở cổng để anh quét mã cọc luôn đi.",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "3 khách",
          phone: "0912345678",
          price: "1.050.000đ",
          deposit: "300.000đ"
        },
        scores: { completeness: 100, dispute: 5, readiness: 95 },
        performance: { ttfr: "290ms", turngap: "1.3s", clarify: 0, reduction: "95%" },
        brainMode: "fast",
        gateUnlocked: true,
        timeline: [1, 2, 3, 4, 5]
      }
    }
  ];
