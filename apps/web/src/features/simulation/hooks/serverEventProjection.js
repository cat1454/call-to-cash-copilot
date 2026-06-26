import { EventEnvelopeSchema, EventName } from "@call-to-cash/shared";
import { hasCustomerAndAgentTurns } from "./transcriptCompleteness.js";
import { mergeAuthoritativeTranscriptTurn } from "./liveTranscriptProjection.js";
import { sanitizePublicText } from "./transcriptDisplayProjection.js";
import {
  formatDepartureDate,
  formatDepartureTime,
  formatVnd
} from "./bookingDisplayFormatters.js";
import { projectTranscriptAnalysisForDecision } from "./transcriptAnalysisProjection.js";

export { projectTranscriptTurnForDisplay } from "./transcriptDisplayProjection.js";

export const emptyBooking = {
  bookingId: "",
  route: "",
  date: "",
  time: "",
  seats: "",
  phone: "",
  price: "",
  deposit: ""
};

export function projectBookingForDisplay(booking, receipt) {
  if (receipt?.booking) {
    return {
      bookingId: receipt.booking.bookingId,
      route: sanitizePublicText(receipt.booking.route),
      date: formatDepartureDate(receipt.booking.departureAt),
      time: formatDepartureTime(receipt.booking.departureAt),
      seats: receipt.booking.passengerCount ? `${receipt.booking.passengerCount} khách` : "",
      phone: sanitizePublicText(receipt.booking.contactPhoneMasked),
      price: formatVnd(booking?.fareTotalVnd),
      deposit: formatVnd(receipt.deposit?.amount?.minor)
    };
  }
  if (!booking) return { ...emptyBooking };
  return {
    bookingId: booking.bookingId ?? "",
    route: [booking.routeFrom, booking.routeTo].filter(Boolean).join(" → "),
    date: formatDepartureDate(booking.departureAt),
    time: formatDepartureTime(booking.departureAt),
    seats: booking.passengerCount ? `${booking.passengerCount} khách` : "",
    phone: sanitizePublicText(booking.contactPhoneMasked),
    price: formatVnd(booking.fareTotalVnd),
    deposit: formatVnd(booking.depositAmountVnd)
  };
}

export function projectBookingReadModel(booking) {
  return {
    bookingId: booking.bookingId,
    status: booking.status,
    routeFrom: booking.routeFrom,
    routeTo: booking.routeTo,
    departureAt: booking.departureAt,
    passengerCount: booking.passengerCount,
    pickupPoint: booking.pickupPoint,
    contactPhoneMasked: sanitizePublicText(booking.contactPhoneMasked),
    fareTotalVnd: booking.fareTotalVnd,
    depositAmountVnd: booking.depositAmountVnd,
    refundPolicyVersion: booking.refundPolicyVersion,
    agreementVersion: booking.agreementVersion,
    paymentGate: booking.paymentGate
  };
}

export function projectReceiptReadModel(receipt) {
  return {
    receiptId: receipt.receiptId,
    bookingId: receipt.bookingId,
    status: receipt.status,
    booking:
      receipt.booking === undefined
        ? undefined
        : {
            bookingId: receipt.booking.bookingId,
            route: sanitizePublicText(receipt.booking.route),
            departureAt: receipt.booking.departureAt,
            passengerCount: receipt.booking.passengerCount,
            contactPhoneMasked: sanitizePublicText(receipt.booking.contactPhoneMasked)
          },
    deposit:
      receipt.deposit === undefined
        ? undefined
        : {
            amount:
              receipt.deposit.amount === undefined
                ? undefined
                : {
                    currency: receipt.deposit.amount.currency,
                    minor: receipt.deposit.amount.minor
                  },
            status: receipt.deposit.status
          },
    verification:
      receipt.verification === undefined
        ? undefined
        : {
            status: receipt.verification.status,
            agreementVersion: receipt.verification.agreementVersion,
            transactionSignatureShort: receipt.verification.transactionSignatureShort
          }
  };
}

export function projectPaymentIntentReadModel(intent) {
  const providerPayment =
    intent.providerPayment?.provider === "solana_devnet"
      ? {
          provider: "solana_devnet",
          cluster: "devnet",
          amountLamports: intent.providerPayment.amountLamports,
          amountSol: intent.providerPayment.amountSol,
          solanaPayUrl: intent.providerPayment.solanaPayUrl,
          qrPayload: intent.providerPayment.qrPayload,
          memo: intent.providerPayment.memo
        }
      : intent.providerPayment?.provider === "mock"
        ? {
            provider: "mock",
            mode: "deterministic_mock",
            amountMinor: intent.providerPayment.amountMinor
          }
        : null;
  return {
    paymentIntentId: intent.paymentIntentId,
    bookingId: intent.bookingId,
    agreementId: intent.agreementId,
    status: intent.status,
    amount: intent.amount,
    recipient: intent.recipient,
    reference: intent.reference,
    expiresAt: intent.expiresAt,
    idempotencyKey: intent.idempotencyKey,
    provider: intent.provider === "solana_devnet" ? "solana_devnet" : "mock",
    providerPayment
  };
}

export function projectPaymentStatusReadModel(paymentStatus) {
  return {
    bookingId: paymentStatus.bookingId,
    paymentIntentId: paymentStatus.paymentIntentId,
    status: paymentStatus.status,
    transactionSignature: paymentStatus.transactionSignature,
    verifiedAt: paymentStatus.verifiedAt,
    nextAction: paymentStatus.nextAction
  };
}

export function projectVerificationReadModel(verification) {
  return {
    bookingId: verification.bookingId,
    receiptId: verification.receiptId,
    status: verification.status,
    agreementVersion: verification.agreementVersion,
    proofHash: verification.proofHash,
    verifiedAt: verification.verifiedAt,
    nextAction: verification.nextAction
  };
}

function rememberEvent(state, envelope) {
  if (state.seenEventIds.includes(envelope.eventId)) return null;
  const gap = state.lastSequence !== null && envelope.sequence > state.lastSequence + 1;
  return {
    ...state,
    bookingId: envelope.bookingId ?? state.bookingId,
    lastEventId: envelope.eventId,
    lastSequence: Math.max(state.lastSequence ?? 0, envelope.sequence),
    seenEventIds: [...state.seenEventIds.slice(-199), envelope.eventId],
    needsRecovery: state.needsRecovery || gap
  };
}

export function applyServerEvent(state, input) {
  const parsed = EventEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return { ...state, streamError: new Error("Invalid realtime event received.") };
  }
  const envelope = parsed.data;
  const next = rememberEvent(state, envelope);
  if (next === null) return state;
  const data = envelope.data;

  switch (envelope.event) {
    case EventName.CallCreated:
      return { ...next, callStatus: data.status };
    case EventName.CallEnded:
      return {
        ...next,
        callStatus: data.status,
        isSimulating: false,
        simStatus:
          next.postCallTranscriptSync === "PENDING"
            ? "Đang đồng bộ hội thoại sau cuộc gọi..."
            : "Đã hoàn thành"
      };
    case EventName.CallFailed:
      return {
        ...next,
        callStatus: data.status,
        isSimulating: false,
        simStatus: sanitizePublicText(data.customerMessage)
      };
    case EventName.TranscriptTurnCreated: {
      if (next.transcript.some((turn) => turn.turnId === data.turnId)) return next;
      const { transcript, displayTurn } = mergeAuthoritativeTranscriptTurn(next.transcript, data);
      const text = displayTurn.text;
      const transcriptComplete = hasCustomerAndAgentTurns(transcript);
      return {
        ...next,
        transcript,
        subtitles: {
          speaker: displayTurn.sender === "customer" ? "Khách hàng" : "Tổng đài AI",
          text
        },
        postCallTranscriptSync:
          next.postCallTranscriptSync === "PENDING" && transcriptComplete
            ? "COMPLETE"
            : next.postCallTranscriptSync,
        simStatus:
          next.postCallTranscriptSync === "PENDING" && transcriptComplete
            ? "Đã hoàn thành"
            : next.simStatus
      };
    }
    case EventName.TranscriptAnalysisUpdated:
      return {
        ...next,
        transcriptAnalysis: projectTranscriptAnalysisForDecision(data)
      };
    case EventName.RiskScoreUpdated:
      return {
        ...next,
        scores: {
          completeness: data.completenessScore,
          dispute: data.disputeRisk,
          readiness: data.paymentReadiness
        },
        paymentGate: data.paymentGate
      };
    case EventName.RiskPaymentGateUpdated:
      return { ...next, paymentGate: data.paymentGate };
    case EventName.BookingCreated:
      return { ...next, bookingId: data.bookingId };
    case EventName.BookingUpdated:
      return { ...next, booking: { ...next.booking, status: data.status } };
    case EventName.AgreementLocked:
      return {
        ...next,
        booking: { ...next.booking, status: data.status },
        paymentGate: data.paymentGate
      };
    case EventName.PaymentIntentCreated:
      return { ...next, paymentIntentId: data.paymentIntentId };
    case EventName.PaymentConfirmed:
      return {
        ...next,
        showPaymentDrawer: false,
        simStatus: "Thanh toán xác nhận",
        timelineSteps: [1, 2, 3, 4, 5, 6]
      };
    case EventName.PaymentFailed:
      return {
        ...next,
        booking:
          next.booking === null ? null : { ...next.booking, status: "MANUAL_REVIEW_REQUIRED" },
        paymentGate: "MANUAL_REVIEW_REQUIRED",
        showPaymentDrawer: false,
        paymentActionPending: false,
        simStatus: sanitizePublicText(data.customerMessage)
      };
    case EventName.ReceiptCreated:
      return { ...next, receiptId: data.receiptId };
    case EventName.ReceiptVerified:
      return {
        ...next,
        receiptId: data.receiptId,
        showBoardingPass: true,
        isTampered: data.verification === "MISMATCH"
      };
    default:
      return next;
  }
}
