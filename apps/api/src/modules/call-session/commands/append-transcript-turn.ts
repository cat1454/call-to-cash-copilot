import { randomUUID } from "node:crypto";

import { Prisma } from "@call-to-cash/db";
import { CallStatus } from "@call-to-cash/shared";
import { transitionCall, type StateTransitionResult } from "@call-to-cash/domain";

import {
  bookingDraftWriter,
  recomputeBookingRiskAndEvents
} from "../../booking/index.js";
import type { BookingDraftWriter } from "../../booking/index.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { redactContent } from "../call-session.presenter.js";
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

export async function appendTranscriptTurn(
  client: import("@call-to-cash/db").DatabaseClient,
  input: AppendTranscriptTurnInput,
  draftWriter: BookingDraftWriter = bookingDraftWriter
): Promise<ServiceData> {
  if (!input.turn.isFinal) {
    throw new ApiCommandError(422, "TRANSCRIPT_NOT_FINAL", "Only final transcript turns persist.");
  }

  const now = new Date();
  const facts = extractReplayFacts(input.turn.content);
  const persisted = await client.$transaction(
    async (transaction) => {
      const call = await transaction.callSession.findUnique({ where: { publicId: input.callId } });
      if (call === null) {
        throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
      }
      if (["ENDED", "FAILED", "CANCELLED"].includes(call.status)) {
        throw new ApiCommandError(
          409,
          "CALL_NOT_ACTIVE",
          "Call is not accepting transcript turns."
        );
      }
      const replay = await transaction.transcriptTurn.findUnique({
        where: {
          callSessionId_providerEventId: {
            callSessionId: call.id,
            providerEventId: input.turn.clientTurnId
          }
        }
      });
      if (replay !== null) {
        const booking = await transaction.booking.findUnique({ where: { callSessionId: call.id } });
        if (booking === null) {
          throw new ApiCommandError(
            409,
            "BOOKING_NOT_FOUND",
            "Duplicate transcript turn has no linked booking."
          );
        }
        return { call, booking, turn: replay, duplicate: true };
      }
      const turn = await transaction.transcriptTurn.create({
        data: {
          publicId: opaqueId("turn"),
          callSessionId: call.id,
          providerEventId: input.turn.clientTurnId,
          sequenceNo: input.turn.sequenceNo,
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
          sourceTurnFrom: input.turn.sequenceNo,
          sourceTurnTo: input.turn.sequenceNo,
          extractionVersion: "deterministic-replay-v1",
          payload: asJson({
            routeFrom: facts.routeFrom,
            routeTo: facts.routeTo,
            passengerCount: facts.passengerCount,
            pickupPoint: facts.pickupPoint,
            contactMasked: facts.contactPhoneMasked
          }),
          fieldConfidence: asJson({ deterministic: 1 }),
          missingFields: asJson([]),
          contradictions: asJson([]),
          status: "ACCEPTED"
        }
      });
      await recomputeBookingRiskAndEvents(transaction, activeCall.publicId, booking.publicId, {
        requestId: input.requestId,
        occurredAt: now,
        transcriptTurn: turn,
        emitTranscript: true
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
