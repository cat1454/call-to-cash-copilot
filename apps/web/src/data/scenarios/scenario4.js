import { REFUND_POLICY } from "../refundPolicy.js";

export default // Scenario 4: Full phase 0–11 pipeline — Revenue Twin optimization (3 overlapping trips)
  [
    // Phase 0 — Call session CREATED → ACTIVE
    {
      sender: "ai",
      text: "Dạ xin chào! Nhà xe Đà Nẵng xin kính chào anh/chị. Em có thể giúp anh/chị đặt vé chuyến nào hôm nay ạ?",
      updates: {
        scores: { completeness: 0, dispute: 0, readiness: 0 },
        performance: { ttfr: "290ms", turngap: "1.0s", clarify: 0, reduction: "0%" },
        brainMode: "fast",
        timeline: [1]
      }
    },
    // Phase 1 — Route extracted → FIELDS_PARTIAL
    {
      sender: "customer",
      text: "Alo, tôi muốn đặt vé xe từ Đà Nẵng đi Nha Trang ngày 28 tháng 6.",
      updates: {
        entities: { route: "Đà Nẵng -> Nha Trang" },
        scores: { completeness: 20, dispute: 5, readiness: 10 },
        performance: { ttfr: "310ms", turngap: "1.2s", clarify: 0, reduction: "5%" },
        brainMode: "fast",
        prefetch: "Phát hiện 3 chuyến Đà Nẵng → Nha Trang ngày 28/06: 07:00 (còn 2 chỗ), 07:30 (còn 12 chỗ), 08:00 (còn 15 chỗ). Revenue Twin đang phân tích tối ưu...",
        timeline: [1, 2]
      }
    },
    // Phase 2 — Departure time extracted
    {
      sender: "ai",
      text: "Dạ em ghi nhận tuyến Đà Nẵng → Nha Trang ngày 28/06. Hệ thống có các chuyến 07:00, 07:30 và 08:00. Anh/chị muốn đi chuyến mấy giờ ạ?",
      updates: {
        entities: { route: "Đà Nẵng -> Nha Trang" },
        scores: { completeness: 30, dispute: 5, readiness: 15 },
        performance: { ttfr: "280ms", turngap: "1.0s", clarify: 0, reduction: "10%" },
        brainMode: "fast",
        revenueTwin: {
          phase: "detecting",
          overlappingTrips: [
            { id: "trip-0700", time: "07:00", seats: 2, fillRate: 90, revenueScore: 62 },
            { id: "trip-0730", time: "07:30", seats: 12, fillRate: 40, revenueScore: 91 },
            { id: "trip-0800", time: "08:00", seats: 15, fillRate: 25, revenueScore: 78 }
          ],
          recommendedTripId: null,
          status: "EVALUATING"
        },
        timeline: [1, 2]
      }
    },
    // Phase 3 — Passenger count extracted
    {
      sender: "customer",
      text: "Chuyến 07:00 cho tôi, đi 3 người nhé.",
      updates: {
        entities: { route: "Đà Nẵng -> Nha Trang", time: "07:00", seats: "3 khách" },
        scores: { completeness: 50, dispute: 5, readiness: 25 },
        performance: { ttfr: "300ms", turngap: "1.1s", clarify: 0, reduction: "20%" },
        brainMode: "fast",
        revenueTwin: {
          phase: "evaluating",
          overlappingTrips: [
            { id: "trip-0700", time: "07:00", seats: 2, fillRate: 90, revenueScore: 62 },
            { id: "trip-0730", time: "07:30", seats: 12, fillRate: 40, revenueScore: 91 },
            { id: "trip-0800", time: "08:00", seats: 15, fillRate: 25, revenueScore: 78 }
          ],
          recommendedTripId: "trip-0730",
          status: "EVALUATING"
        },
        timeline: [1, 2, 3]
      }
    },
    // Phase 4 — Contact + pickup captured → BOOKING_DRAFT_READY
    {
      sender: "customer",
      text: "SĐT tôi là 0905112233. Đón tại bến xe trung tâm Đà Nẵng nhé.",
      updates: {
        entities: {
          route: "Đà Nẵng -> Nha Trang",
          time: "07:00",
          seats: "3 khách",
          phone: "0905112233",
          price: "1.260.000đ",
          deposit: "150.000đ"
        },
        scores: { completeness: 78, dispute: 8, readiness: 40 },
        performance: { ttfr: "320ms", turngap: "1.3s", clarify: 0, reduction: "35%" },
        brainMode: "fast",
        timeline: [1, 2, 3]
      }
    },
    // Phase 5 — Risk engine kicks in: dispute spike from hesitation about price
    {
      sender: "customer",
      text: "Ủa mà chuyến 07:00 có đủ 3 chỗ không em? Lỡ không đi được thì cọc 150k có hoàn không?",
      updates: {
        entities: {
          route: "Đà Nẵng -> Nha Trang",
          time: "07:00",
          seats: "3 khách",
          phone: "0905112233",
          price: "1.260.000đ",
          deposit: "150.000đ"
        },
        scores: { completeness: 82, dispute: 72, readiness: 25 },
        performance: { ttfr: "390ms", turngap: "1.7s", clarify: 1, reduction: "-15%" },
        brainMode: "slow",
        prefetch: "⚠️ Risk Engine: Dispute spike 72 — PRICE_NOT_CONFIRMED + REFUND_POLICY_NOT_CONFIRMED. Cổng thanh toán bị KHÓA.",
        timeline: [1, 2, 3]
      }
    },
    // Phase 6 — AI resolves risk: explains refund policy, price justified
    {
      sender: "ai",
      text: `Dạ chuyến 07:00 hiện chỉ còn 2 chỗ nên chưa đủ cho nhóm 3 khách. ${REFUND_POLICY.spokenSummary} Revenue Twin đề xuất chuyển sang chuyến 07:30 cùng tuyến Đà Nẵng → Nha Trang, còn 12 chỗ, giảm 30.000đ/vé; tổng còn 1.170.000đ và cọc giữ chỗ 150.000đ. Anh/chị xác nhận chuyển sang 07:30 để em tiến hành không ạ?`,
      updates: {
        entities: {
          route: "Đà Nẵng -> Nha Trang",
          time: "07:30",
          seats: "3 khách",
          phone: "0905112233",
          price: "1.170.000đ",
          deposit: "150.000đ"
        },
        scores: { completeness: 90, dispute: 28, readiness: 70 },
        performance: { ttfr: "345ms", turngap: "1.2s", clarify: 1, reduction: "60%" },
        brainMode: "slow",
        revenueTwin: {
          phase: "optimizing",
          overlappingTrips: [
            { id: "trip-0700", time: "07:00", seats: 2, fillRate: 90, revenueScore: 62 },
            { id: "trip-0730", time: "07:30", seats: 12, fillRate: 40, revenueScore: 91 },
            { id: "trip-0800", time: "08:00", seats: 15, fillRate: 25, revenueScore: 78 }
          ],
          recommendedTripId: "trip-0730",
          status: "OPEN",
          winnerReason: "Chuyến 07:30 — còn 12 chỗ đủ cho 3 khách; Revenue Score cao nhất (91/100); Hội tụ FCFS + dynamic incentive -30.000đ/vé."
        },
        timeline: [1, 2, 3, 4]
      }
    },
    // Phase 7 — Customer confirms → AGREEMENT_LOCKED, gate UNLOCKED
    {
      sender: "customer",
      text: "À, được rồi, tôi hiểu rồi. Tôi xác nhận chuyển sang 3 vé chuyến 07:30 Đà Nẵng - Nha Trang, cọc 150.000đ. Mở cổng đi em!",
      updates: {
        entities: {
          route: "Đà Nẵng -> Nha Trang",
          time: "07:30",
          seats: "3 khách",
          phone: "0905112233",
          price: "1.170.000đ",
          deposit: "150.000đ"
        },
        scores: { completeness: 100, dispute: 22, readiness: 92 },
        performance: { ttfr: "285ms", turngap: "1.0s", clarify: 1, reduction: "92%" },
        brainMode: "fast",
        revenueTwin: {
          phase: "accepted",
          overlappingTrips: [
            { id: "trip-0700", time: "07:00", seats: 2, fillRate: 90, revenueScore: 62 },
            { id: "trip-0730", time: "07:30", seats: 12, fillRate: 40, revenueScore: 91 },
            { id: "trip-0800", time: "08:00", seats: 15, fillRate: 25, revenueScore: 78 }
          ],
          recommendedTripId: "trip-0730",
          status: "ACCEPTED",
          winnerReason: "Chuyến 07:30 — còn 12 chỗ đủ cho 3 khách; Revenue Score cao nhất (91/100); Hội tụ FCFS + dynamic incentive -30.000đ/vé.",
          savedRevenue: 1_260_000,
          discountCost: 90_000,
          securedRevenue: 1_170_000
        },
        gateUnlocked: true,
        timeline: [1, 2, 3, 4, 5]
      }
    }
  ];
