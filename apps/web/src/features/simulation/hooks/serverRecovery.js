import { EventName } from "@call-to-cash/shared";

import { ACTION } from "./serverSimulationState.js";

export const recoveryEvents = new Set([
  EventName.TranscriptAnalysisUpdated,
  EventName.BookingCreated,
  EventName.BookingUpdated,
  EventName.AgreementLocked,
  EventName.PaymentIntentCreated,
  EventName.PaymentPending,
  EventName.PaymentConfirmed,
  EventName.PaymentFailed,
  EventName.ReceiptCreated,
  EventName.ReceiptVerified,
  EventName.CallEnded,
  EventName.RevenueTwinEvaluated,
  EventName.RevenueTwinOfferAccepted,
  EventName.RevenueTwinOfferDeclined,
  EventName.RevenueTwinOfferExpired,
  EventName.RevenueTwinReevaluationRequired,
  EventName.RevenueTwinWaitlistJoined
]);

/**
 * SSE deliberately carries only a compact, privacy-safe projection.  Reload
 * the server read models after a state-changing event so the customer summary
 * never has to reconstruct booking fields from event fragments.
 */
export function recoveryHintsForEvent(eventName, envelope) {
  if (!recoveryEvents.has(eventName)) return null;
  const data = envelope?.data ?? {};
  return {
    ...(typeof envelope?.bookingId === "string" ? { bookingId: envelope.bookingId } : {}),
    ...(typeof data.paymentIntentId === "string" ? { paymentIntentId: data.paymentIntentId } : {}),
    ...(typeof data.receiptId === "string" ? { receiptId: data.receiptId } : {})
  };
}

export function isDefinitivePaymentMismatch(error) {
  return [
    "PAYMENT_AMOUNT_MISMATCH",
    "PAYMENT_RECIPIENT_MISMATCH",
    "PAYMENT_REFERENCE_MISMATCH",
    "PAYMENT_TOKEN_MISMATCH"
  ].includes(error?.code);
}

export function isRetryablePaymentPending(error) {
  return [
    "PAYMENT_VERIFICATION_PENDING",
    "PAYMENT_TRANSACTION_NOT_FOUND",
    "PAYMENT_TRANSACTION_UNCONFIRMED",
    "SOLANA_RPC_UNAVAILABLE",
    "SOLANA_RPC_TIMEOUT"
  ].includes(error?.code);
}

export async function recoverServerState(apiClient, dispatch, state, callId, hints = {}) {
  const result = {};
  const call = await apiClient.getCall(callId);
  result.call = call;
  dispatch({ type: ACTION.CALL_SYNCED, call });
  const transcript = await apiClient.getTranscript(callId);
  result.transcript = transcript;
  dispatch({ type: ACTION.TRANSCRIPT_SYNCED, transcript });

  if (call.booking !== null) {
    const risk = await apiClient.getRisk(callId);
    result.risk = risk;
    dispatch({ type: ACTION.RISK_SYNCED, risk });
  }

  const bookingId = hints.bookingId ?? call.booking?.bookingId ?? state.bookingId;
  if (bookingId) {
    const booking = await apiClient.getBooking(bookingId);
    result.booking = booking;
    dispatch({ type: ACTION.BOOKING_SYNCED, booking });
    if (hints.paymentIntentId ?? state.paymentIntentId) {
      try {
        result.paymentStatus = await apiClient.getPaymentStatus(bookingId);
        dispatch({ type: ACTION.PAYMENT_STATUS_SYNCED, paymentStatus: result.paymentStatus });
      } catch {
        // Payment status is absent until an intent is committed.
      }
    }
  }

  const receiptId = hints.receiptId ?? state.receiptId;
  if (receiptId) {
    const [receipt, verification] = await Promise.all([
      apiClient.getReceipt(receiptId),
      apiClient.verifyReceipt(receiptId)
    ]);
    result.receipt = receipt;
    result.verification = verification;
    dispatch({ type: ACTION.RECEIPT_SYNCED, receipt });
    dispatch({ type: ACTION.VERIFICATION_SYNCED, verification });
  }

  const canSyncRevenueTwin =
    typeof apiClient.getLatestRevenueTwinEvaluation === "function" ||
    typeof apiClient.getRevenueTwinDashboard === "function";
  if (typeof apiClient.getLatestRevenueTwinEvaluation === "function") {
    result.revenueTwinEvaluation = await apiClient.getLatestRevenueTwinEvaluation(callId);
  }

  if (typeof apiClient.getRevenueTwinDashboard === "function") {
    result.revenueTwinDashboard = await apiClient.getRevenueTwinDashboard();
  }
  if (canSyncRevenueTwin) {
    dispatch({
      type: ACTION.REVENUE_TWIN_SYNCED,
      revenueTwin: {
        evaluation: result.revenueTwinEvaluation ?? null,
        dashboard: result.revenueTwinDashboard ?? null
      }
    });
  }

  dispatch({ type: ACTION.RECOVERY_COMPLETE });
  return result;
}
