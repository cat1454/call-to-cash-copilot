const TAMPER_ROUTES = [
  "Đà Nẵng -> Nha Trang",
  "Hà Nội -> Sài Gòn",
  "Lào Cai -> Hà Nội"
];

export function generateMockHash(data) {
  const str = `${data.bookingId}-${data.route}-${data.time}-${data.seats}-${data.phone}-${data.price}-${data.deposit}`;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return "sol_proof_" + Math.abs(hash).toString(16).padStart(16, "0") + "x7d28c";
}

export function createTxSignature() {
  return (
    "sol_tx_" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export function createRandomTamperDetails() {
  const hackedRoute =
    TAMPER_ROUTES[Math.floor(Math.random() * TAMPER_ROUTES.length)] + " (HACKED)";

  return {
    hackedRoute,
    hackedSeats: "10 ghế (HACKED)"
  };
}

export function createTamperPayload(bookingData, { hackedRoute, hackedSeats }) {
  return {
    ...bookingData,
    route: hackedRoute,
    seats: hackedSeats
  };
}
