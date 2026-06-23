import { randomUUID } from "node:crypto";

import { Prisma } from "@call-to-cash/db";
import {
  createBookingExtractionService,
  createDeterministicBookingExtractor,
  createLlmBookingExtractor,
  createOpenAiStructuredTransport,
  type BookingExtractor
} from "@call-to-cash/ai";
import type { AiProvider } from "@call-to-cash/config";
import {
  BookingExtractionCandidateSchema,
  CallStatus,
  EventName,
  type BookingExtractionCandidate
} from "@call-to-cash/shared";
import { transitionCall, type StateTransitionResult } from "@call-to-cash/domain";

import { bookingDraftWriter, recomputeBookingRiskAndEvents } from "../../booking/index.js";
import { confirmBooking } from "../../booking/commands/confirm-booking.js";
import type { BookingDraftWriter } from "../../booking/index.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { appendEvent } from "../../../platform/events/event-log.js";
import { formatTranscriptForDisplay, maskPhone, redactContent } from "../call-session.presenter.js";
import { extractReplayFacts } from "../replay/replay-extractor.js";
import type { AppendTranscriptTurnInput, CallStatusValue, ServiceData } from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function present<T>(value: T, turnId: string) {
  return {
    value,
    confidence: 1,
    status: "PRESENT" as const,
    evidenceRefs: [{ turnId }]
  };
}

export function deterministicCandidateFromFacts(
  facts: {
    routeFrom?: string;
    routeTo?: string;
    passengerCount?: number;
    pickupPoint?: string;
    contactPhoneMasked?: string;
    departureLocalTime?: string;
    departureDay?: number;
    departureMonth?: number;
  },
  sourceTurnId: string
): BookingExtractionCandidate {
  return {
    schemaVersion: "ctc.booking-extraction.v1",
    fields: {
      ...(facts.routeFrom === undefined ? {} : { origin: present(facts.routeFrom, sourceTurnId) }),
      ...(facts.routeTo === undefined
        ? {}
        : { destination: present(facts.routeTo, sourceTurnId) }),
      ...(facts.departureLocalTime === undefined
        ? {}
        : { departureTime: present(facts.departureLocalTime, sourceTurnId) }),
      ...(facts.passengerCount === undefined
        ? {}
        : { passengerCount: present(facts.passengerCount, sourceTurnId) }),
      ...(facts.pickupPoint === undefined
        ? {}
        : { pickupPoint: present(facts.pickupPoint, sourceTurnId) }),
      ...(facts.contactPhoneMasked === undefined
        ? {}
        : { contactPhoneCandidate: present(facts.contactPhoneMasked, sourceTurnId) })
    },
    warnings: []
  };
}

function fieldConfidence(candidate: BookingExtractionCandidate | undefined): Record<string, number> {
  const fields = candidate?.fields;
  const entries = [
    ["origin", fields?.origin],
    ["destination", fields?.destination],
    ["departureDate", fields?.departureDate],
    ["departureTime", fields?.departureTime],
    ["passengerCount", fields?.passengerCount],
    ["pickupPoint", fields?.pickupPoint],
    ["contactPhoneCandidate", fields?.contactPhoneCandidate],
    ["customerNotes", fields?.customerNotes]
  ] as const;
  return Object.fromEntries(
    entries.flatMap(([field, value]) => (value === undefined ? [] : [[field, value.confidence]]))
  );
}

function safeCandidateForPersistence(candidate: BookingExtractionCandidate | undefined) {
  const parsed = BookingExtractionCandidateSchema.safeParse(candidate);
  if (!parsed.success) return {};
  const contact = parsed.data.fields.contactPhoneCandidate;
  return {
    ...parsed.data,
    fields: {
      ...parsed.data.fields,
      ...(contact === undefined
        ? {}
        : {
            contactPhoneCandidate: {
              ...contact,
              value: contact.value === null ? null : maskPhone(contact.value)
            }
          })
    }
  };
}

export function retainCorroboratedCandidateFacts(
  facts: Parameters<typeof deterministicCandidateFromFacts>[0],
  candidate: BookingExtractionCandidate | undefined,
  sourceTurnId: string
) {
  const parsed = BookingExtractionCandidateSchema.safeParse(candidate);
  if (!parsed.success) return facts;
  const fields = parsed.data.fields;
  const sameTurn = Object.values(fields).every((field) =>
    field?.evidenceRefs.every((ref) => ref.turnId === sourceTurnId)
  );
  if (!sameTurn) return facts;
  const same = <T>(value: T | null | undefined, expected: T | undefined) =>
    value !== null && value !== undefined && value === expected;
  return {
    ...facts,
    ...(same(fields.origin?.value, facts.routeFrom) ? { routeFrom: facts.routeFrom } : {}),
    ...(same(fields.destination?.value, facts.routeTo) ? { routeTo: facts.routeTo } : {}),
    ...(same(fields.departureTime?.value, facts.departureLocalTime)
      ? { departureLocalTime: facts.departureLocalTime }
      : {}),
    ...(same(fields.passengerCount?.value, facts.passengerCount)
      ? { passengerCount: facts.passengerCount }
      : {}),
    ...(same(fields.pickupPoint?.value, facts.pickupPoint) ? { pickupPoint: facts.pickupPoint } : {}),
    ...(same(fields.contactPhoneCandidate?.value, facts.contactPhoneMasked)
      ? { contactPhoneMasked: facts.contactPhoneMasked }
      : {})
  };
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

export function isTrustedAgoraVoiceConfirmation(source: string, content: string): boolean {
  const normalized = content
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return source === "AGORA" && /\b(?:toi\s+)?xac\s+nhan\b/u.test(normalized);
}

export async function appendTranscriptTurn(
  client: import("@call-to-cash/db").DatabaseClient,
  input: AppendTranscriptTurnInput,
  draftWriter: BookingDraftWriter = bookingDraftWriter,
  aiProvider: AiProvider = "deterministic",
  injectedBookingExtractor?: BookingExtractor,
  aiExtraction?: {
    mode: "deterministic" | "hybrid";
    model: string;
    apiKey: string;
    timeoutMs: number;
    promptVersion: string;
  }
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
      const extractor = injectedBookingExtractor ?? createBookingExtractionService({
        provider: aiProvider,
        ...(aiExtraction === undefined ? {} : { mode: aiExtraction.mode }),
        deterministic: createDeterministicBookingExtractor(() =>
          deterministicCandidateFromFacts(facts, turn.publicId)
        ),
        ...(aiProvider !== "openai" || aiExtraction === undefined
          ? {}
          : {
              openai: createLlmBookingExtractor(
                createOpenAiStructuredTransport({
                  apiKey: aiExtraction.apiKey,
                  model: aiExtraction.model,
                  timeoutMs: aiExtraction.timeoutMs
                }),
                aiExtraction.promptVersion
              )
            })
      });
      const extraction = await extractor.extract({
        sourceTurnId: turn.publicId,
        transcript: input.turn.content,
        locale: input.turn.language
      });
      const validatedFacts = retainCorroboratedCandidateFacts(
        facts,
        extraction.candidate,
        turn.publicId
      );
      const persistedCandidate = safeCandidateForPersistence(extraction.candidate);
      const booking = await draftWriter.upsertFromFacts(transaction, {
        callSessionId: activeCall.id,
        facts: validatedFacts,
        requestId: input.requestId,
        now
      });
      await transaction.bookingExtraction.create({
        data: {
          publicId: opaqueId("ext"),
          callSessionId: activeCall.id,
          sourceTurnFrom: turn.sequenceNo,
          sourceTurnTo: turn.sequenceNo,
          extractionVersion: `ctc-booking-extraction-v1:${extraction.provider}`,
          payload: asJson({
            extractorType: aiProvider,
            provider: extraction.provider,
            model: extraction.provider === "openai" ? aiExtraction?.model ?? null : null,
            schemaVersion: "ctc.booking-extraction.v1",
            promptVersion: extraction.promptVersion ?? null,
            fallbackUsed: extraction.fallbackUsed,
            outcome: extraction.outcome,
            sourceTurnId: turn.publicId,
            fields: persistedCandidate
          }),
          fieldConfidence: asJson(fieldConfidence(extraction.candidate)),
          missingFields: asJson([]),
          contradictions: asJson([]),
          status: extraction.outcome === "SUCCESS" ? "ACCEPTED" : "PROPOSED"
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
      if (isTrustedAgoraVoiceConfirmation(input.turn.source, input.turn.content)) {
        const confirmable = await transaction.booking.findUnique({
          where: { id: booking.id },
          select: { publicId: true, status: true }
        });
        if (confirmable?.status === "AGREEMENT_READY") {
          await confirmBooking(
            transaction,
            confirmable.publicId,
            {
              agreementVersion: 1,
              confirmation: { method: "VOICE", confirmedTurnId: turn.publicId }
            },
            `agora-voice-confirm-${turn.publicId}`,
            input.requestId,
            now
          );
        }
      }
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
