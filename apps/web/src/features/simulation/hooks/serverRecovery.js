import { EventName } from "@call-to-cash/shared";

import { ACTION } from "./serverSimulationState.js";

export const recoveryEvents = new Set([
  EventName.BookingCreated,
  EventName.BookingUpdated,
  EventName.AgreementLocked,
  EventName.PaymentIntentCreated,
  EventName.PaymentPending,
  EventName.PaymentConfirmed,
  EventName.PaymentFailed,
  EventName.ReceiptCreated,
  EventName.ReceiptVerified,
  EventName.CallEnded
]);

export function isDefinitivePaymentMismatch(error) {
  return [
    "PAYMENT_AMOUNT_MISMATCH",
    "PAYMENT_RECIPIENT_MISMATCH",
    "PAYMENT_REFERENCE_MISMATCH",
    "PAYMENT_TOKEN_MISMATCH"
  ].includes(error?.code);
}

export async function recoverServerState(apiClient, dispatch, state, callId, hints = {}) {
  const result = {};
  const call = await apiClient.getCall(callId);
  result.call = call;
  dispatch({ type: ACTION.CALL_SYNCED, call });

  try {
    const risk = await apiClient.getRisk(callId);
    result.risk = risk;
    dispatch({ type: ACTION.RISK_SYNCED, risk });
  } catch {
    // A newly-created call has no risk assessment until its first final turn.
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

  dispatch({ type: ACTION.RECOVERY_COMPLETE });
  return result;
}
