import {
  BookingStatus,
  CallStatus,
  PaymentIntentStatus,
  ReceiptStatus,
  type ErrorCode,
  type EnumValue
} from "@call-to-cash/shared";

export type StateTransitionResult<S extends string> =
  | { ok: true; status: S }
  | { ok: false; status: S; errorCode: ErrorCode };

type CallStatusValue = EnumValue<typeof CallStatus>;
type BookingStatusValue = EnumValue<typeof BookingStatus>;
type PaymentIntentStatusValue = EnumValue<typeof PaymentIntentStatus>;
type ReceiptStatusValue = EnumValue<typeof ReceiptStatus>;

function transition<S extends string>(
  current: S,
  target: S,
  transitions: Readonly<Record<S, readonly S[]>>,
  errorCode: ErrorCode
): StateTransitionResult<S> {
  if (current === target || transitions[current].includes(target)) {
    return { ok: true, status: target };
  }

  return { ok: false, status: current, errorCode };
}

const callTransitions: Readonly<Record<CallStatusValue, readonly CallStatusValue[]>> = {
  [CallStatus.Created]: [CallStatus.Active, CallStatus.Cancelled, CallStatus.Failed],
  [CallStatus.Active]: [CallStatus.Ended, CallStatus.Failed],
  [CallStatus.Ended]: [],
  [CallStatus.Failed]: [],
  [CallStatus.Cancelled]: []
};

const bookingTransitions: Readonly<Record<BookingStatusValue, readonly BookingStatusValue[]>> = {
  [BookingStatus.Draft]: [BookingStatus.FieldsPartial, BookingStatus.Cancelled],
  [BookingStatus.FieldsPartial]: [BookingStatus.BookingDraftReady, BookingStatus.Cancelled],
  [BookingStatus.BookingDraftReady]: [BookingStatus.AgreementReady, BookingStatus.Cancelled],
  [BookingStatus.AgreementReady]: [
    BookingStatus.AgreementLocked,
    BookingStatus.Cancelled,
    BookingStatus.Expired
  ],
  [BookingStatus.AgreementLocked]: [
    BookingStatus.PaymentPending,
    BookingStatus.ManualReviewRequired,
    BookingStatus.Expired
  ],
  [BookingStatus.PaymentPending]: [
    BookingStatus.PaymentConfirmed,
    BookingStatus.ManualReviewRequired,
    BookingStatus.Expired
  ],
  [BookingStatus.PaymentConfirmed]: [
    BookingStatus.BookingConfirmed,
    BookingStatus.ManualReviewRequired
  ],
  [BookingStatus.BookingConfirmed]: [
    BookingStatus.ReceiptIssued,
    BookingStatus.ManualReviewRequired
  ],
  [BookingStatus.ReceiptIssued]: [BookingStatus.ManualReviewRequired],
  [BookingStatus.Cancelled]: [],
  [BookingStatus.ManualReviewRequired]: [],
  [BookingStatus.Expired]: []
};

const paymentIntentTransitions: Readonly<
  Record<PaymentIntentStatusValue, readonly PaymentIntentStatusValue[]>
> = {
  [PaymentIntentStatus.NotCreated]: [PaymentIntentStatus.Created],
  [PaymentIntentStatus.Created]: [
    PaymentIntentStatus.Pending,
    PaymentIntentStatus.Expired,
    PaymentIntentStatus.Cancelled,
    PaymentIntentStatus.ManualReviewRequired
  ],
  [PaymentIntentStatus.Pending]: [
    PaymentIntentStatus.Confirmed,
    PaymentIntentStatus.Rejected,
    PaymentIntentStatus.ManualReviewRequired,
    PaymentIntentStatus.Failed,
    PaymentIntentStatus.Expired,
    PaymentIntentStatus.Cancelled
  ],
  [PaymentIntentStatus.Confirmed]: [],
  [PaymentIntentStatus.Failed]: [
    PaymentIntentStatus.Pending,
    PaymentIntentStatus.ManualReviewRequired
  ],
  [PaymentIntentStatus.Expired]: [],
  [PaymentIntentStatus.Rejected]: [],
  [PaymentIntentStatus.ManualReviewRequired]: [],
  [PaymentIntentStatus.Cancelled]: []
};

const receiptTransitions: Readonly<Record<ReceiptStatusValue, readonly ReceiptStatusValue[]>> = {
  [ReceiptStatus.NotCreated]: [ReceiptStatus.Issued],
  [ReceiptStatus.Issued]: [
    ReceiptStatus.VerifiedMatch,
    ReceiptStatus.Mismatch,
    ReceiptStatus.ManualReview
  ],
  [ReceiptStatus.VerifiedMatch]: [ReceiptStatus.Mismatch],
  [ReceiptStatus.Mismatch]: [],
  [ReceiptStatus.ManualReview]: []
};

export function transitionCall(
  current: CallStatusValue,
  target: CallStatusValue
): StateTransitionResult<CallStatusValue> {
  return transition(current, target, callTransitions, "CALL_NOT_ACTIVE");
}

export function transitionBooking(
  current: BookingStatusValue,
  target: BookingStatusValue
): StateTransitionResult<BookingStatusValue> {
  return transition(current, target, bookingTransitions, "BOOKING_STATE_CONFLICT");
}

export function transitionPaymentIntent(
  current: PaymentIntentStatusValue,
  target: PaymentIntentStatusValue
): StateTransitionResult<PaymentIntentStatusValue> {
  return transition(current, target, paymentIntentTransitions, "PAYMENT_INTENT_CANCELLED");
}

export function transitionReceipt(
  current: ReceiptStatusValue,
  target: ReceiptStatusValue
): StateTransitionResult<ReceiptStatusValue> {
  return transition(current, target, receiptTransitions, "RECEIPT_NOT_READY");
}
