import { PaymentGateStatus } from "@call-to-cash/shared";

function iso(value: Date): string {
  return value.toISOString();
}

export function presentBooking(booking: {
  publicId: string;
  status: string;
  routeFrom: string | null;
  routeTo: string | null;
  departureAtUtc: Date | null;
  passengerCount: number | null;
  pickupPointDisplay: string | null;
  contactPhoneMasked: string | null;
  totalAmountMinor: number | null;
  depositAmountMinor: number | null;
  refundPolicyVersion: string | null;
  agreements: Array<{ version: number }>;
  riskAssessments: Array<{ gateDecision: string }>;
}) {
  return {
    bookingId: booking.publicId,
    status: booking.status,
    routeFrom: booking.routeFrom,
    routeTo: booking.routeTo,
    departureAt: booking.departureAtUtc === null ? null : iso(booking.departureAtUtc),
    passengerCount: booking.passengerCount,
    pickupPoint: booking.pickupPointDisplay,
    contactPhoneMasked: booking.contactPhoneMasked,
    fareTotalVnd: booking.totalAmountMinor,
    depositAmountVnd: booking.depositAmountMinor,
    refundPolicyVersion: booking.refundPolicyVersion,
    agreementVersion: [
      "AGREEMENT_LOCKED",
      "PAYMENT_PENDING",
      "PAYMENT_CONFIRMED",
      "BOOKING_CONFIRMED",
      "RECEIPT_ISSUED"
    ].includes(booking.status)
      ? (booking.agreements[0]?.version ?? null)
      : (booking.agreements[0]?.version ?? 0) + 1,
    paymentGate: booking.riskAssessments[0]?.gateDecision ?? PaymentGateStatus.Locked
  };
}
