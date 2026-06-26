import { REFUND_POLICY } from "../refundPolicy.js";

export default // Scenario 3: Mid-Call modification
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
  ];
