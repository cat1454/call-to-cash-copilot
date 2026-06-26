import {
  applyLiveTranscriptFrame,
  projectRecoveredTranscript,
  subtitleForBubble
} from "./liveTranscriptProjection.js";
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
import { hasCustomerAndAgentTurns } from "./transcriptCompleteness.js";
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
    revenueTwin: { evaluation: null, dashboard: null },
    isSimulating: false,
    replayInputEnabled: false,
    postCallTranscriptSync: "IDLE",
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
    liveTranscriptTurns: [],
    transcriptAnalysis: null,
    subtitles: { speaker: "Tổng đài AI", text: "Đang chờ cuộc gọi..." },
    bookingData: { ...emptyBooking },
    timelineSteps: [],
    showPaymentDrawer: false,
    showBoardingPass: false,
    paymentActionPending: false,
    paymentWalletOpened: false,
    paymentPollAttempt: 0,
    isTampered: false,
    ledgerLogs: { txSig: null, anchoredHash: null, computedHash: null, computedHashColor: null, show: false },
    error: null
  };
}
export const ACTION = {
  START: "START",
  RESUME: "RESUME",
  CALL_CREATED: "CALL_CREATED",
  STREAM_STATUS: "STREAM_STATUS",
  LIVE_TRANSCRIPT_FRAME: "LIVE_TRANSCRIPT_FRAME",
  SERVER_EVENT: "SERVER_EVENT", SERVER_EVENTS: "SERVER_EVENTS",
  CALL_SYNCED: "CALL_SYNCED",
  TRANSCRIPT_SYNCED: "TRANSCRIPT_SYNCED",
  POST_CALL_TRANSCRIPT_SYNC_STARTED: "POST_CALL_TRANSCRIPT_SYNC_STARTED",
  POST_CALL_TRANSCRIPT_SYNC_TIMED_OUT: "POST_CALL_TRANSCRIPT_SYNC_TIMED_OUT",
  RISK_SYNCED: "RISK_SYNCED",
  BOOKING_SYNCED: "BOOKING_SYNCED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  PAYMENT_INTENT_CREATED: "PAYMENT_INTENT_CREATED",
  PAYMENT_STATUS_SYNCED: "PAYMENT_STATUS_SYNCED",
  PAYMENT_ACTION_STARTED: "PAYMENT_ACTION_STARTED",
  PAYMENT_WALLET_OPENED: "PAYMENT_WALLET_OPENED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  RECEIPT_SYNCED: "RECEIPT_SYNCED",
  VERIFICATION_SYNCED: "VERIFICATION_SYNCED",
  REVENUE_TWIN_SYNCED: "REVENUE_TWIN_SYNCED",
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
    case ACTION.LIVE_TRANSCRIPT_FRAME:
      return applyLiveTranscriptFrame(state, action.frame);
    case ACTION.SERVER_EVENT: return applyServerEvent(state, action.envelope);
    case ACTION.SERVER_EVENTS:
      return action.envelopes.reduce((nextState, envelope) => applyServerEvent(nextState, envelope), state);
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
    case ACTION.TRANSCRIPT_SYNCED: {
      const transcript = projectRecoveredTranscript(action.transcript.turns);
      const transcriptComplete = hasCustomerAndAgentTurns(transcript);
      const latestTurn = transcript.at(-1);
      return {
        ...state,
        transcript,
        subtitles: latestTurn === undefined ? state.subtitles : subtitleForBubble(latestTurn),
        postCallTranscriptSync:
          state.postCallTranscriptSync === "PENDING" && transcriptComplete
            ? "COMPLETE"
            : state.postCallTranscriptSync,
        simStatus:
          state.postCallTranscriptSync === "PENDING" && transcriptComplete
            ? "Đã hoàn thành"
            : state.simStatus
      };
    }
    case ACTION.POST_CALL_TRANSCRIPT_SYNC_STARTED:
      return {
        ...state,
        isSimulating: false,
        postCallTranscriptSync: "PENDING",
        simStatus: "Đang đồng bộ hội thoại sau cuộc gọi..."
      };
    case ACTION.POST_CALL_TRANSCRIPT_SYNC_TIMED_OUT:
      return {
        ...state,
        isSimulating: false,
        postCallTranscriptSync: "TIMED_OUT",
        simStatus: "Đã hoàn thành"
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
        paymentWalletOpened: false,
        paymentPollAttempt: 0,
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
    case ACTION.PAYMENT_WALLET_OPENED:
      return {
        ...state,
        paymentWalletOpened: true,
        paymentPollAttempt: 0,
        simStatus: "Đã mở ví, đang chờ giao dịch trên Devnet..."
      };
    case ACTION.PAYMENT_PENDING:
      return {
        ...state,
        paymentActionPending: false,
        paymentPollAttempt: state.paymentPollAttempt + 1,
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
    case ACTION.REVENUE_TWIN_SYNCED:
      return { ...state, revenueTwin: { ...state.revenueTwin, ...action.revenueTwin } };
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
