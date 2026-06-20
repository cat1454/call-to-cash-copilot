/**
 * serverSimulationState — Phase 7 reducer + constants for useServerSimulation.
 * Kept in a separate module so useServerSimulation stays under 300 lines.
 */

/** @returns {object} Canonical initial server state */
export function makeInitialState() {
  return {
    callId: null,
    bookingId: null,
    paymentIntentId: null,
    receiptId: null,
    isSimulating: false,
    simStatus: "Sẵn sàng",
    scores: { completeness: 0, dispute: 0, readiness: 0 },
    paymentGate: "LOCKED",
    transcript: [],
    timelineSteps: [],
    showPaymentDrawer: false,
    showBoardingPass: false,
    isTampered: false,
    ledgerLogs: { txSig: null, anchoredHash: null, computedHash: null, computedHashColor: null, show: false },
    error: null
  };
}

export const ACTION = {
  START: "START",
  CALL_CREATED: "CALL_CREATED",
  TURN_ADDED: "TURN_ADDED",
  RISK_UPDATED: "RISK_UPDATED",
  GATE_UPDATED: "GATE_UPDATED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  PAYMENT_DRAWER_OPEN: "PAYMENT_DRAWER_OPEN",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  RECEIPT_CREATED: "RECEIPT_CREATED",
  RECEIPT_VERIFIED: "RECEIPT_VERIFIED",
  TAMPER_APPLIED: "TAMPER_APPLIED",
  RESET: "RESET",
  ERROR: "ERROR"
};

export function reducer(state, action) {
  switch (action.type) {
    case ACTION.START:
      return { ...state, isSimulating: true, simStatus: "Đang kết nối...", error: null };
    case ACTION.CALL_CREATED:
      return { ...state, callId: action.callId, simStatus: "Đang trong cuộc gọi..." };
    case ACTION.TURN_ADDED:
      return {
        ...state,
        transcript: [...state.transcript, { speaker: action.speaker, text: action.text, turnId: action.turnId }]
      };
    case ACTION.RISK_UPDATED:
      return {
        ...state,
        scores: { completeness: action.completenessScore, dispute: action.disputeRisk, readiness: action.paymentReadiness }
      };
    case ACTION.GATE_UPDATED:
      return {
        ...state,
        paymentGate: action.gate,
        bookingId: action.bookingId ?? state.bookingId,
        timelineSteps: action.gate === "UNLOCKED" ? [1, 2, 3, 4, 5] : state.timelineSteps,
        isSimulating: action.gate === "UNLOCKED" ? false : state.isSimulating
      };
    case ACTION.BOOKING_UPDATED:
      return { ...state, bookingId: action.bookingId ?? state.bookingId };
    case ACTION.PAYMENT_DRAWER_OPEN:
      return {
        ...state,
        paymentIntentId: action.paymentIntentId,
        showPaymentDrawer: true,
        simStatus: "Đợi quét mã cọc...",
        isSimulating: false
      };
    case ACTION.PAYMENT_CONFIRMED:
      return { ...state, showPaymentDrawer: false, simStatus: "Thanh toán xác nhận", timelineSteps: [1, 2, 3, 4, 5, 6] };
    case ACTION.RECEIPT_CREATED:
      return { ...state, receiptId: action.receiptId, showBoardingPass: true };
    case ACTION.RECEIPT_VERIFIED:
      return {
        ...state,
        ledgerLogs: {
          txSig: action.txSig ?? null,
          anchoredHash: action.proofHash ?? null,
          computedHash: action.proofHash ?? null,
          computedHashColor: action.status === "MATCH" ? "var(--success-green)" : "var(--danger-red)",
          show: true
        }
      };
    case ACTION.TAMPER_APPLIED:
      return { ...state, isTampered: true };
    case ACTION.RESET:
      return makeInitialState();
    case ACTION.ERROR:
      return { ...state, error: action.error, simStatus: "Lỗi: " + action.error.message };
    default:
      return state;
  }
}
