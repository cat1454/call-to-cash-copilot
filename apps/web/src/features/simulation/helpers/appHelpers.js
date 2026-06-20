/**
 * appHelpers — helper functions extracted from App.jsx to satisfy the 300-line guardrail.
 */

export function getReadinessScore(sim) {
  if (sim.simStatus === "Sẵn sàng") return 0;
  if (sim.ledgerLogs.show) return 98;

  if (
    sim.simStatus === "Chờ thanh toán cọc" ||
    sim.simStatus === "Đang cọc (Solana Pay)..."
  ) {
    return 94;
  }

  if (sim.scores.completeness >= 85) return 88;
  if (sim.bookingData.phone) return 76;
  if (sim.bookingData.seats) return 58;

  return 20;
}

export function getAIDecision(sim) {
  if (sim.simStatus === "Sẵn sàng") {
    return {
      understood: "Chưa bắt đầu cuộc đàm thoại.",
      missing:
        "Yêu cầu đầy đủ: lộ trình, giờ chạy, số lượng hành khách, SĐT liên hệ, xác nhận cọc.",
      risk: "N/A",
      gate: "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
      next: "Bấm nút micro để tiếp nhận kết nối cuộc gọi.",
    };
  }

  if (sim.ledgerLogs.show) {
    return {
      understood: `${sim.bookingData.route || "Sa Pa"}, ${sim.bookingData.time
        }, ${sim.bookingData.seats}, SĐT: ${sim.bookingData.phone || "0912***678"
        }`,
      missing: "Không. Giao dịch đã hoàn tất thành công.",
      risk: sim.isTampered
        ? "NGUY HIỂM (SAI KHỚP HASH)"
        : "AN TOÀN / THẤP",
      gate: "ĐÃ XÁC THỰC / KHÓA",
      next: sim.isTampered
        ? "⚠ Từ chối vé xe. Yêu cầu bộ phận an ninh can thiệp và kiểm tra thủ công."
        : "Cấp biên nhận xác minh. Chúc khách hàng thượng lộ bình an!",
    };
  }

  if (
    sim.simStatus === "Chờ thanh toán cọc" ||
    sim.simStatus === "Đang cọc (Solana Pay)..."
  ) {
    return {
      understood: `${sim.bookingData.route || "Hà Nội -> Sa Pa"}, ${sim.bookingData.time
        }, ${sim.bookingData.seats}, SĐT: ${sim.bookingData.phone || "0912***678"
        }`,
      missing: "Không. Đang đợi hành khách quét mã chuyển tiền cọc.",
      risk: "AN TOÀN / THẤP",
      gate: "ĐÃ MỞ / SẴN SÀNG",
      next: "Đang kiểm tra xác thực mạng lưới Solana & neo băm thỏa thuận đặt vé.",
    };
  }

  const understood = [];

  if (sim.bookingData.route) {
    understood.push(`Tuyến: ${sim.bookingData.route}`);
  }

  if (sim.bookingData.time) {
    understood.push(`Giờ: ${sim.bookingData.time}`);
  }

  if (sim.bookingData.seats) {
    understood.push(`Khách: ${sim.bookingData.seats}`);
  }

  if (sim.bookingData.phone) {
    understood.push(`SĐT: ${sim.bookingData.phone}`);
  }

  const missing = [];

  if (!sim.bookingData.route) missing.push("lộ trình");
  if (!sim.bookingData.time) missing.push("giờ chạy");
  if (!sim.bookingData.seats) missing.push("số khách");
  if (!sim.bookingData.phone) missing.push("số điện thoại");

  const transMissing = {
    "lộ trình": "lộ trình hành trình",
    "giờ chạy": "khung giờ khởi hành",
    "số khách": "số lượng hành khách đi cùng",
    "số điện thoại": "số điện thoại liên hệ",
  };

  const next =
    missing.length > 0
      ? `Đặt câu hỏi để lấy thông tin về ${transMissing[missing[0]] || missing[0]
      }.`
      : "Đọc to điều khoản cọc bảo lưu và yêu cầu khách hàng xác nhận sự đồng ý.";

  return {
    understood: understood.join(", ") || "Đang nhận diện giọng nói...",
    missing:
      missing.join(", ") ||
      "Thông tin đã đủ. Cần khách xác nhận đồng ý đặt cọc.",
    risk:
      sim.scores.dispute > 50 ? "TRUNG BÌNH / CAO" : "AN TOÀN / THẤP",
    gate:
      sim.scores.completeness >= 85 &&
        sim.scores.readiness >= 80 &&
        sim.scores.dispute <= 35
        ? "ĐÃ MỞ / SẴN SÀNG"
        : "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
    next,
  };
}
