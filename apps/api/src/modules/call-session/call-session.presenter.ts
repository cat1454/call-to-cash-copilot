import { PaymentGateStatus, type RiskReasonCode } from "@call-to-cash/shared";

export function iso(date: Date): string {
  return date.toISOString();
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/gu, "");
  if (digits.length < 7) {
    return "[PHONE]";
  }

  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

export function redactContent(content: string): string {
  return content.replace(/\b0\d{8,10}\b/gu, (phone) => maskPhone(phone));
}

export function formatTranscriptForDisplay(content: string): string {
  const normalized = content
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.!?;:])/gu, "$1")
    .trim();
  if (normalized.length === 0) return normalized;
  const capitalized = `${normalized[0]?.toLocaleUpperCase("vi-VN")}${normalized.slice(1)}`;
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

export function presentCreatedCall(call: {
  publicId: string;
  status: string;
  channelName: string;
  sourceMode: string;
  createdAt: Date;
}) {
  return {
    callId: call.publicId,
    status: call.status,
    channelName: call.channelName,
    sourceMode: call.sourceMode,
    createdAt: iso(call.createdAt)
  };
}

export function presentCall(call: {
  publicId: string;
  status: string;
  channelName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  booking: { publicId: string; status: string } | null;
}) {
  return {
    callId: call.publicId,
    status: call.status,
    channelName: call.channelName,
    startedAt: call.startedAt === null ? null : iso(call.startedAt),
    endedAt: call.endedAt === null ? null : iso(call.endedAt),
    booking:
      call.booking === null
        ? null
        : {
            bookingId: call.booking.publicId,
            status: call.booking.status
          }
  };
}

export function presentEndedCall(call: { publicId: string; status: string }, endedAt: Date) {
  return {
    callId: call.publicId,
    status: call.status,
    endedAt: iso(endedAt)
  };
}

export function customerMessageFor(reasonCodes: readonly RiskReasonCode[], gate: string): string {
  if (gate === PaymentGateStatus.Unlocked) {
    return "Booking terms are confirmed and the payment gate is open.";
  }
  if (reasonCodes.includes("REFUND_POLICY_NOT_CONFIRMED")) {
    return "Refund policy and deposit terms must be explicitly confirmed before payment.";
  }
  if (reasonCodes.includes("MISSING_PICKUP_POINT")) {
    return "Pickup point is still required before deposit.";
  }
  if (reasonCodes.includes("MISSING_CONTACT")) {
    return "A contact phone number is required before deposit.";
  }
  if (reasonCodes.includes("INVENTORY_UNAVAILABLE")) {
    return "Inventory must be held before payment.";
  }

  return "More booking details are required before payment.";
}

export function presentRisk(
  risk: {
    callSession: { publicId: string } | null;
    booking: { publicId: string } | null;
    publicId: string;
    completenessScore: number;
    disputeRiskScore: number;
    paymentReadinessScore: number;
    gateDecision: string;
    nextAction: string;
    reasonCodes: unknown;
    createdAt: Date;
  },
  callId: string
) {
  const reasonCodes = risk.reasonCodes as RiskReasonCode[];
  const missingFields = reasonCodes
    .filter((code) => code.startsWith("MISSING_") || code.endsWith("_NOT_CONFIRMED"))
    .map((code) => {
      if (code === "REFUND_POLICY_NOT_CONFIRMED") return "refundPolicyConfirmation";
      return code
        .replace("MISSING_", "")
        .toLowerCase()
        .replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    });

  return {
    callId: risk.callSession?.publicId ?? callId,
    bookingId: risk.booking?.publicId ?? null,
    assessmentId: risk.publicId,
    completenessScore: risk.completenessScore,
    disputeRisk: risk.disputeRiskScore,
    paymentReadiness: risk.paymentReadinessScore,
    paymentGate: risk.gateDecision,
    nextAction: risk.nextAction,
    missingFields,
    reasonCodes,
    customerMessage: customerMessageFor(reasonCodes, risk.gateDecision),
    assessedAt: iso(risk.createdAt)
  };
}
