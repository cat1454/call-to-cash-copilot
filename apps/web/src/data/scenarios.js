import { REFUND_POLICY } from "./refundPolicy";

export const scenarios = [
  // Scenario 1: Normal Booking
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
  ],

  // Scenario 2: Dispute Risk / Crypto questions
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
  ],

  // Scenario 3: Mid-Call modification
  [
    {
      sender: "customer",
      text: "Alo xe khách Sa Pa đúng không? Tôi muốn đặt 2 ghế giường nằm chuyến Hà Nội - Sa Pa tối nay.",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa", seats: "2 khách" },
        scores: { completeness: 40, dispute: 10, readiness: 40 },
        performance: { ttfr: "330ms", turngap: "1.1s", clarify: 0, reduction: "10%" },
        brainMode: "fast",
        prefetch: "Đang tải danh sách sơ đồ ghế giường đôi Hà Nội -> Sa Pa...",
        timeline: [1, 2]
      }
    },
    {
      sender: "ai",
      text: "Dạ đúng rồi ạ. Tối nay em còn các chuyến 22:00 và 22:30 đi Sa Pa. Anh/chị chọn chuyến mấy giờ và cho em xin số điện thoại để đặt chỗ nhé?",
      updates: {
        entities: { route: "Hà Nội -> Sa Pa", seats: "2 khách" },
        scores: { completeness: 50, dispute: 10, readiness: 45 },
        performance: { ttfr: "290ms", turngap: "1.0s", clarify: 0, reduction: "15%" },
        brainMode: "fast",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "customer",
      text: "Chuyến 22:00 nhé, số điện thoại tôi là 0909090909. À khoan em ơi, đợi chút, đứa bạn anh nó vừa gọi đòi đi chung nữa. Sửa lại cho anh thành 4 người đi chung chuyến đó được không em?",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:00",
          seats: "4 khách",
          phone: "0909090909",
          price: "1.400.000đ",
          deposit: "400.000đ"
        },
        scores: { completeness: 85, dispute: 35, readiness: 60 },
        performance: { ttfr: "420ms", turngap: "1.6s", clarify: 1, reduction: "20%" },
        brainMode: "slow",
        prefetch: "Cập nhật prefetch: Tải danh sách 4 ghế giường nằm liền kề chuyến 22:00...",
        timeline: [1, 2, 3]
      }
    },
    {
      sender: "ai",
      text: "Dạ được chứ ạ. Em đã cập nhật lại dự thảo booking: Vé đổi sang 4 người chuyến 22:00 đi Sa Pa cho SĐT 0909090909. Tổng tiền vé là 1.400.000đ, tiền cọc giữ ghế được điều chỉnh thành 400.000đ. Anh kiểm tra lại và xác nhận giúp em nhé?",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:00",
          seats: "4 khách",
          phone: "0909090909",
          price: "1.400.000đ",
          deposit: "400.000đ"
        },
        scores: { completeness: 95, dispute: 20, readiness: 85 },
        performance: { ttfr: "310ms", turngap: "1.1s", clarify: 1, reduction: "70%" },
        brainMode: "slow",
        timeline: [1, 2, 3, 4]
      }
    },
    {
      sender: "customer",
      text: "Ok chuẩn rồi em ơi, đúng 4 người chuyến 22:00 nha. Mở cổng cọc để anh quét tiền luôn.",
      updates: {
        entities: {
          route: "Hà Nội -> Sa Pa",
          time: "22:00",
          seats: "4 khách",
          phone: "0909090909",
          price: "1.400.000đ",
          deposit: "400.000đ"
        },
        scores: { completeness: 100, dispute: 15, readiness: 95 },
        performance: { ttfr: "280ms", turngap: "1.0s", clarify: 1, reduction: "90%" },
        brainMode: "fast",
        gateUnlocked: true,
        timeline: [1, 2, 3, 4, 5]
      }
    }
  ],
  // Scenario 4: deterministic happy path with a material passenger-count change.
  [
    {
      sender: "customer",
      text: "Tôi muốn đặt xe từ Đà Nẵng đi Hà Nội ngày 28 tháng 6 lúc 19 giờ, 3 người."
    },
    {
      sender: "ai",
      text: "Em đã ghi nhận chuyến Đà Nẵng đi Hà Nội lúc 19:00 ngày 28/06 cho 3 khách. Anh/chị cho em xin số liên hệ và điểm đón để giữ chỗ nhé."
    },
    {
      sender: "customer",
      text: "Số điện thoại của tôi là 0901234567, đón ở bến xe trung tâm Đà Nẵng."
    },
    {
      sender: "ai",
      text: "Dự thảo hiện có 3 khách, tổng tiền 1.350.000 đồng và tiền cọc 300.000 đồng theo BUS-V1 v1.0. Anh/chị kiểm tra giúp em nhé."
    },
    {
      sender: "customer",
      text: "Tôi đổi từ 3 thành 4 người, vẫn chuyến 19 giờ ngày 28 tháng 6."
    },
    {
      sender: "ai",
      text: "Em đã cập nhật thành 4 khách. Tổng tiền mới là 1.800.000 đồng, tiền cọc giữ chỗ là 300.000 đồng. Anh/chị xác nhận lại điều khoản giúp em nhé."
    },
    {
      sender: "customer",
      text: "Tôi xác nhận 4 người chuyến Đà Nẵng đi Hà Nội lúc 19 giờ ngày 28 tháng 6 và đồng ý đặt cọc theo điều khoản vừa đọc."
    }
  ]
];
