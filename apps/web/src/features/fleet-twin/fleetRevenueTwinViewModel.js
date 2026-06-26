import {
  formatDepartureTime,
  formatVnd
} from "../simulation/hooks/bookingDisplayFormatters.js";

const DASH = "-";

function basisPointsToPercent(value) {
  return Number.isInteger(value) ? `${Math.round(value / 100)}%` : DASH;
}

function formatSeats(value) {
  return Number.isInteger(value) ? `${value} ghe` : DASH;
}

function optionStatus(status) {
  if (status === "ACCEPTED") return "DA CHOT";
  if (status === "OPEN") return "DE XUAT";
  if (status === "REQUIRES_REEVALUATION") return "CAN KIEM TRA";
  return status ?? DASH;
}

function offerTime(offer) {
  return offer?.scheduledAt ? formatDepartureTime(offer.scheduledAt) : offer?.departureId ?? DASH;
}

function matchRouting(dashboard, offerId) {
  return dashboard?.routing?.find((item) => item.offerId === offerId) ?? null;
}

export function buildFleetRevenueTwinViewModel({
  booking = null,
  transcript = [],
  scores = {},
  paymentGate = "LOCKED",
  evaluation = null,
  dashboard = null,
  mockRevenueTwinOverride = null,
  decision = null,
  streamStatus = "idle",
  simStatus = "San sang"
} = {}) {
  // ---- Mock Revenue Twin override (Scenario 5 phase 0–11) ---------------
  // When the mock simulation provides revenueTwin data, synthesize
  // a live-compatible evaluation + dashboard shape so the UI panels
  // render meaningful optimization data without a real API connection.
  if (mockRevenueTwinOverride && !evaluation) {
    const mock = mockRevenueTwinOverride;
    const trips = mock.overlappingTrips ?? [];
    const winner = trips.find((t) => t.id === mock.recommendedTripId) ?? null;
    const isAccepted = mock.status === "ACCEPTED";


    // Build synthetic offers list (one per overlapping trip)
    const syntheticOffers = trips.map((trip, idx) => ({
      offerId: trip.id,
      departureId: trip.id,
      scheduledAt: `2026-06-28T${trip.time}:00+07:00`,
      rank: idx + 1,
      status: trip.id === mock.recommendedTripId
        ? (isAccepted ? "ACCEPTED" : "OPEN")
        : "OPEN",
      discountAmountMinor: trip.id === mock.recommendedTripId ? 30_000 : 0,
      finalFareAmountMinor: trip.id === mock.recommendedTripId
        ? (mock.securedRevenue ?? 1_170_000) / 3
        : Math.round((350_000 * (100 - trip.fillRate)) / 100),
      inventoryHoldId: isAccepted && trip.id === mock.recommendedTripId
        ? `hold-${trip.id}` : null
    }));

    // Build synthetic routing list
    const syntheticRouting = trips.map((trip, idx) => ({
      offerId: trip.id,
      rank: idx + 1,
      scheduledAt: `2026-06-28T${trip.time}:00+07:00`,
      availableSeatsAtEvaluation: trip.seats,
      discountAmountMinor: trip.id === mock.recommendedTripId ? 30_000 : 0
    }));

    // Build synthetic metrics
    const syntheticMetrics = {
      recoverablePassengerCount: trips.reduce((s, t) => s + t.seats, 0),
      acceptedPassengerCount: isAccepted ? 3 : 0,
      offersGenerated: trips.length,
      offerAcceptanceRateBasisPoints: isAccepted ? 7500 : 0,
      potentialGrossRevenueAmountMinor: mock.savedRevenue ?? 1_260_000,
      potentialDiscountCostAmountMinor: mock.discountCost ?? 90_000,
      securedRecoveredRevenueAmountMinor: isAccepted ? (mock.securedRevenue ?? 1_170_000) : 0,
      potentialNetRevenueRecoveredAmountMinor: mock.securedRevenue ?? 1_170_000
    };

    const syntheticOccupancy = winner
      ? {
          capacitySeats: winner.seats + 10,
          beforeOccupiedSeats: Math.round(winner.seats * (winner.fillRate / 100)),
          afterOccupiedSeats: Math.round(winner.seats * (winner.fillRate / 100)) + (isAccepted ? 3 : 0)
        }
      : null;

    evaluation = {
      evaluationId: `mock-eval-${mock.phase}`,
      status: mock.status ?? "EVALUATING",
      offers: syntheticOffers
    };
    dashboard = {
      metrics: syntheticMetrics,
      occupancy: syntheticOccupancy,
      routing: syntheticRouting
    };
  }
  // -----------------------------------------------------------------------


  const offers = evaluation?.offers ?? [];
  const recommendation =
    offers.find((offer) => offer.status === "OPEN") ??
    offers.find((offer) => offer.status === "ACCEPTED") ??
    offers[0] ??
    null;
  const routing = recommendation ? matchRouting(dashboard, recommendation.offerId) : null;
  const metrics = dashboard?.metrics;
  const occupancy = dashboard?.occupancy;
  const transcriptTurns = transcript.slice(-3);
  const acceptedOffer = offers.find((offer) => offer.status === "ACCEPTED") ?? null;
  const holdId = decision?.inventoryHoldId ?? acceptedOffer?.inventoryHoldId ?? null;

  return {
    connection: {
      connected: streamStatus === "open",
      statusText: streamStatus === "open" ? "Đã kết nối" : simStatus
    },
    transcriptTurns,
    booking: {
      route: [booking?.routeFrom, booking?.routeTo].filter(Boolean).join(" -> ") || DASH,
      requestedTime: formatDepartureTime(booking?.departureAt) || DASH,
      passengerCount: booking?.passengerCount ? String(booking.passengerCount) : DASH,
      pickupPoint: booking?.pickupPoint || DASH,
      contactPhoneMasked: booking?.contactPhoneMasked || DASH,
      paymentGate
    },
    risk: {
      status: paymentGate === "UNLOCKED" ? "An toan" : "Dang khoa",
      completeness: scores.completeness ?? 0,
      dispute: scores.dispute ?? 0,
      readiness: scores.readiness ?? 0
    },
    decision: {
      status: evaluation?.status ?? "NO_EVALUATION",
      badge: evaluation ? "Live Decisioning" : "Cho danh gia",
      evaluationId: evaluation?.evaluationId ?? null,
      offerId: recommendation?.offerId ?? null,
      recommendation: recommendation
        ? `De xuat: ${offerTime(routing ?? recommendation)}`
        : "Chua co de xuat",
      chips: [
        formatSeats(routing?.availableSeatsAtEvaluation),
        recommendation ? `Giam ${formatVnd(recommendation.discountAmountMinor) || DASH}` : DASH,
        recommendation ? `Gia ${formatVnd(recommendation.finalFareAmountMinor) || DASH}` : DASH
      ],
      reasons: [
        evaluation ? `Trang thai: ${evaluation.status}` : "Chua co danh gia Revenue Twin",
        recommendation
          ? `Offer ${recommendation.offerId} do backend xep hang #${recommendation.rank}`
          : "Backend chua tra ve offer",
        routing
          ? `${formatSeats(routing.availableSeatsAtEvaluation)} tai thoi diem danh gia`
          : "Khong dung du lieu suc chua tu trinh duyet",
        "Chap nhan se tai kiem tra ton kho tren server"
      ],
      options: offers.map((offer) => {
        const route = matchRouting(dashboard, offer.offerId);
        return {
          key: offer.offerId,
          time: offerTime(route ?? offer),
          seats: formatSeats(route?.availableSeatsAtEvaluation),
          status: optionStatus(offer.status),
          recommended: offer.offerId === recommendation?.offerId
        };
      }),
      confirmations: [
        { label: "Offer persisted", done: Boolean(evaluation?.evaluationId) },
        { label: "Inventory revalidated", done: decision?.status === "ACCEPTED" || Boolean(holdId) },
        { label: "Hold created", done: Boolean(holdId) },
        { label: "Booking saved", done: Boolean(booking?.bookingId) }
      ],
      canAccept: Boolean(recommendation?.offerId && evaluation?.evaluationId && recommendation.status === "OPEN"),
      canDecline: Boolean(recommendation?.offerId && evaluation?.evaluationId && recommendation.status === "OPEN")
    },
    kpis: [
      ["Revenue recovered", formatVnd(metrics?.securedRecoveredRevenueAmountMinor) || DASH, "secured", "green"],
      ["Potential recovery", formatVnd(metrics?.potentialNetRevenueRecoveredAmountMinor) || DASH, "not secured", "blue"],
      ["Bookings saved", metrics?.acceptedPassengerCount?.toString() ?? DASH, "accepted pax", "green"],
      [
        "Fleet fill rate",
        occupancy?.capacitySeats ? `${Math.round((occupancy.afterOccupiedSeats * 100) / occupancy.capacitySeats)}%` : DASH,
        "after holds",
        "blue"
      ],
      ["Dispute Risk", `${scores.dispute ?? 0}/100`, "server risk", "rose"],
      ["Payment Readiness", `${scores.readiness ?? 0}/100`, "server score", "green"],
      ["Offer acceptance", basisPointsToPercent(metrics?.offerAcceptanceRateBasisPoints), "projection", "amber"]
    ],
    audit: {
      line: decision?.status === "ACCEPTED"
        ? "Server accepted offer, revalidated inventory, and returned hold proof."
        : "Waiting for committed Revenue Twin events and REST recovery."
    }
  };
}
