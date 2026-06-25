import { z } from "zod";

import {
  CallIdSchema,
  InventoryReservationIdSchema,
  IsoTimestampSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  BookingIdSchema,
  TranscriptTurnIdSchema,
  DepartureIdSchema,
  OperatorIdSchema,
  RouteIdSchema,
  PickupPointIdSchema,
  RevenueTwinEvaluationIdSchema,
  RevenueTwinOfferIdSchema,
  RevenueTwinWaitlistIdSchema,
  IdempotencyKeySchema
} from "./primitives.js";

export const REVENUE_TWIN_REASON_CODE_VALUES = [
  "PRIMARY_DEPARTURE_FULL",
  "PRIMARY_CAPACITY_SCARCE",
  "ALTERNATIVE_CAPACITY_SURPLUS",
  "PRIMARY_CAPACITY_INSUFFICIENT",
  "ALTERNATIVE_WITHIN_FLEXIBILITY",
  "ALTERNATIVE_HAS_GROUP_CAPACITY",
  "SAME_ROUTE",
  "SAME_OPERATOR",
  "VERIFIED_PARTNER",
  "PICKUP_COMPATIBLE",
  "LOWER_TIME_DEVIATION",
  "LOWER_INCENTIVE_COST",
  "FLEET_CAPACITY_AVAILABLE",
  "INCENTIVE_POLICY_APPLIED",
  "NO_VALID_ALTERNATIVE",
  "GROUP_MUST_STAY_TOGETHER",
  "POLICY_DISABLED",
  "OFFER_EXPIRED",
  "INVENTORY_CHANGED",
  "STALE_INVENTORY_SNAPSHOT"
] as const;

export const RevenueTwinReasonCodeSchema = z.enum(REVENUE_TWIN_REASON_CODE_VALUES);
export const RevenueTwinOperatorRelationSchema = z.enum(["OWN_FLEET", "VERIFIED_PARTNER"]);
export const RevenueTwinTimeConstraintSchema = z.enum(["FIXED", "PREFERRED", "FLEXIBLE"]);
export const RevenueTwinDepositReadinessSchema = z.enum(["UNKNOWN", "READY", "NOT_READY"]);

const flexibilitySchema = z
  .object({
    beforeMinutes: NonNegativeIntegerSchema.max(1440),
    afterMinutes: NonNegativeIntegerSchema.max(1440),
    timeConstraint: RevenueTwinTimeConstraintSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.timeConstraint === "FIXED" &&
      (value.beforeMinutes !== 0 || value.afterMinutes !== 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FIXED time requires zero flexibility."
      });
    }
  });

export const RevenueTwinDemandContextSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.demand.v1"),
    callId: CallIdSchema,
    bookingId: BookingIdSchema.optional(),
    sourceTurnId: TranscriptTurnIdSchema.optional(),
    routeId: RouteIdSchema,
    requestedDepartureId: DepartureIdSchema,
    passengerCount: PositiveIntegerSchema.max(100),
    flexibility: flexibilitySchema,
    depositReadiness: RevenueTwinDepositReadinessSchema,
    groupPolicy: z.literal("KEEP_TOGETHER"),
    requestedAt: IsoTimestampSchema
  })
  .strict();

export const RevenueTwinDepartureSnapshotSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.departure-snapshot.v1"),
    departureId: DepartureIdSchema,
    operatorId: OperatorIdSchema,
    routeId: RouteIdSchema,
    scheduledAt: IsoTimestampSchema,
    capacity: PositiveIntegerSchema,
    availableSeats: NonNegativeIntegerSchema,
    fareAmountMinor: NonNegativeIntegerSchema,
    currency: z.literal("VND"),
    pickupPointIds: z.array(PickupPointIdSchema).min(1),
    operatorRelation: RevenueTwinOperatorRelationSchema,
    inventoryVersion: NonNegativeIntegerSchema,
    observedAt: IsoTimestampSchema
  })
  .strict()
  .refine((value) => value.availableSeats <= value.capacity, {
    message: "Available seats cannot exceed capacity.",
    path: ["availableSeats"]
  });

export const RevenueTwinIncentivePolicySchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.incentive-policy.v1"),
    policyId: z.string().min(1).max(128),
    policyVersion: z.string().min(1).max(128),
    enabled: z.boolean(),
    maxDiscountAmountMinor: NonNegativeIntegerSchema,
    maxDiscountBasisPoints: NonNegativeIntegerSchema.max(10_000),
    minimumFinalFareAmountMinor: NonNegativeIntegerSchema,
    maximumAlternativeShiftMinutes: NonNegativeIntegerSchema.max(1440),
    proactiveRebalancingEnabled: z.boolean(),
    scarcePrimaryAvailableSeats: NonNegativeIntegerSchema.max(100),
    minimumAlternativeSurplusSeats: NonNegativeIntegerSchema.max(10_000),
    offerTtlSeconds: PositiveIntegerSchema.max(86_400),
    allowedOperatorRelations: z.array(RevenueTwinOperatorRelationSchema).min(1),
    allowedReasonCodes: z.array(RevenueTwinReasonCodeSchema).min(1)
  })
  .strict();

export const RevenueTwinOverflowOfferSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.offer.v1"),
    offerId: RevenueTwinOfferIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    alternativeDepartureId: DepartureIdSchema,
    operatorRelation: RevenueTwinOperatorRelationSchema,
    rank: PositiveIntegerSchema,
    scheduledAt: IsoTimestampSchema,
    timeShiftMinutes: z.number().int().min(-1440).max(1440),
    passengerCount: PositiveIntegerSchema.max(100),
    availableSeatsAtEvaluation: NonNegativeIntegerSchema,
    inventoryVersionAtEvaluation: NonNegativeIntegerSchema,
    originalFareAmountMinor: NonNegativeIntegerSchema,
    discountAmountMinor: NonNegativeIntegerSchema,
    finalFareAmountMinor: NonNegativeIntegerSchema,
    reasonCodes: z.array(RevenueTwinReasonCodeSchema).min(1),
    expiresAt: IsoTimestampSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.discountAmountMinor > value.originalFareAmountMinor) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountAmountMinor"],
        message: "Discount cannot exceed fare."
      });
    }
    if (value.finalFareAmountMinor !== value.originalFareAmountMinor - value.discountAmountMinor) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finalFareAmountMinor"],
        message: "Final fare must equal fare minus discount."
      });
    }
  });

export const RevenueTwinEvaluationStatusSchema = z.enum([
  "PRIMARY_AVAILABLE",
  "PROACTIVE_OFFERS_AVAILABLE",
  "OVERFLOW_OFFERS_AVAILABLE",
  "NO_ELIGIBLE_ALTERNATIVE",
  "GROUP_CAPACITY_UNAVAILABLE",
  "WAITLIST_RECOMMENDED",
  "POLICY_DISABLED"
]);

export const RevenueTwinEvaluationResultSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.evaluation.v1"),
    evaluationId: RevenueTwinEvaluationIdSchema,
    callId: CallIdSchema,
    status: RevenueTwinEvaluationStatusSchema,
    requestedDepartureId: DepartureIdSchema,
    offers: z.array(RevenueTwinOverflowOfferSchema).max(3),
    impact: z
      .object({
        recoverablePassengerCount: NonNegativeIntegerSchema,
        potentialGrossRevenueAmountMinor: NonNegativeIntegerSchema,
        potentialDiscountCostAmountMinor: NonNegativeIntegerSchema,
        potentialNetRevenueRecoveredAmountMinor: NonNegativeIntegerSchema
      })
      .strict(),
    policyVersion: z.string().min(1).max(128),
    evaluatedAt: IsoTimestampSchema
  })
  .strict();

export const AcceptRevenueTwinOfferCommandSchema = z
  .object({
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    offerId: RevenueTwinOfferIdSchema,
    idempotencyKey: IdempotencyKeySchema
  })
  .strict();

export const DeclineRevenueTwinOfferCommandSchema = z
  .object({
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    offerId: RevenueTwinOfferIdSchema
  })
  .strict();

export const AcceptRevenueTwinOfferResultSchema = z
  .object({
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    offerId: RevenueTwinOfferIdSchema,
    status: z.enum(["ACCEPTED", "REQUIRES_REEVALUATION"]),
    selectedDepartureId: DepartureIdSchema.optional(),
    inventoryHoldId: InventoryReservationIdSchema.optional(),
    nextAction: z.enum(["CONFIRM_AGREEMENT", "CREATE_DEPOSIT_REQUEST", "REEVALUATE_OVERFLOW"])
  })
  .strict();

export const RevenueTwinVoiceDirectiveSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.voice-directive.v1"),
    action: z.enum([
      "PRESENT_OVERFLOW_OFFERS",
      "ASK_TIME_FLEXIBILITY",
      "CONFIRM_SELECTED_OFFER",
      "EXPLAIN_REEVALUATION",
      "EXPLAIN_NO_ALTERNATIVE",
      "ASK_WAITLIST_CONSENT"
    ]),
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema.optional(),
    offers: z
      .array(
        z
          .object({
            offerId: RevenueTwinOfferIdSchema,
            alternativeDepartureId: DepartureIdSchema,
            scheduledAt: IsoTimestampSchema,
            discountAmountMinor: NonNegativeIntegerSchema,
            finalFareAmountMinor: NonNegativeIntegerSchema,
            expiresAt: IsoTimestampSchema
          })
          .strict()
      )
      .max(2),
    expiresAt: IsoTimestampSchema,
    message: z.string().min(1).max(600)
  })
  .strict();

export const JoinRevenueTwinWaitlistCommandSchema = z
  .object({
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    idempotencyKey: IdempotencyKeySchema
  })
  .strict();

export const RevenueTwinWaitlistEntrySchema = z
  .object({
    waitlistId: RevenueTwinWaitlistIdSchema,
    callId: CallIdSchema,
    evaluationId: RevenueTwinEvaluationIdSchema,
    requestedDepartureId: DepartureIdSchema,
    passengerCount: PositiveIntegerSchema.max(100),
    status: z.literal("PENDING"),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const RevenueTwinDashboardSchema = z
  .object({
    schemaVersion: z.literal("ctc.revenue-twin.dashboard.v1"),
    metrics: z
      .object({
        evaluations: NonNegativeIntegerSchema,
        offersGenerated: NonNegativeIntegerSchema,
        offersAccepted: NonNegativeIntegerSchema,
        offersDeclined: NonNegativeIntegerSchema,
        offersExpired: NonNegativeIntegerSchema,
        reevaluations: NonNegativeIntegerSchema,
        recoverablePassengerCount: NonNegativeIntegerSchema,
        acceptedPassengerCount: NonNegativeIntegerSchema,
        potentialGrossRevenueAmountMinor: NonNegativeIntegerSchema,
        potentialDiscountCostAmountMinor: NonNegativeIntegerSchema,
        potentialNetRevenueRecoveredAmountMinor: NonNegativeIntegerSchema,
        acceptedOfferRevenueAmountMinor: NonNegativeIntegerSchema,
        securedRecoveredRevenueAmountMinor: NonNegativeIntegerSchema,
        offerAcceptanceRateBasisPoints: NonNegativeIntegerSchema.max(10_000),
        discountEfficiencyBasisPoints: NonNegativeIntegerSchema,
        fleetFillRateImpactBasisPoints: z.number().int(),
        lostDemandReductionBasisPoints: NonNegativeIntegerSchema.max(10_000)
      })
      .strict(),
    occupancy: z
      .object({
        beforeOccupiedSeats: NonNegativeIntegerSchema,
        afterOccupiedSeats: NonNegativeIntegerSchema,
        capacitySeats: NonNegativeIntegerSchema
      })
      .strict()
      .superRefine((value, context) => {
        if (
          value.beforeOccupiedSeats > value.capacitySeats ||
          value.afterOccupiedSeats > value.capacitySeats
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Occupancy cannot exceed capacity."
          });
        }
      }),
    timeline: z
      .array(
        z
          .object({
            kind: z.enum(["EVALUATED", "ACCEPTED", "DECLINED", "REEVALUATION_REQUIRED"]),
            evaluationId: RevenueTwinEvaluationIdSchema,
            offerId: RevenueTwinOfferIdSchema.optional(),
            occurredAt: IsoTimestampSchema
          })
          .strict()
      )
      .max(50),
    routing: z
      .array(
        z
          .object({
            offerId: RevenueTwinOfferIdSchema,
            alternativeDepartureId: DepartureIdSchema,
            rank: PositiveIntegerSchema,
            scheduledAt: IsoTimestampSchema,
            availableSeatsAtEvaluation: NonNegativeIntegerSchema,
            discountAmountMinor: NonNegativeIntegerSchema,
            finalFareAmountMinor: NonNegativeIntegerSchema,
            status: z.enum([
              "OPEN",
              "ACCEPTED",
              "DECLINED",
              "EXPIRED",
              "SUPERSEDED",
              "REQUIRES_REEVALUATION"
            ])
          })
          .strict()
      )
      .max(3),
    generatedAt: IsoTimestampSchema
  })
  .strict();

export type RevenueTwinDemandContext = z.infer<typeof RevenueTwinDemandContextSchema>;
export type RevenueTwinDepartureSnapshot = z.infer<typeof RevenueTwinDepartureSnapshotSchema>;
export type RevenueTwinIncentivePolicy = z.infer<typeof RevenueTwinIncentivePolicySchema>;
export type RevenueTwinOverflowOffer = z.infer<typeof RevenueTwinOverflowOfferSchema>;
export type RevenueTwinEvaluationResult = z.infer<typeof RevenueTwinEvaluationResultSchema>;
export type AcceptRevenueTwinOfferCommand = z.infer<typeof AcceptRevenueTwinOfferCommandSchema>;
export type DeclineRevenueTwinOfferCommand = z.infer<typeof DeclineRevenueTwinOfferCommandSchema>;
export type AcceptRevenueTwinOfferResult = z.infer<typeof AcceptRevenueTwinOfferResultSchema>;
export type RevenueTwinVoiceDirective = z.infer<typeof RevenueTwinVoiceDirectiveSchema>;
export type JoinRevenueTwinWaitlistCommand = z.infer<typeof JoinRevenueTwinWaitlistCommandSchema>;
export type RevenueTwinWaitlistEntry = z.infer<typeof RevenueTwinWaitlistEntrySchema>;
export type RevenueTwinDashboard = z.infer<typeof RevenueTwinDashboardSchema>;
