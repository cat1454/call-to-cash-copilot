export const DEFAULT_PHONE_STATUS = "Đang chờ kết nối từ hành khách...";
export const DEFAULT_PAYMENT_TIMER = "⏰ Thời gian giữ chỗ: 10:00";
export const DEFAULT_PAYMENT_BUTTON = "Xác nhận chuyển cọc từ Ví";

export function createBookingId() {
  return "BK-" + Math.floor(1000 + Math.random() * 9000);
}

export function createInitialBookingData() {
  return {
    bookingId: createBookingId(),
    route: "",
    time: "",
    seats: "",
    phone: "",
    price: "",
    deposit: ""
  };
}

export function createInitialSubtitles() {
  return {
    speaker: "Tổng đài AI",
    text: "Hệ thống đang trực tuyến. Đang chờ kết nối thoại..."
  };
}

export function createInitialTranscript() {
  return [
    {
      sender: "ai",
      text: "Dạ, nhà xe Hà Nội - Sa Pa xin kính chào anh/chị! Em có thể giúp gì cho anh/chị đặt chuyến hôm nay ạ?"
    }
  ];
}

export function createInitialScores() {
  return { completeness: 0, dispute: 0, readiness: 0 };
}

export function createInitialPerformance() {
  return { ttfr: "--", turngap: "--", clarify: 0, reduction: "--" };
}

export function createInitialLedgerLogs() {
  return {
    txSig: "0x...",
    anchoredHash: "-",
    computedHash: "-",
    computedHashColor: "var(--success-green)",
    show: false,
    entities: {}
  };
}
