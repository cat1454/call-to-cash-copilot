import { randomInt, timingSafeEqual, createHmac } from "node:crypto";

import {
  AgoraAdapterError,
  AgoraConversationAgentClient,
  AgoraTranscriptProviderEventSchema,
  TranscriptDeduplicator,
  issueRtcAndRtmToken,
  issueRtcToken,
  normalizeTranscriptEvent
} from "@call-to-cash/agora";
import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { appendTranscriptTurn } from "../call-session/commands/append-transcript-turn.js";
import { createCallSession } from "../call-session/commands/create-call-session.js";
import { endCallSession } from "../call-session/commands/end-call-session.js";
import { getCallSession } from "../call-session/queries/get-call-session.js";
import { recordLiveAudioConsent } from "./commands/record-live-audio-consent.js";
import { presentVoiceSession } from "./voice-session.presenter.js";
import type { VoiceSessionRuntime } from "./types.js";

function requireDatabase(client?: DatabaseClient): DatabaseClient {
  if (client === undefined) {
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  }
  return client;
}

function consentStatus(call: {
  consentRecords: Array<{ status: "GRANTED" | "REVOKED" | "DECLINED" }>;
}): "GRANTED" | "REVOKED" | "DECLINED" {
  return call.consentRecords[0]?.status ?? "DECLINED";
}

function verifySignature(secret: string, payload: unknown, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(signature);
  return (
    expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)
  );
}

function isFresh(timestamp: string, now = Date.now()): boolean {
  const eventTime = Date.parse(timestamp);
  return Number.isFinite(eventTime) && Math.abs(now - eventTime) <= 5 * 60 * 1_000;
}

export function createVoiceSessionHandlers(config: RuntimeConfig, databaseClient?: DatabaseClient) {
  const database = () => requireDatabase(databaseClient);
  const runtime = new Map<string, VoiceSessionRuntime>();
  const deduplicator = new TranscriptDeduplicator();
  const agentClient = new AgoraConversationAgentClient({
    appId: config.agora.appId,
    customerId: config.agora.customerId,
    customerSecret: config.agora.customerSecret,
    baseUrl: config.agora.baseUrl,
    properties: config.agora.agentProperties
  });

  async function lookup(callId: string) {
    const call = await database().callSession.findUnique({
      where: { publicId: callId },
      include: {
        consentRecords: {
          where: { consentType: "ANALYSIS" },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    if (call === null)
      throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
    return call;
  }

  function mapAgoraError(error: unknown): never {
    if (error instanceof AgoraAdapterError) {
      throw new ApiCommandError(
        error.code === "AGORA_TOKEN_ISSUE_FAILED" ? 502 : 503,
        error.code,
        error.message,
        undefined,
        error.retryable
      );
    }
    throw error;
  }

  return {
    async create(input: { policyVersion: string; requestId: string }) {
      const call = await createCallSession(database(), {
        sourceMode: "LIVE_AGORA",
        analysisEnabled: false,
        requestId: input.requestId
      });
      await recordLiveAudioConsent(database(), {
        callId: call.callId as string,
        status: "GRANTED",
        policyVersion: input.policyVersion,
        requestId: input.requestId
      });
      const saved = await lookup(call.callId as string);
      runtime.set(saved.publicId, { status: "READY" });
      return presentVoiceSession({
        callId: saved.publicId,
        channelName: saved.channelName,
        analysisConsent: consentStatus(saved),
        runtime: runtime.get(saved.publicId)
      });
    },

    async recordConsent(input: {
      callId: string;
      status: "GRANTED" | "REVOKED" | "DECLINED";
      policyVersion: string;
      requestId: string;
    }) {
      const recorded = await recordLiveAudioConsent(database(), input);
      if (recorded.status !== "GRANTED")
        await this.stop({ callId: input.callId, requestId: input.requestId });
      const saved = await lookup(input.callId);
      return presentVoiceSession({
        callId: saved.publicId,
        channelName: saved.channelName,
        analysisConsent: consentStatus(saved),
        runtime: runtime.get(saved.publicId)
      });
    },

    async start(input: { callId: string; requestId: string }) {
      if (config.voiceProvider !== "agora" || !config.agora.ready) {
        throw new ApiCommandError(
          503,
          "AGORA_CHANNEL_UNAVAILABLE",
          "Live voice is not configured.",
          undefined,
          false
        );
      }
      const call = await lookup(input.callId);
      if (consentStatus(call) !== "GRANTED" || !call.analysisEnabled) {
        throw new ApiCommandError(
          422,
          "TRANSCRIPT_CONSENT_REQUIRED",
          "Live audio consent is required before connecting."
        );
      }
      const customerUid = randomInt(1, 4_000_000_000);
      const session: VoiceSessionRuntime = { status: "STARTING", customerUid };
      runtime.set(call.publicId, session);
      try {
        const rtc = issueRtcToken(config.agora, {
          channelName: call.channelName,
          uid: customerUid
        });
        const agentToken = issueRtcAndRtmToken(config.agora, {
          channelName: call.channelName,
          uid: config.agora.agentUid
        });
        const agent = await agentClient.start({
          channelName: call.channelName,
          agentToken,
          agentUid: config.agora.agentUid,
          customerUid,
          name: `${config.agora.agentName}-${call.publicId}`
        });
        const connected = {
          status: "CONNECTED" as const,
          customerUid,
          agentId: agent.agentId,
          rtc
        };
        runtime.set(call.publicId, connected);
        return presentVoiceSession({
          callId: call.publicId,
          channelName: call.channelName,
          analysisConsent: "GRANTED",
          runtime: connected,
          rtc
        });
      } catch (error) {
        runtime.set(call.publicId, { status: "FAILED", customerUid });
        return mapAgoraError(error);
      }
    },

    async stop(input: { callId: string; requestId: string }) {
      const active = runtime.get(input.callId);
      runtime.set(input.callId, { ...active, status: "STOPPING" });
      if (active?.agentId) {
        try {
          await agentClient.stop(active.agentId);
        } catch {
          // End the local session even when the provider is already unavailable.
        }
      }
      const call = await lookup(input.callId);
      if (!["ENDED", "CANCELLED", "FAILED"].includes(call.status)) {
        await endCallSession(database(), {
          callId: input.callId,
          reason: "CUSTOMER_ENDED",
          requestId: input.requestId
        });
      }
      runtime.set(input.callId, { status: "ENDED" });
      return presentVoiceSession({
        callId: call.publicId,
        channelName: call.channelName,
        analysisConsent: consentStatus(call),
        runtime: runtime.get(input.callId)
      });
    },

    async get(callId: string) {
      const call = await lookup(callId);
      return presentVoiceSession({
        callId: call.publicId,
        channelName: call.channelName,
        analysisConsent: consentStatus(call),
        runtime: runtime.get(call.publicId)
      });
    },

    async ingestProviderEvent(input: {
      callId: string;
      payload: unknown;
      signature?: string;
      requestId: string;
    }) {
      if (
        !config.agora.webhookSecret ||
        !verifySignature(config.agora.webhookSecret, input.payload, input.signature)
      ) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      const providerEvent = AgoraTranscriptProviderEventSchema.parse(input.payload);
      if (!isFresh(providerEvent.occurredAt)) {
        throw new ApiCommandError(401, "WEBHOOK_EVENT_EXPIRED", "Provider event was rejected.");
      }
      const call = await lookup(input.callId);
      const active = runtime.get(input.callId);
      if (
        providerEvent.callId !== input.callId ||
        providerEvent.channelName !== call.channelName ||
        providerEvent.sessionId !== active?.agentId
      ) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      const normalized = normalizeTranscriptEvent(providerEvent);
      if (!normalized.isFinal) return { accepted: false, persisted: false, duplicate: false };
      if (!deduplicator.accept(`${input.callId}:${normalized.providerTurnId}`)) {
        return { accepted: true, persisted: false, duplicate: true };
      }
      const result = await appendTranscriptTurn(database(), {
        callId: input.callId,
        requestId: input.requestId,
        turn: {
          clientTurnId: normalized.providerTurnId,
          sequenceNo: normalized.sequenceNo,
          speaker: normalized.speaker,
          content: normalized.content,
          language: normalized.language,
          isFinal: true,
          source: "AGORA",
          ...(normalized.startedAt === undefined ? {} : { startedAt: normalized.startedAt }),
          ...(normalized.endedAt === undefined ? {} : { endedAt: normalized.endedAt }),
          ...(normalized.sttConfidence === undefined
            ? {}
            : { sttConfidence: normalized.sttConfidence })
        }
      });
      return { ...result, persisted: true, duplicate: false };
    },

    async getCanonicalCall(callId: string) {
      return getCallSession(database(), callId);
    }
  };
}
