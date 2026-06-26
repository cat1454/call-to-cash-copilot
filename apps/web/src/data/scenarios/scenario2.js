import { REFUND_POLICY } from "../refundPolicy.js";

export default // Scenario 2: Dispute Risk / Crypto questions
  [
    {
      sender: "customer",
      text: "Alo, tớ muốn đặt xe khách đi Sa Pa tối nay mà đi đông người ấy.",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa" },
        scores: { completeness: 20, dispute: 15, readiness: 20 },
        performance: { ttfr: "380ms", turngap: "1.5s", clarify: 0, reduction: "5%" },
        brainMode: "slow",
        prefetch: "Đang tải các tuyến Hà Nội -> Sa Pa đêm nay...",
        timeline: [1, 2]
      }
    },
    {
      sender: "ai",
      text: "Dạ chào anh/chị! Tuyến Hà Nội đi Sa Pa tối nay bên em còn các chuyến 22:00 (còn 6 chỗ) và 22:30 (còn 12 chỗ). Mình dự định đi chuyến nào và đi bao nhiêu người ạ?",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa" },
        scores: { completeness: 20, dispute: 12, readiness: 20 },
        performance: { ttfr: "310ms", turngap: "1.1s", clarify: 0, reduction: "10%" },
        brainMode: "slow",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "customer",
      text: "Cho tớ chuyến 22:30 đi, đi 2 người nhé. SĐT tớ là 0987654321. Mà đi xe khách sao cứ bắt cọc trước vậy em? Lỡ bận không đi thì có được trả tiền không? Mà nghe nói thanh toán qua Solana, cái đó có phải coin lừa đảo không?",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "2 khách",
          phone: "0987654321",
          price: "700.000đ",
          deposit: "200.000đ"
        },
        scores: { completeness: 80, dispute: 80, readiness: 30 },
        performance: { ttfr: "450ms", turngap: "1.8s", clarify: 1, reduction: "-20%" },
        brainMode: "slow",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "ai",
      text: `Dạ anh hoàn toàn yên tâm ạ. Trong demo này, thanh toán được mô phỏng deterministically; Solana chưa kết nối thật. Về cọc, ${REFUND_POLICY.spokenSummary} Anh xác nhận thông tin này chứ?`,
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "2 khách",
          phone: "0987654321",
          price: "700.000đ",
          deposit: "200.000đ"
        },
        scores: { completeness: 90, dispute: 30, readiness: 75 },
        performance: { ttfr: "340ms", turngap: "1.2s", clarify: 1, reduction: "50%" },
        brainMode: "slow",
        timeline: [1, 2, 3, 4]
      }
    },
    {
      sender: "customer",
      text: "À, ra thế, chỉ là công cụ xác thực thôi đúng không. Được rồi, thế thì tớ đồng ý. Cậu mở cổng thanh toán đi tớ chuyển cọc luôn.",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:30",
          seats: "2 khách",
          phone: "0987654321",
          price: "700.000đ",
          deposit: "200.000đ"
        },
        scores: { completeness: 100, dispute: 25, readiness: 90 },
        performance: { ttfr: "290ms", turngap: "1.1s", clarify: 1, reduction: "85%" },
        brainMode: "slow",
        gateUnlocked: true,
        timeline: [1, 2, 3, 4, 5]
      }
    }
  ];
