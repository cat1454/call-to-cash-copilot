import { randomUUID } from "node:crypto";

import {
  InventoryUnavailableError,
  Prisma,
  reserveInventory,
  type DatabaseClient
} from "@call-to-cash/db";
import {
  EventName,
  type AcceptRevenueTwinOfferCommand,
  RevenueTwinDashboardSchema,
  type RevenueTwinVoiceDirective
} from "@call-to-cash/shared";
import { evaluateRevenueTwin, validateRevenueTwinOfferAcceptance } from "@call-to-cash/domain";

import { appendEvent } from "../../platform/events/event-log.js";
import { ApiCommandError } from "../../platform/http/api-command-error.js";

const POLICY = {
  schemaVersion: "ctc.revenue-twin.incentive-policy.v1" as const,
  policyId: "revenue-twin-default",
  policyVersion: "SRRRO-V1",
  enabled: true,
  maxDiscountAmountMinor: 30_000,
  maxDiscountBasisPoints: 2_000,
  minimumFinalFareAmountMinor: 100_000,
  maximumAlternativeShiftMinutes: 120,
  offerTtlSeconds: 120,
  allowedOperatorRelations: ["OWN_FLEET"] as ("OWN_FLEET" | "VERIFIED_PARTNER")[],
  allowedReasonCodes: ["PRIMARY_DEPARTURE_FULL", "INCENTIVE_POLICY_APPLIED"] as (
    | "PRIMARY_DEPARTURE_FULL"
    | "INCENTIVE_POLICY_APPLIED"
  )[]
};

const opaque = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

type RevenueTwinHandlers = {
  evaluate(callId: string, requestId: string): Promise<Record<string, unknown>>;
  latest(callId: string): Promise<Record<string, unknown> | null>;
  accept(
    callId: string,
    offerId: string,
    command: AcceptRevenueTwinOfferCommand,
    requestId: string
  ): Promise<Record<string, unknown>>;
  decline(
    callId: string,
    offerId: string,
    evaluationId: string,
    requestId: string
  ): Promise<Record<string, unknown>>;
  dashboard(): Promise<Record<string, unknown>>;
};

function requireClient(client?: DatabaseClient): DatabaseClient {
  if (client === undefined)
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  return client;
}

async function snapshotDeparture(
  client: DatabaseClient | Prisma.TransactionClient,
  departure: {
    id: string;
    publicId: string;
    routeCode: string;
    departureAtUtc: Date;
    capacity: number;
    farePerSeatMinor: number;
    version: number;
  },
  now: Date
) {
  const occupied = await client.inventoryHold.aggregate({
    where: {
      departureId: departure.id,
      OR: [{ status: "CONSUMED" }, { status: "ACTIVE", expiresAt: { gt: now } }]
    },
    _sum: { quantity: true }
  });
  return {
    schemaVersion: "ctc.revenue-twin.departure-snapshot.v1" as const,
    departureId: departure.publicId,
    operatorId: "op_own_fleet",
    routeId: `route_${departure.routeCode}`,
    scheduledAt: departure.departureAtUtc.toISOString(),
    capacity: departure.capacity,
    availableSeats: Math.max(0, departure.capacity - (occupied._sum.quantity ?? 0)),
    fareAmountMinor: departure.farePerSeatMinor,
    currency: "VND" as const,
    pickupPointIds: ["pickup_catalogue_default"],
    operatorRelation: "OWN_FLEET" as const,
    inventoryVersion: departure.version,
    observedAt: now.toISOString()
  };
}

function directive(
  callId: string,
  evaluation: { publicId: string; createdAt: Date },
  offers: Array<{
    publicId: string;
    alternativeDeparture: { publicId: string };
    scheduledAt: Date;
    discountAmountMinor: number;
    finalFareAmountMinor: number;
    expiresAt: Date;
    status: string;
  }>,
  status: string
): RevenueTwinVoiceDirective {
  const accepted = offers.find((offer) => offer.status === "ACCEPTED");
  if (accepted !== undefined) {
    return {
      schemaVersion: "ctc.revenue-twin.voice-directive.v1",
      action: "CONFIRM_SELECTED_OFFER",
      callId,
      evaluationId: evaluation.publicId,
      offers: [
        {
          offerId: accepted.publicId,
          alternativeDepartureId: accepted.alternativeDeparture.publicId,
          scheduledAt: accepted.scheduledAt.toISOString(),
          discountAmountMinor: accepted.discountAmountMinor,
          finalFareAmountMinor: accepted.finalFareAmountMinor,
          expiresAt: accepted.expiresAt.toISOString()
        }
      ],
      expiresAt: accepted.expiresAt.toISOString(),
      message:
        "Dạ em đã ghi nhận chuyến thay thế anh/chị chọn. Em sẽ tiếp tục bước xác nhận điều khoản, chưa xác nhận thanh toán."
    };
  }
  if (offers.some((offer) => offer.status === "REQUIRES_REEVALUATION")) {
    return {
      schemaVersion: "ctc.revenue-twin.voice-directive.v1",
      action: "EXPLAIN_REEVALUATION",
      callId,
      evaluationId: evaluation.publicId,
      offers: [],
      expiresAt: new Date(evaluation.createdAt.getTime() + 120_000).toISOString(),
      message:
        "Dạ tình trạng chỗ vừa thay đổi. Em sẽ kiểm tra lại chuyến phù hợp trước khi mình xác nhận ạ."
    };
  }
  const safeOffers = offers.slice(0, 2).map((offer) => ({
    offerId: offer.publicId,
    alternativeDepartureId: offer.alternativeDeparture.publicId,
    scheduledAt: offer.scheduledAt.toISOString(),
    discountAmountMinor: offer.discountAmountMinor,
    finalFareAmountMinor: offer.finalFareAmountMinor,
    expiresAt: offer.expiresAt.toISOString()
  }));
  if (safeOffers.length === 0)
    return {
      schemaVersion: "ctc.revenue-twin.voice-directive.v1",
      action: status === "PRIMARY_AVAILABLE" ? "EXPLAIN_NO_ALTERNATIVE" : "ASK_TIME_FLEXIBILITY",
      callId,
      evaluationId: evaluation.publicId,
      offers: [],
      expiresAt: new Date(evaluation.createdAt.getTime() + 120_000).toISOString(),
      message:
        "Dạ chuyến đã chọn hiện chưa phù hợp. Anh/chị có thể cho em biết mình linh hoạt thời gian thêm bao lâu không ạ?"
    };
  const first = safeOffers[0]!;
  return {
    schemaVersion: "ctc.revenue-twin.voice-directive.v1",
    action: "PRESENT_OVERFLOW_OFFERS",
    callId,
    evaluationId: evaluation.publicId,
    offers: safeOffers,
    expiresAt: first.expiresAt,
    message: `Dạ chuyến đã chọn hiện đã hết chỗ. Em có chuyến thay thế cùng tuyến, còn chỗ, giảm ${first.discountAmountMinor.toLocaleString("vi-VN")} đồng, giá còn ${first.finalFareAmountMinor.toLocaleString("vi-VN")} đồng. Anh/chị có muốn chuyển chuyến không ạ?`
  };
}

export function createRevenueTwinHandlers(databaseClient?: DatabaseClient): RevenueTwinHandlers {
  return {
    async evaluate(callId: string, requestId: string) {
      const client = requireClient(databaseClient);
      const now = new Date();
      const call = await client.callSession.findUnique({
        where: { publicId: callId },
        include: { booking: { include: { tripDeparture: true } } }
      });
      if (call === null)
        throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
      const booking = call.booking;
      if (booking === null || booking.tripDeparture === null || booking.passengerCount === null)
        throw new ApiCommandError(
          422,
          "REVENUE_TWIN_NO_ELIGIBLE_ALTERNATIVE",
          "A selected departure and group size are required before overflow evaluation."
        );
      const primary = await snapshotDeparture(client, booking.tripDeparture, now);
      const departures = await client.tripDeparture.findMany({
        where: { routeCode: booking.tripDeparture.routeCode, operationalStatus: "SCHEDULED" }
      });
      const alternatives = await Promise.all(
        departures.map((departure) => snapshotDeparture(client, departure, now))
      );
      const evaluation = evaluateRevenueTwin(
        {
          demand: {
            schemaVersion: "ctc.revenue-twin.demand.v1",
            callId,
            bookingId: booking.publicId,
            routeId: primary.routeId,
            requestedDepartureId: primary.departureId,
            passengerCount: booking.passengerCount,
            flexibility: { beforeMinutes: 0, afterMinutes: 120, timeConstraint: "PREFERRED" },
            depositReadiness: "UNKNOWN",
            groupPolicy: "KEEP_TOGETHER",
            requestedAt: now.toISOString()
          },
          primaryDeparture: primary,
          alternativeDepartures: alternatives,
          incentivePolicy: POLICY
        },
        { evaluationId: opaque("rtw_eval"), offerIdForRank: () => opaque("rtw_offer"), now }
      );
      await client.$transaction(async (transaction) => {
        await transaction.revenueTwinEvaluation.create({
          data: {
            publicId: evaluation.evaluationId,
            callSessionId: call.id,
            bookingId: booking.id,
            requestedDepartureId: evaluation.requestedDepartureId,
            status: evaluation.status,
            policyVersion: evaluation.policyVersion,
            demandContext: evaluation as unknown as Prisma.InputJsonValue,
            impact: evaluation.impact as Prisma.InputJsonValue,
            offers: {
              create: evaluation.offers.map((offer) => ({
                publicId: offer.offerId,
                alternativeDepartureId: departures.find(
                  (departure) => departure.publicId === offer.alternativeDepartureId
                )!.id,
                rank: offer.rank,
                operatorRelation: offer.operatorRelation,
                scheduledAt: new Date(offer.scheduledAt),
                timeShiftMinutes: offer.timeShiftMinutes,
                passengerCount: offer.passengerCount,
                availableSeatsAtEval: offer.availableSeatsAtEvaluation,
                inventoryVersionAtEval: offer.inventoryVersionAtEvaluation,
                originalFareAmountMinor: offer.originalFareAmountMinor,
                discountAmountMinor: offer.discountAmountMinor,
                finalFareAmountMinor: offer.finalFareAmountMinor,
                reasonCodes: offer.reasonCodes as Prisma.InputJsonValue,
                expiresAt: new Date(offer.expiresAt)
              }))
            }
          }
        });
        await appendEvent(transaction, {
          callId,
          bookingId: booking.publicId,
          event: EventName.RevenueTwinEvaluated,
          data: {
            evaluationId: evaluation.evaluationId,
            status: evaluation.status,
            requestedDepartureId: evaluation.requestedDepartureId,
            offerCount: evaluation.offers.length,
            recoverablePassengerCount: evaluation.impact.recoverablePassengerCount,
            potentialNetRevenueRecoveredAmountMinor:
              evaluation.impact.potentialNetRevenueRecoveredAmountMinor,
            reasonCodes: evaluation.offers[0]?.reasonCodes ?? ["NO_VALID_ALTERNATIVE"],
            evaluatedAt: now.toISOString()
          },
          requestId,
          occurredAt: now
        });
      });
      return {
        evaluation,
        directive: {
          schemaVersion: "ctc.revenue-twin.voice-directive.v1" as const,
          action:
            evaluation.offers.length === 0
              ? ("EXPLAIN_NO_ALTERNATIVE" as const)
              : ("PRESENT_OVERFLOW_OFFERS" as const),
          callId,
          evaluationId: evaluation.evaluationId,
          offers: evaluation.offers.slice(0, 2).map((offer) => ({
            offerId: offer.offerId,
            alternativeDepartureId: offer.alternativeDepartureId,
            scheduledAt: offer.scheduledAt,
            discountAmountMinor: offer.discountAmountMinor,
            finalFareAmountMinor: offer.finalFareAmountMinor,
            expiresAt: offer.expiresAt
          })),
          expiresAt:
            evaluation.offers[0]?.expiresAt ?? new Date(now.getTime() + 120_000).toISOString(),
          message:
            evaluation.offers.length === 0
              ? "Dạ hiện chưa có chuyến thay thế phù hợp. Anh/chị có muốn linh hoạt thời gian không ạ?"
              : "Dạ chuyến đã chọn đã hết chỗ. Em có một chuyến thay thế cùng tuyến còn chỗ, anh/chị có muốn chuyển chuyến không ạ?"
        }
      };
    },

    async latest(callId: string) {
      const client = requireClient(databaseClient);
      const evaluation = await client.revenueTwinEvaluation.findFirst({
        where: { callSession: { publicId: callId } },
        include: { offers: { include: { alternativeDeparture: true }, orderBy: { rank: "asc" } } },
        orderBy: { createdAt: "desc" }
      });
      if (evaluation === null) return null;
      return {
        evaluationId: evaluation.publicId,
        status: evaluation.status,
        offers: evaluation.offers.map((offer) => ({
          offerId: offer.publicId,
          departureId: offer.alternativeDeparture.publicId,
          rank: offer.rank,
          finalFareAmountMinor: offer.finalFareAmountMinor,
          discountAmountMinor: offer.discountAmountMinor,
          status: offer.status,
          expiresAt: offer.expiresAt.toISOString()
        })),
        directive: directive(callId, evaluation, evaluation.offers, evaluation.status)
      };
    },

    async accept(
      callId: string,
      offerId: string,
      command: AcceptRevenueTwinOfferCommand,
      requestId: string
    ) {
      const client = requireClient(databaseClient);
      const now = new Date();
      try {
        return await client.$transaction(
          async (transaction) => {
            const offer = await transaction.revenueTwinOffer.findUnique({
              where: { publicId: offerId },
              include: {
                evaluation: { include: { callSession: true, booking: true } },
                alternativeDeparture: true,
                inventoryHold: true
              }
            });
            if (
              offer === null ||
              offer.evaluation.publicId !== command.evaluationId ||
              offer.evaluation.callSession.publicId !== callId
            )
              throw new ApiCommandError(
                404,
                "REVENUE_TWIN_OFFER_NOT_FOUND",
                "Offer is not available for this call."
              );
            if (
              offer.decisionIdempotencyKey === command.idempotencyKey &&
              offer.status === "ACCEPTED"
            )
              return {
                callId,
                evaluationId: command.evaluationId,
                offerId,
                status: "ACCEPTED" as const,
                selectedDepartureId: offer.alternativeDeparture.publicId,
                inventoryHoldId: offer.inventoryHold?.publicId,
                nextAction: "CONFIRM_AGREEMENT" as const
              };
            if (offer.decisionIdempotencyKey !== null)
              throw new ApiCommandError(
                409,
                "REVENUE_TWIN_IDEMPOTENCY_CONFLICT",
                "This idempotency key was already used for another offer decision."
              );
            const check = validateRevenueTwinOfferAcceptance({
              offer: {
                schemaVersion: "ctc.revenue-twin.offer.v1",
                offerId: offer.publicId,
                evaluationId: offer.evaluation.publicId,
                alternativeDepartureId: offer.alternativeDeparture.publicId,
                operatorRelation: offer.operatorRelation as "OWN_FLEET",
                rank: offer.rank,
                scheduledAt: offer.scheduledAt.toISOString(),
                timeShiftMinutes: offer.timeShiftMinutes,
                passengerCount: offer.passengerCount,
                availableSeatsAtEvaluation: offer.availableSeatsAtEval,
                inventoryVersionAtEvaluation: offer.inventoryVersionAtEval,
                originalFareAmountMinor: offer.originalFareAmountMinor,
                discountAmountMinor: offer.discountAmountMinor,
                finalFareAmountMinor: offer.finalFareAmountMinor,
                reasonCodes: offer.reasonCodes as never,
                expiresAt: offer.expiresAt.toISOString()
              },
              now,
              currentInventoryVersion: offer.alternativeDeparture.version,
              policyVersion: POLICY.policyVersion,
              evaluatedPolicyVersion: offer.evaluation.policyVersion
            });
            if (!check.allowed || offer.status !== "OPEN" || offer.evaluation.booking === null) {
              await transaction.revenueTwinOffer.update({
                where: { id: offer.id },
                data: {
                  status: "REQUIRES_REEVALUATION",
                  decidedAt: now,
                  decisionIdempotencyKey: command.idempotencyKey
                }
              });
              await appendEvent(transaction, {
                callId,
                bookingId: offer.evaluation.booking?.publicId ?? null,
                event: EventName.RevenueTwinReevaluationRequired,
                data: {
                  evaluationId: offer.evaluation.publicId,
                  offerId,
                  reasonCodes: [
                    check.allowed
                      ? "INVENTORY_CHANGED"
                      : check.reason === "OFFER_EXPIRED"
                        ? "OFFER_EXPIRED"
                        : "STALE_INVENTORY_SNAPSHOT"
                  ],
                  occurredAt: now.toISOString()
                },
                requestId,
                occurredAt: now
              });
              return {
                callId,
                evaluationId: command.evaluationId,
                offerId,
                status: "REQUIRES_REEVALUATION" as const,
                nextAction: "REEVALUATE_OVERFLOW" as const
              };
            }
            const hold = await reserveInventory(transaction, {
              publicId: opaque("hold"),
              idempotencyKey: `rtw-${command.idempotencyKey}`,
              bookingId: offer.evaluation.booking.id,
              departureId: offer.alternativeDeparture.id,
              quantity: offer.passengerCount,
              now,
              expiresAt: new Date(now.getTime() + 15 * 60_000),
              requestId
            });
            await transaction.booking.update({
              where: { id: offer.evaluation.booking.id },
              data: {
                departureAtUtc: offer.alternativeDeparture.departureAtUtc,
                totalAmountMinor: offer.finalFareAmountMinor * offer.passengerCount
              }
            });
            await transaction.revenueTwinOffer.update({
              where: { id: offer.id },
              data: {
                status: "ACCEPTED",
                decidedAt: now,
                decisionIdempotencyKey: command.idempotencyKey,
                inventoryHoldId: hold.id
              }
            });
            await transaction.revenueTwinOffer.updateMany({
              where: { evaluationId: offer.evaluationId, id: { not: offer.id }, status: "OPEN" },
              data: { status: "SUPERSEDED", decidedAt: now }
            });
            await appendEvent(transaction, {
              callId,
              bookingId: offer.evaluation.booking.publicId,
              event: EventName.RevenueTwinOfferAccepted,
              data: {
                evaluationId: offer.evaluation.publicId,
                offerId,
                selectedDepartureId: offer.alternativeDeparture.publicId,
                inventoryHoldId: hold.publicId,
                finalFareAmountMinor: offer.finalFareAmountMinor,
                discountAmountMinor: offer.discountAmountMinor,
                acceptedAt: now.toISOString()
              },
              requestId,
              occurredAt: now
            });
            return {
              callId,
              evaluationId: command.evaluationId,
              offerId,
              status: "ACCEPTED" as const,
              selectedDepartureId: offer.alternativeDeparture.publicId,
              inventoryHoldId: hold.publicId,
              nextAction: "CONFIRM_AGREEMENT" as const
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (error instanceof InventoryUnavailableError) {
          throw new ApiCommandError(
            409,
            "REVENUE_TWIN_REEVALUATION_REQUIRED",
            "Alternative inventory changed before the offer could be accepted.",
            undefined,
            true
          );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new ApiCommandError(
            409,
            "REVENUE_TWIN_REEVALUATION_REQUIRED",
            "Concurrent inventory changed before the offer could be accepted.",
            undefined,
            true
          );
        }
        throw error;
      }
    },

    async decline(callId: string, offerId: string, evaluationId: string, requestId: string) {
      const client = requireClient(databaseClient);
      const now = new Date();
      return client.$transaction(async (transaction) => {
        const offer = await transaction.revenueTwinOffer.findUnique({
          where: { publicId: offerId },
          include: { evaluation: { include: { callSession: true, booking: true } } }
        });
        if (
          offer === null ||
          offer.evaluation.publicId !== evaluationId ||
          offer.evaluation.callSession.publicId !== callId
        )
          throw new ApiCommandError(
            404,
            "REVENUE_TWIN_OFFER_NOT_FOUND",
            "Offer is not available for this call."
          );
        if (offer.status !== "OPEN")
          throw new ApiCommandError(
            409,
            "REVENUE_TWIN_OFFER_ALREADY_DECIDED",
            "Offer has already been decided."
          );
        await transaction.revenueTwinOffer.update({
          where: { id: offer.id },
          data: { status: "DECLINED", decidedAt: now }
        });
        await appendEvent(transaction, {
          callId,
          bookingId: offer.evaluation.booking?.publicId ?? null,
          event: EventName.RevenueTwinOfferDeclined,
          data: {
            evaluationId,
            offerId,
            reasonCodes: ["NO_VALID_ALTERNATIVE"],
            occurredAt: now.toISOString()
          },
          requestId,
          occurredAt: now
        });
        return { callId, evaluationId, offerId, status: "DECLINED" };
      });
    },

    async dashboard() {
      const client = requireClient(databaseClient);
      const [evaluations, offers] = await Promise.all([
        client.revenueTwinEvaluation.findMany({
          select: { publicId: true, createdAt: true, impact: true }
        }),
        client.revenueTwinOffer.findMany({
          include: {
            evaluation: {
              include: { booking: { include: { paymentIntents: { select: { status: true } } } } }
            },
            alternativeDeparture: { select: { publicId: true, capacity: true } }
          }
        })
      ]);
      const numberAt = (value: unknown, key: string) => {
        const candidate =
          typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : 0;
        return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0;
      };
      const accepted = offers.filter((offer) => offer.status === "ACCEPTED");
      const presented = offers.filter((offer) =>
        ["OPEN", "ACCEPTED", "DECLINED", "EXPIRED", "SUPERSEDED"].includes(offer.status)
      );
      const secured = accepted.filter((offer) =>
        offer.evaluation.booking?.paymentIntents.some((payment) => payment.status === "CONFIRMED")
      );
      const potentialGross = evaluations.reduce(
        (total, evaluation) =>
          total + numberAt(evaluation.impact, "potentialGrossRevenueAmountMinor"),
        0
      );
      const potentialDiscount = evaluations.reduce(
        (total, evaluation) =>
          total + numberAt(evaluation.impact, "potentialDiscountCostAmountMinor"),
        0
      );
      const potentialNet = evaluations.reduce(
        (total, evaluation) =>
          total + numberAt(evaluation.impact, "potentialNetRevenueRecoveredAmountMinor"),
        0
      );
      const recoverablePassengerCount = evaluations.reduce(
        (total, evaluation) => total + numberAt(evaluation.impact, "recoverablePassengerCount"),
        0
      );
      const acceptedPassengerCount = accepted.reduce(
        (total, offer) => total + offer.passengerCount,
        0
      );
      const securedRecoveredRevenueAmountMinor = secured.reduce(
        (total, offer) => total + offer.finalFareAmountMinor * offer.passengerCount,
        0
      );
      const discountCostForAcceptedOffers = accepted.reduce(
        (total, offer) => total + offer.discountAmountMinor * offer.passengerCount,
        0
      );
      const occupancyByDeparture = new Map<
        string,
        { capacity: number; before: number; accepted: number }
      >();
      for (const offer of accepted) {
        const key = offer.alternativeDeparture.publicId;
        const current = occupancyByDeparture.get(key) ?? {
          capacity: offer.alternativeDeparture.capacity,
          before: Math.max(0, offer.alternativeDeparture.capacity - offer.availableSeatsAtEval),
          accepted: 0
        };
        current.accepted += offer.passengerCount;
        occupancyByDeparture.set(key, current);
      }
      const occupancy = [...occupancyByDeparture.values()].reduce(
        (total, departure) => ({
          capacitySeats: total.capacitySeats + departure.capacity,
          beforeOccupiedSeats: total.beforeOccupiedSeats + departure.before,
          afterOccupiedSeats:
            total.afterOccupiedSeats +
            Math.min(departure.capacity, departure.before + departure.accepted)
        }),
        { capacitySeats: 0, beforeOccupiedSeats: 0, afterOccupiedSeats: 0 }
      );
      const timeline = [
        ...evaluations.map((evaluation) => ({
          kind: "EVALUATED" as const,
          evaluationId: evaluation.publicId,
          occurredAt: evaluation.createdAt.toISOString()
        })),
        ...offers.flatMap((offer) => {
          if (offer.decidedAt === null) return [];
          const kind =
            offer.status === "ACCEPTED"
              ? ("ACCEPTED" as const)
              : offer.status === "DECLINED"
                ? ("DECLINED" as const)
                : offer.status === "REQUIRES_REEVALUATION"
                  ? ("REEVALUATION_REQUIRED" as const)
                  : null;
          return kind === null
            ? []
            : [
                {
                  kind,
                  evaluationId: offer.evaluation.publicId,
                  offerId: offer.publicId,
                  occurredAt: offer.decidedAt.toISOString()
                }
              ];
        })
      ]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 50);
      const routing = offers
        .filter((offer) => ["OPEN", "ACCEPTED"].includes(offer.status))
        .sort((left, right) => {
          const created =
            right.evaluation.createdAt.getTime() - left.evaluation.createdAt.getTime();
          return created !== 0 ? created : left.rank - right.rank;
        })
        .slice(0, 3)
        .map((offer) => ({
          offerId: offer.publicId,
          alternativeDepartureId: offer.alternativeDeparture.publicId,
          rank: offer.rank,
          scheduledAt: offer.scheduledAt.toISOString(),
          availableSeatsAtEvaluation: offer.availableSeatsAtEval,
          discountAmountMinor: offer.discountAmountMinor,
          finalFareAmountMinor: offer.finalFareAmountMinor,
          status: offer.status
        }));
      return RevenueTwinDashboardSchema.parse({
        schemaVersion: "ctc.revenue-twin.dashboard.v1",
        metrics: {
          evaluations: evaluations.length,
          offersGenerated: offers.length,
          offersAccepted: accepted.length,
          offersDeclined: offers.filter((offer) => offer.status === "DECLINED").length,
          offersExpired: offers.filter((offer) => offer.status === "EXPIRED").length,
          reevaluations: offers.filter((offer) => offer.status === "REQUIRES_REEVALUATION").length,
          recoverablePassengerCount,
          acceptedPassengerCount,
          potentialGrossRevenueAmountMinor: potentialGross,
          potentialDiscountCostAmountMinor: potentialDiscount,
          potentialNetRevenueRecoveredAmountMinor: potentialNet,
          acceptedOfferRevenueAmountMinor: accepted.reduce(
            (total, offer) => total + offer.finalFareAmountMinor * offer.passengerCount,
            0
          ),
          securedRecoveredRevenueAmountMinor,
          offerAcceptanceRateBasisPoints:
            presented.length === 0 ? 0 : Math.floor((accepted.length * 10_000) / presented.length),
          discountEfficiencyBasisPoints:
            discountCostForAcceptedOffers === 0
              ? 0
              : Math.floor(
                  (securedRecoveredRevenueAmountMinor * 10_000) / discountCostForAcceptedOffers
                ),
          fleetFillRateImpactBasisPoints:
            occupancy.capacitySeats === 0
              ? 0
              : Math.floor(
                  ((occupancy.afterOccupiedSeats - occupancy.beforeOccupiedSeats) * 10_000) /
                    occupancy.capacitySeats
                ),
          lostDemandReductionBasisPoints:
            recoverablePassengerCount === 0
              ? 0
              : Math.min(
                  10_000,
                  Math.floor((acceptedPassengerCount * 10_000) / recoverablePassengerCount)
                )
        },
        occupancy,
        timeline,
        routing,
        generatedAt: new Date().toISOString()
      });
    }
  };
}
