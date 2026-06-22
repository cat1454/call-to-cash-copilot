import { randomUUID } from "node:crypto";

import { Prisma } from "@call-to-cash/db";
import { CallStatus, EventName } from "@call-to-cash/shared";
import { transitionCall, type StateTransitionResult } from "@call-to-cash/domain";

import { bookingDraftWriter, recomputeBookingRiskAndEvents } from "../../booking/index.js";
import type { BookingDraftWriter } from "../../booking/index.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { appendEvent } from "../../../platform/events/event-log.js";
import { formatTranscriptForDisplay, redactContent } from "../call-session.presenter.js";
import { extractReplayFacts } from "../replay/replay-extractor.js";
import type { AppendTranscriptTurnInput, CallStatusValue, ServiceData } from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }
  return result.status;
}

/**
 * Normal browser/replay admission ends with the call. A signed provider history can arrive after
 * a normal end, so it is the one exception; it never reopens a terminal call.
 */
export function canPersistFinalTranscriptForCall(
  callStatus: string,
  trustedPostSessionIngress: boolean
): boolean {
  if (!["ENDED", "FAILED", "CANCELLED"].includes(callStatus)) return true;
  return callStatus === "ENDED" && trustedPostSessionIngress;
}

export function shouldExtractBookingFacts(speaker: string): boolean {
  return speaker === "CUSTOMER";
}

export async function appendTranscriptTurn(
  client: import("@call-to-cash/db").DatabaseClient,
  input: AppendTranscriptTurnInput,
  draftWriter: BookingDraftWriter = bookingDraftWriter
): Promise<ServiceData> {
  if (!input.turn.isFinal) {
    throw new ApiCommandError(422, "TRANSCRIPT_NOT_FINAL", "Only final transcript turns persist.");
  }

  const now = new Date();
  const persisted = await client.$transaction(
    async (transaction) => {
      const call = await transaction.callSession.findUnique({ where: { publicId: input.callId } });
      if (call === null) {
        throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
      }
      const replay =
        input.turn.provider !== undefined && input.turn.providerTurnId !== undefined
          ? await transaction.transcriptTurn.findUnique({
              where: {
                provider_providerTurnId: {
                  provider: input.turn.provider,
                  providerTurnId: input.turn.providerTurnId
                }
              }
            })
          : await transaction.transcriptTurn.findUnique({
              where: {
                callSessionId_providerEventId: {
                  callSessionId: call.id,
                  providerEventId: input.turn.clientTurnId
                }
              }
            });
      if (replay !== null) {
        return { call, turn: replay, duplicate: true };
      }
      if (
        !canPersistFinalTranscriptForCall(call.status, input.trustedPostSessionIngress === true)
      ) {
        throw new ApiCommandError(
          409,
          "CALL_NOT_ACTIVE",
          "Call is not accepting transcript turns."
        );
      }
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${call.publicId}))
      `);
      const extractsBookingFacts = shouldExtractBookingFacts(input.turn.speaker);
      const departures = extractsBookingFacts
        ? await transaction.tripDeparture.findMany({
            where: { operationalStatus: "SCHEDULED", departureAtUtc: { gt: now } },
            select: { routeFrom: true, routeTo: true, departureAtUtc: true }
          })
        : [];
      const facts = extractsBookingFacts
        ? extractReplayFacts(input.turn.content, { departures, now })
        : {};
      const sequenceNo =
        (await transaction.transcriptTurn.count({ where: { callSessionId: call.id } })) + 1;
      const turn = await transaction.transcriptTurn.create({
        data: {
          publicId: opaqueId("turn"),
          callSessionId: call.id,
          providerEventId: input.turn.clientTurnId,
          ...(input.turn.provider === undefined ? {} : { provider: input.turn.provider }),
          ...(input.turn.providerTurnId === undefined
            ? {}
            : { providerTurnId: input.turn.providerTurnId }),
          sequenceNo,
          speaker: input.turn.speaker,
          contentRedacted: redactContent(input.turn.content),
          language: input.turn.language,
          isFinal: true,
          ...(input.turn.sttConfidence === undefined
            ? {}
            : { sttConfidence: input.turn.sttConfidence }),
          startedAt: input.turn.startedAt === undefined ? null : new Date(input.turn.startedAt),
          endedAt: input.turn.endedAt === undefined ? null : new Date(input.turn.endedAt),
          source: input.turn.source,
          createdAt: now
        }
      });
      const activeCall =
        call.status === CallStatus.Created
          ? await transaction.callSession.update({
              where: { id: call.id },
              data: {
                status: requireTransition(
                  transitionCall(call.status as CallStatusValue, CallStatus.Active),
                  "Call cannot become active from its current state."
                ),
                startedAt: call.startedAt ?? now
              }
            })
          : call;
      if (!extractsBookingFacts) {
        const currentBooking = await transaction.booking.findUnique({
          where: { callSessionId: activeCall.id },
          select: { publicId: true }
        });
        await appendEvent(transaction, {
          callId: activeCall.publicId,
          bookingId: currentBooking?.publicId ?? null,
          event: EventName.TranscriptTurnCreated,
          data: {
            turnId: turn.publicId,
            sequenceNo: turn.sequenceNo,
            speaker: turn.speaker,
            content: formatTranscriptForDisplay(turn.contentRedacted),
            isFinal: true,
            timestamp: turn.createdAt.toISOString()
          },
          requestId: input.requestId,
          occurredAt: now
        });
        return { call: activeCall, turn, duplicate: false };
      }
      const booking = await draftWriter.upsertFromFacts(transaction, {
        callSessionId: activeCall.id,
        facts,
        requestId: input.requestId,
        now
      });
      await transaction.bookingExtraction.create({
        data: {
          publicId: opaqueId("ext"),
          callSessionId: activeCall.id,
          sourceTurnFrom: turn.sequenceNo,
          sourceTurnTo: turn.sequenceNo,
          extractionVersion: "deterministic-catalog-v2",
          payload: asJson({
            routeFrom: facts.routeFrom,
            routeTo: facts.routeTo,
            passengerCount: facts.passengerCount,
            pickupPoint: facts.pickupPoint,
            contactMasked: facts.contactPhoneMasked,
            departureLocalTime: facts.departureLocalTime,
            departureDay: facts.departureDay,
            departureMonth: facts.departureMonth
          }),
          fieldConfidence: asJson({ deterministic: 1 }),
          missingFields: asJson([]),
          contradictions: asJson([]),
          status: "ACCEPTED"
        }
      });
      await appendEvent(transaction, {
        callId: activeCall.publicId,
        bookingId: booking.publicId,
        event: EventName.TranscriptTurnCreated,
        data: {
          turnId: turn.publicId,
          sequenceNo: turn.sequenceNo,
          speaker: turn.speaker,
          content: formatTranscriptForDisplay(turn.contentRedacted),
          isFinal: true,
          timestamp: turn.createdAt.toISOString()
        },
        requestId: input.requestId,
        occurredAt: now
      });
      await recomputeBookingRiskAndEvents(transaction, activeCall.publicId, booking.publicId, {
        requestId: input.requestId,
        occurredAt: now,
        bookingCreated: booking.created,
        changedFields: booking.changedFields
      });
      return { call: activeCall, booking, turn, duplicate: false };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000
    }
  );

  return {
    turnId: persisted.turn.publicId,
    callId: input.callId,
    accepted: true as const,
    analysisQueued: false
  };
}
