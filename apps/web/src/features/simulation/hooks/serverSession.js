import {
  BookingIdSchema,
  CallIdSchema,
  PaymentIntentIdSchema,
  ReceiptIdSchema
} from "@call-to-cash/shared";

const STORAGE_KEY = "call-to-cash:server-session:v1";

function getStorage(storage) {
  return storage ?? globalThis.sessionStorage;
}

export function readServerSession(storage) {
  try {
    const value = getStorage(storage).getItem(STORAGE_KEY);
    if (value === null) return null;
    const candidate = JSON.parse(value);
    if (!CallIdSchema.safeParse(candidate?.callId).success) return null;

    const optionalIds = [
      ["bookingId", BookingIdSchema],
      ["paymentIntentId", PaymentIntentIdSchema],
      ["receiptId", ReceiptIdSchema]
    ];
    for (const [field, schema] of optionalIds) {
      if (candidate[field] !== undefined && !schema.safeParse(candidate[field]).success)
        return null;
    }

    if (ReceiptIdSchema.safeParse(candidate.receiptId).success) return null;

    return {
      callId: candidate.callId,
      ...(candidate.bookingId ? { bookingId: candidate.bookingId } : {}),
      ...(candidate.paymentIntentId ? { paymentIntentId: candidate.paymentIntentId } : {}),
      ...(candidate.receiptId ? { receiptId: candidate.receiptId } : {})
    };
  } catch {
    return null;
  }
}

export function shouldPersistServerSession(state) {
  return (
    CallIdSchema.safeParse(state?.callId).success &&
    !ReceiptIdSchema.safeParse(state?.receiptId).success &&
    state?.paymentGate !== "MANUAL_REVIEW_REQUIRED"
  );
}

export function writeServerSession(storage, state) {
  if (!CallIdSchema.safeParse(state?.callId).success) return;
  const snapshot = {
    callId: state.callId,
    ...(BookingIdSchema.safeParse(state.bookingId).success ? { bookingId: state.bookingId } : {}),
    ...(PaymentIntentIdSchema.safeParse(state.paymentIntentId).success
      ? { paymentIntentId: state.paymentIntentId }
      : {}),
    ...(ReceiptIdSchema.safeParse(state.receiptId).success ? { receiptId: state.receiptId } : {})
  };
  try {
    getStorage(storage).setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Recovery storage is best-effort; the live API/SSE flow remains authoritative.
  }
}

export function clearServerSession(storage) {
  try {
    getStorage(storage).removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
