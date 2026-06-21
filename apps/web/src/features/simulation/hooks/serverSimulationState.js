import {
  applyServerEvent,
  emptyBooking,
  projectBookingForDisplay,
  projectBookingReadModel,
  projectPaymentIntentReadModel,
  projectPaymentStatusReadModel,
  projectVerificationReadModel,
  projectReceiptReadModel
} from "./serverEventProjection.js";

export { projectBookingForDisplay } from "./serverEventProjection.js";

export function makeInitialState() {
  return {
    callId: null,
    callStatus: null,
    bookingId: null,
    paymentIntentId: null,
    receiptId: null,
    booking: null,
    paymentIntent: null,
    paymentStatus: null,
    receipt: null,
    verification: null,
    isSimulating: false,
    replayInputEnabled: false,
    simStatus: "Sẵn sàng",
    streamStatus: "idle",
    streamError: null,
    lastEventId: null,
    lastSequence: null,
    seenEventIds: [],
    needsRecovery: false,
    scores: { completeness: 0, dispute: 0, readiness: 0 },
    paymentGate: "LOCKED",
    transcript: [],
    subtitles: { speaker: "Tổng đài AI", text: "Đang chờ cuộc gọi..." },
    bookingData: { ...emptyBooking },
    timelineSteps: [],
    showPaymentDrawer: false,
    showBoardingPass: false,
    paymentActionPending: false,
    isTampered: false,
    ledgerLogs: {
      txSig: null,
      anchoredHash: null,
      computedHash: null,
      computedHashColor: null,
      show: false
    },
    error: null
  };
}

export const ACTION = {
  START: "START",
  RESUME: "RESUME",
  CALL_CREATED: "CALL_CREATED",
  STREAM_STATUS: "STREAM_STATUS",
  SERVER_EVENT: "SERVER_EVENT",
  CALL_SYNCED: "CALL_SYNCED",
  TRANSCRIPT_SYNCED: "TRANSCRIPT_SYNCED",
  RISK_SYNCED: "RISK_SYNCED",
  BOOKING_SYNCED: "BOOKING_SYNCED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  PAYMENT_INTENT_CREATED: "PAYMENT_INTENT_CREATED",
  PAYMENT_STATUS_SYNCED: "PAYMENT_STATUS_SYNCED",
  PAYMENT_ACTION_STARTED: "PAYMENT_ACTION_STARTED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  RECEIPT_SYNCED: "RECEIPT_SYNCED",
  VERIFICATION_SYNCED: "VERIFICATION_SYNCED",
  RECOVERY_COMPLETE: "RECOVERY_COMPLETE",
  RESET: "RESET",
  ERROR: "ERROR"
};

export function reducer(state, action) {
  switch (action.type) {
    case ACTION.START:
      return {
        ...makeInitialState(),
        isSimulating: true,
        replayInputEnabled: true,
        simStatus: "Đang kết nối...",
        streamStatus: "connecting"
      };
    case ACTION.RESUME:
      return {
        ...makeInitialState(),
        ...action.snapshot,
        isSimulating: true,
        replayInputEnabled: false,
        simStatus: "Đang khôi phục phiên...",
        streamStatus: "connecting"
      };
    case ACTION.CALL_CREATED:
      return {
        ...state,
        callId: action.call.callId,
        callStatus: action.call.status,
        replayInputEnabled: action.live === true ? false : state.replayInputEnabled,
        simStatus: "Cuộc gọi đang trực tiếp"
      };
    case ACTION.STREAM_STATUS:
      return {
        ...state,
        streamStatus: action.status,
        streamError: action.error ?? (action.status === "open" ? null : state.streamError)
      };
    case ACTION.SERVER_EVENT:
      return applyServerEvent(state, action.envelope);
    case ACTION.CALL_SYNCED:
      return {
        ...state,
        callStatus: action.call.status,
        bookingId: action.call.booking?.bookingId ?? state.bookingId,
        isSimulating: ["ENDED", "CANCELLED", "FAILED"].includes(action.call.status)
          ? false
          : state.isSimulating,
        simStatus: ["ENDED", "CANCELLED"].includes(action.call.status)
          ? "Đã hoàn thành"
          : state.simStatus
      };
    case ACTION.TRANSCRIPT_SYNCED:
      return {
        ...state,
        transcript: [...action.transcript.turns]
          .sort((left, right) => left.sequenceNo - right.sequenceNo)
          .filter((turn, index, turns) => turns.findIndex((item) => item.turnId === turn.turnId) === index)
          .map((turn) => ({
            sender: turn.speaker === "CUSTOMER" ? "customer" : "ai",
            text: turn.content,
            turnId: turn.turnId
          }))
      };
    case ACTION.RISK_SYNCED:
      return {
        ...state,
        scores: {
          completeness: action.risk.completenessScore,
          dispute: action.risk.disputeRisk,
          readiness: action.risk.paymentReadiness
        },
        paymentGate: action.risk.paymentGate
      };
    case ACTION.BOOKING_SYNCED: {
      const booking = projectBookingReadModel(action.booking);
      return {
        ...state,
        booking,
        bookingId: booking.bookingId,
        bookingData: projectBookingForDisplay(booking, state.receipt)
      };
    }
    case ACTION.BOOKING_CONFIRMED:
      return {
        ...state,
        booking: { ...state.booking, status: action.confirmation.status },
        paymentGate: action.confirmation.paymentGate,
        timelineSteps: [1, 2, 3, 4, 5]
      };
    case ACTION.PAYMENT_INTENT_CREATED: {
      const paymentIntent = projectPaymentIntentReadModel(action.intent);
      return {
        ...state,
        paymentIntent,
        paymentIntentId: paymentIntent.paymentIntentId,
        showPaymentDrawer: true,
        simStatus: "Chờ thanh toán cọc"
      };
    }
    case ACTION.PAYMENT_STATUS_SYNCED: {
      const paymentStatus = projectPaymentStatusReadModel(action.paymentStatus);
      return {
        ...state,
        paymentStatus,
        paymentIntentId: paymentStatus.paymentIntentId,
        showPaymentDrawer: paymentStatus.status === "CONFIRMED" ? false : state.showPaymentDrawer,
        simStatus: paymentStatus.status === "CONFIRMED" ? "Thanh toán xác nhận" : state.simStatus
      };
    }
    case ACTION.PAYMENT_ACTION_STARTED:
      return { ...state, paymentActionPending: true, simStatus: "Đang xác minh thanh toán..." };
    case ACTION.PAYMENT_PENDING:
      return {
        ...state,
        paymentActionPending: false,
        showPaymentDrawer: true,
        error: null,
        simStatus: "Đang chờ giao dịch trên Devnet..."
      };
    case ACTION.PAYMENT_VERIFIED:
      return {
        ...state,
        paymentActionPending: false,
        showPaymentDrawer: false,
        receiptId: action.result.receiptId,
        simStatus: "Thanh toán xác nhận"
      };
    case ACTION.PAYMENT_REJECTED:
      return {
        ...state,
        paymentActionPending: false,
        showPaymentDrawer: false,
        paymentGate: "MANUAL_REVIEW_REQUIRED",
        booking:
          state.booking === null ? null : { ...state.booking, status: "MANUAL_REVIEW_REQUIRED" },
        error: action.error,
        simStatus: action.error.message
      };
    case ACTION.RECEIPT_SYNCED: {
      const receipt = projectReceiptReadModel(action.receipt);
      return {
        ...state,
        receipt,
        receiptId: receipt.receiptId,
        bookingData: projectBookingForDisplay(state.booking, receipt)
      };
    }
    case ACTION.VERIFICATION_SYNCED: {
      const verification = projectVerificationReadModel(action.verification);
      const mismatch = verification.status === "MISMATCH";
      return {
        ...state,
        verification,
        showBoardingPass: true,
        isTampered: mismatch,
        ledgerLogs: {
          txSig: state.receipt?.verification?.transactionSignatureShort ?? null,
          anchoredHash: verification.proofHash,
          computedHash: verification.proofHash,
          computedHashColor: mismatch ? "var(--error-red)" : "var(--success-green)",
          show: true
        },
        simStatus: mismatch ? "Cần kiểm tra thủ công" : "Đã hoàn thành"
      };
    }
    case ACTION.RECOVERY_COMPLETE:
      return { ...state, needsRecovery: false };
    case ACTION.RESET:
      return makeInitialState();
    case ACTION.ERROR:
      return {
        ...state,
        error: action.error,
        paymentActionPending: false,
        isSimulating: false,
        simStatus: action.error.message
      };
    default:
      return state;
  }
}
