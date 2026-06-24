import type {
  RevenueTwinDemandContext,
  RevenueTwinDepartureSnapshot,
  RevenueTwinIncentivePolicy,
  RevenueTwinOverflowOffer
} from "@call-to-cash/shared";

/**
 * Scenario-Robust Revenue Rebalancing Optimizer (SRRRO).
 *
 * This is deliberately a deterministic, explainable MVP optimizer.  It uses
 * scenario-safe constraints (capacity, group integrity, flexibility and
 * policy) before it considers revenue.  It is a proposal engine only: it
 * cannot reserve inventory or authoritatively change a fare.
 */
export const SCENARIO_ROBUST_REVENUE_REBALANCING_OPTIMIZER =
  "Scenario-Robust Revenue Rebalancing Optimizer" as const;

export interface RevenueTwinEvaluationInput {
  demand: RevenueTwinDemandContext;
  primaryDeparture: RevenueTwinDepartureSnapshot;
  alternativeDepartures: readonly RevenueTwinDepartureSnapshot[];
  incentivePolicy: RevenueTwinIncentivePolicy;
}

export type RevenueTwinEvaluationOptions = {
  evaluationId: string;
  offerIdForRank: (rank: number, departureId: string) => string;
  now: Date;
};

export type RevenueTwinIncentiveTerms = {
  discountAmountMinor: number;
  finalFareAmountMinor: number;
  reasonCodes: RevenueTwinOverflowOffer["reasonCodes"];
};

function minutesBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}

function withinFlexibility(timeShiftMinutes: number, demand: RevenueTwinDemandContext): boolean {
  if (demand.flexibility.timeConstraint === "FIXED") return timeShiftMinutes === 0;
  return (
    timeShiftMinutes >= -demand.flexibility.beforeMinutes &&
    timeShiftMinutes <= demand.flexibility.afterMinutes
  );
}

/** Server-owned bounded incentive formula. All currency is integer VND. */
export function calculateRevenueTwinIncentive(
  departure: RevenueTwinDepartureSnapshot,
  demand: RevenueTwinDemandContext,
  policy: RevenueTwinIncentivePolicy,
  timeShiftMinutes: number
): RevenueTwinIncentiveTerms | null {
  if (!policy.enabled || !policy.allowedOperatorRelations.includes(departure.operatorRelation)) {
    return null;
  }
  const fare = departure.fareAmountMinor;
  const percentageCap = Math.floor((fare * policy.maxDiscountBasisPoints) / 10_000);
  const policyCap = Math.min(policy.maxDiscountAmountMinor, percentageCap);
  // A later, less-filled alternative needs more persuasion; partner routing is
  // deliberately never made cheaper merely because it is a partner.
  const shiftTier = Math.min(policyCap, Math.max(0, Math.abs(timeShiftMinutes) * 250));
  const fillRateBasisPoints = Math.floor(
    ((departure.capacity - departure.availableSeats) * 10_000) / departure.capacity
  );
  const occupancyTier = fillRateBasisPoints <= 5_000 ? Math.floor(policyCap / 2) : 0;
  const operatorAdjustment =
    departure.operatorRelation === "VERIFIED_PARTNER" ? 0 : Math.floor(policyCap / 10);
  const proposed = shiftTier + occupancyTier + operatorAdjustment;
  const floorBoundDiscount = Math.max(0, fare - policy.minimumFinalFareAmountMinor);
  const discountAmountMinor = Math.min(proposed, policyCap, floorBoundDiscount);
  const finalFareAmountMinor = fare - discountAmountMinor;
  if (finalFareAmountMinor < policy.minimumFinalFareAmountMinor || finalFareAmountMinor < 0)
    return null;
  const reasonCodes: RevenueTwinOverflowOffer["reasonCodes"] = [
    "PRIMARY_DEPARTURE_FULL",
    "INCENTIVE_POLICY_APPLIED"
  ];
  if (timeShiftMinutes !== 0) reasonCodes.push("LOWER_TIME_DEVIATION");
  if (departure.availableSeats >= demand.passengerCount)
    reasonCodes.push("FLEET_CAPACITY_AVAILABLE");
  return { discountAmountMinor, finalFareAmountMinor, reasonCodes };
}

/** Pure priority allocation for simulation: FCFS only, never hold preemption. */
export function allocatePriorityFcfs<T extends { passengerCount: number }>(
  availableSeats: number,
  requests: readonly T[]
): { primary: readonly T[]; overflow: readonly T[]; remainingSeats: number } {
  let remainingSeats = Math.max(0, availableSeats);
  const primary: T[] = [];
  const overflow: T[] = [];
  for (const request of requests) {
    if (request.passengerCount <= remainingSeats) {
      primary.push(request);
      remainingSeats -= request.passengerCount;
    } else {
      overflow.push(request);
    }
  }
  return { primary, overflow, remainingSeats };
}

export type RevenueTwinSimulationMode = "DRY_RUN" | "DEMO_FIXTURE" | "ISOLATED_TEST_DATABASE";

export type RevenueTwinSimulationRequest = {
  requestId: string;
  passengerCount: number;
  requestedAt: string;
  timeConstraint: RevenueTwinDemandContext["flexibility"]["timeConstraint"];
  depositReadiness: RevenueTwinDemandContext["depositReadiness"];
};

/** The documented, provider-free judge fixture: 07:00 overflow → 07:30/08:00 routing. */
export function createRevenueTwinDemoFixture() {
  const requestedAt = "2030-06-20T06:45:00.000Z";
  return {
    primaryDeparture: { scheduledAt: "07:00", capacity: 20, availableSeats: 5 },
    alternativeDepartures: [
      { scheduledAt: "07:30", capacity: 20, availableSeats: 12 },
      { scheduledAt: "08:00", capacity: 20, availableSeats: 15 }
    ],
    requests: Array.from({ length: 10 }, (_, index) => ({
      requestId: `demo-request-${index + 1}`,
      passengerCount: 1,
      requestedAt: new Date(Date.parse(requestedAt) + index * 60_000).toISOString(),
      timeConstraint: "PREFERRED" as const,
      depositReadiness: "READY" as const
    }))
  };
}

/** Deterministic, provider-free Phase 11.7 simulation. */
export function runRevenueTwinSimulation(input: {
  mode: RevenueTwinSimulationMode;
  seed: number;
  primaryAvailableSeats: number;
  alternativeAvailableSeats: readonly number[];
  requests: readonly RevenueTwinSimulationRequest[];
}) {
  let primarySeats = Math.max(0, input.primaryAvailableSeats);
  const alternatives = input.alternativeAvailableSeats.map((value) => Math.max(0, value));
  let acceptedPassengers = 0;
  let overflowRequests = 0;
  const orderedRequests = input.requests
    .map((request, index) => ({ request, index }))
    .sort((left, right) => {
      const byTime = Date.parse(left.request.requestedAt) - Date.parse(right.request.requestedAt);
      return Number.isFinite(byTime) && byTime !== 0 ? byTime : left.index - right.index;
    });
  const decisions = orderedRequests.map(({ request }, index) => {
    if (request.passengerCount <= primarySeats) {
      primarySeats -= request.passengerCount;
      return { requestId: request.requestId, allocation: "PRIMARY" as const, accepted: true };
    }
    overflowRequests += 1;
    const destination = alternatives.findIndex((seats) => seats >= request.passengerCount);
    if (destination === -1)
      return { requestId: request.requestId, allocation: "REJECTED" as const, accepted: false };
    // Seeded transparent acceptance, not a prediction of ability or willingness to pay.
    const accepted = ((input.seed * 1_103_515_245 + index * 12_345) >>> 0) % 100 < 70;
    if (accepted) {
      alternatives[destination] = (alternatives[destination] ?? 0) - request.passengerCount;
      acceptedPassengers += request.passengerCount;
    }
    return {
      requestId: request.requestId,
      allocation: `OVERFLOW_${destination + 1}` as const,
      accepted
    };
  });
  return {
    mode: input.mode,
    seed: input.seed,
    decisions,
    metrics: {
      primaryAllocatedPassengerCount: input.primaryAvailableSeats - primarySeats,
      overflowRequestCount: overflowRequests,
      acceptedOverflowPassengerCount: acceptedPassengers,
      remainingAlternativeSeats: alternatives,
      requestCount: input.requests.length
    }
  };
}

export function evaluateRevenueTwin(
  input: RevenueTwinEvaluationInput,
  options: RevenueTwinEvaluationOptions
) {
  const { demand, primaryDeparture, alternativeDepartures, incentivePolicy } = input;
  const evaluatedAt = options.now.toISOString();
  const base = {
    schemaVersion: "ctc.revenue-twin.evaluation.v1" as const,
    evaluationId: options.evaluationId,
    callId: demand.callId,
    requestedDepartureId: demand.requestedDepartureId,
    policyVersion: incentivePolicy.policyVersion,
    evaluatedAt
  };
  const emptyImpact = {
    recoverablePassengerCount: 0,
    potentialGrossRevenueAmountMinor: 0,
    potentialDiscountCostAmountMinor: 0,
    potentialNetRevenueRecoveredAmountMinor: 0
  };
  const primaryCanServe = primaryDeparture.availableSeats >= demand.passengerCount;
  const proactiveRebalance =
    primaryCanServe &&
    incentivePolicy.proactiveRebalancingEnabled &&
    primaryDeparture.availableSeats <= incentivePolicy.scarcePrimaryAvailableSeats &&
    demand.flexibility.timeConstraint !== "FIXED";
  if (primaryCanServe && !proactiveRebalance) {
    return { ...base, status: "PRIMARY_AVAILABLE" as const, offers: [], impact: emptyImpact };
  }
  if (!incentivePolicy.enabled) {
    return { ...base, status: "POLICY_DISABLED" as const, offers: [], impact: emptyImpact };
  }

  let groupCapacitySeen = false;
  const candidates = alternativeDepartures
    .filter((departure) => departure.departureId !== demand.requestedDepartureId)
    .filter((departure) => departure.routeId === demand.routeId)
    .filter((departure) =>
      incentivePolicy.allowedOperatorRelations.includes(departure.operatorRelation)
    )
    .filter((departure) => {
      const fits = departure.availableSeats >= demand.passengerCount;
      groupCapacitySeen ||= fits;
      return (
        fits &&
        (!proactiveRebalance ||
          departure.availableSeats - demand.passengerCount >=
            incentivePolicy.minimumAlternativeSurplusSeats)
      );
    })
    .map((departure) => ({
      departure,
      timeShiftMinutes: minutesBetween(primaryDeparture.scheduledAt, departure.scheduledAt)
    }))
    .filter(
      ({ timeShiftMinutes }) =>
        Math.abs(timeShiftMinutes) <= incentivePolicy.maximumAlternativeShiftMinutes
    )
    .filter(({ timeShiftMinutes }) => withinFlexibility(timeShiftMinutes, demand))
    .map(({ departure, timeShiftMinutes }) => ({
      departure,
      timeShiftMinutes,
      incentive: calculateRevenueTwinIncentive(departure, demand, incentivePolicy, timeShiftMinutes)
    }))
    .filter(
      (
        candidate
      ): candidate is {
        departure: RevenueTwinDepartureSnapshot;
        timeShiftMinutes: number;
        incentive: RevenueTwinIncentiveTerms;
      } => candidate.incentive !== null
    )
    .sort((left, right) => {
      const relation =
        Number(left.departure.operatorRelation === "VERIFIED_PARTNER") -
        Number(right.departure.operatorRelation === "VERIFIED_PARTNER");
      if (relation !== 0) return relation;
      const shift = Math.abs(left.timeShiftMinutes) - Math.abs(right.timeShiftMinutes);
      if (shift !== 0) return shift;
      const discount = left.incentive.discountAmountMinor - right.incentive.discountAmountMinor;
      if (discount !== 0) return discount;
      const capacity =
        right.departure.availableSeats -
        demand.passengerCount -
        (left.departure.availableSeats - demand.passengerCount);
      if (capacity !== 0) return capacity;
      const revenue = right.incentive.finalFareAmountMinor - left.incentive.finalFareAmountMinor;
      if (revenue !== 0) return revenue;
      const schedule =
        Date.parse(left.departure.scheduledAt) - Date.parse(right.departure.scheduledAt);
      if (schedule !== 0) return schedule;
      return left.departure.departureId.localeCompare(right.departure.departureId);
    });
  const offers = candidates.slice(0, 3).map((candidate, index) => ({
    schemaVersion: "ctc.revenue-twin.offer.v1" as const,
    offerId: options.offerIdForRank(index + 1, candidate.departure.departureId),
    evaluationId: options.evaluationId,
    alternativeDepartureId: candidate.departure.departureId,
    operatorRelation: candidate.departure.operatorRelation,
    rank: index + 1,
    scheduledAt: candidate.departure.scheduledAt,
    timeShiftMinutes: candidate.timeShiftMinutes,
    passengerCount: demand.passengerCount,
    availableSeatsAtEvaluation: candidate.departure.availableSeats,
    inventoryVersionAtEvaluation: candidate.departure.inventoryVersion,
    originalFareAmountMinor: candidate.departure.fareAmountMinor,
    discountAmountMinor: candidate.incentive.discountAmountMinor,
    finalFareAmountMinor: candidate.incentive.finalFareAmountMinor,
    reasonCodes: [
      "SAME_ROUTE",
      "ALTERNATIVE_HAS_GROUP_CAPACITY",
      ...(proactiveRebalance
        ? (["PRIMARY_CAPACITY_SCARCE", "ALTERNATIVE_CAPACITY_SURPLUS"] as const)
        : []),
      ...candidate.incentive.reasonCodes
    ],
    expiresAt: new Date(
      options.now.getTime() + incentivePolicy.offerTtlSeconds * 1000
    ).toISOString()
  }));
  if (offers.length === 0) {
    if (proactiveRebalance) {
      return { ...base, status: "PRIMARY_AVAILABLE" as const, offers, impact: emptyImpact };
    }
    return {
      ...base,
      status: groupCapacitySeen
        ? ("NO_ELIGIBLE_ALTERNATIVE" as const)
        : ("GROUP_CAPACITY_UNAVAILABLE" as const),
      offers,
      impact: emptyImpact
    };
  }
  const best = offers[0];
  if (best === undefined) {
    return { ...base, status: "NO_ELIGIBLE_ALTERNATIVE" as const, offers, impact: emptyImpact };
  }
  return {
    ...base,
    status: proactiveRebalance
      ? ("PROACTIVE_OFFERS_AVAILABLE" as const)
      : ("OVERFLOW_OFFERS_AVAILABLE" as const),
    offers,
    impact: {
      recoverablePassengerCount: demand.passengerCount,
      potentialGrossRevenueAmountMinor: best.originalFareAmountMinor * demand.passengerCount,
      potentialDiscountCostAmountMinor: best.discountAmountMinor * demand.passengerCount,
      potentialNetRevenueRecoveredAmountMinor: best.finalFareAmountMinor * demand.passengerCount
    }
  };
}

export interface RevenueTwinOfferAcceptanceValidationInput {
  offer: RevenueTwinOverflowOffer;
  now: string | Date;
  currentInventoryVersion: number;
  policyVersion: string;
  evaluatedPolicyVersion: string;
}

export type RevenueTwinAcceptanceValidationResult =
  | { allowed: true }
  | { allowed: false; reason: "OFFER_EXPIRED" | "STALE_INVENTORY_SNAPSHOT" | "POLICY_CHANGED" };

/**
 * This guard classifies whether Phase 11.4 must re-evaluate before it may ask
 * the existing inventory authority to create a hold. It never reserves a seat.
 */
export function validateRevenueTwinOfferAcceptance(
  input: RevenueTwinOfferAcceptanceValidationInput
): RevenueTwinAcceptanceValidationResult {
  const now = typeof input.now === "string" ? Date.parse(input.now) : input.now.getTime();
  const expiresAt = Date.parse(input.offer.expiresAt);

  if (!Number.isFinite(now) || !Number.isFinite(expiresAt) || expiresAt <= now) {
    return { allowed: false, reason: "OFFER_EXPIRED" };
  }
  if (input.offer.inventoryVersionAtEvaluation !== input.currentInventoryVersion) {
    return { allowed: false, reason: "STALE_INVENTORY_SNAPSHOT" };
  }
  if (input.evaluatedPolicyVersion !== input.policyVersion) {
    return { allowed: false, reason: "POLICY_CHANGED" };
  }
  return { allowed: true };
}
