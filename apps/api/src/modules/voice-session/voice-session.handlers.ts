import { randomInt, randomUUID, timingSafeEqual, createHmac } from "node:crypto";

import {
  AgoraAdapterError,
  AgoraConversationAgentClient,
  AgoraTranscriptProviderEventSchema,
  AgoraConversationHistoryNotificationSchema,
  issueRtcAndRtmToken,
  issueRtcToken,
  normalizeTranscriptEvent,
  verifyAgoraNotificationSignature
} from "@call-to-cash/agora";
import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { acceptProviderTranscriptEvent } from "../call-session/commands/accept-provider-transcript-event.js";
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

  async function validateProviderBinding(input: {
    callId: string;
    channelName: string;
    sessionId: string;
  }) {
    const call = await lookup(input.callId);
    const active = runtime.get(input.callId);
    if (input.channelName !== call.channelName || input.sessionId !== active?.agentId) {
      throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
    }
    return call;
  }

  function mapAgoraError(error: unknown): never {
    if (error instanceof AgoraAdapterError) {
      const details =
        error.httpStatus === undefined
          ? undefined
          : {
              httpStatus: error.httpStatus,
              ...(error.providerDetail === undefined
                ? {}
                : { providerDetail: error.providerDetail }),
              ...(error.providerReason === undefined
                ? {}
                : { providerReason: error.providerReason }),
              normalizedCode: error.code,
              retryable: error.retryable
            };
      throw new ApiCommandError(
        error.code === "AGORA_TOKEN_ISSUE_FAILED" ? 502 : 503,
        error.code,
        error.message,
        details,
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
      const customerUid = randomInt(1, 4_000_000_000);
      if (customerUid === config.agora.agentUid) {
        throw new ApiCommandError(
          503,
          "AGORA_CHANNEL_UNAVAILABLE",
          "Live voice is unavailable.",
          undefined,
          true
        );
      }
      const rtc = issueRtcToken(config.agora, { channelName: saved.channelName, uid: customerUid });
      const prepared = { status: "READY" as const, customerUid, rtc };
      runtime.set(saved.publicId, prepared);
      return presentVoiceSession({
        callId: saved.publicId,
        channelName: saved.channelName,
        analysisConsent: consentStatus(saved),
        runtime: prepared,
        rtc
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

    async start(input: {
      callId: string;
      requestId: string;
      rtcConnected: true;
      microphonePublished: true;
      browserRtcUid: number;
    }) {
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
      const prepared = runtime.get(call.publicId);
      if (!prepared?.rtc || prepared.customerUid === undefined) {
        throw new ApiCommandError(
          409,
          "AGORA_CHANNEL_UNAVAILABLE",
          "Browser RTC is not prepared.",
          undefined,
          true
        );
      }
      if (
        prepared.customerUid !== input.browserRtcUid ||
        prepared.customerUid === config.agora.agentUid
      ) {
        throw new ApiCommandError(
          422,
          "AGORA_CHANNEL_UNAVAILABLE",
          "Browser RTC identity is invalid."
        );
      }
      if (prepared.status === "CONNECTED" && prepared.agentId) {
        return presentVoiceSession({
          callId: call.publicId,
          channelName: call.channelName,
          analysisConsent: "GRANTED",
          runtime: prepared,
          rtc: prepared.rtc
        });
      }
      if (prepared.status === "STARTING") {
        throw new ApiCommandError(
          409,
          "AGORA_CHANNEL_UNAVAILABLE",
          "Agora agent start is already in progress.",
          undefined,
          true
        );
      }
      const customerUid = prepared.customerUid;
      const session: VoiceSessionRuntime = { status: "STARTING", customerUid };
      runtime.set(call.publicId, session);
      try {
        const agentToken = issueRtcAndRtmToken(config.agora, {
          channelName: call.channelName,
          uid: config.agora.agentUid
        });
        const agentRequestName = `${config.agora.agentName}-${call.publicId}-${randomUUID().slice(0, 8)}`;
        const agent = await agentClient.start({
          channelName: call.channelName,
          agentToken,
          agentUid: config.agora.agentUid,
          customerUid,
          name: agentRequestName,
          callId: call.publicId
        });
        const connected = {
          status: "CONNECTED" as const,
          customerUid,
          agentId: agent.agentId,
          agentRequestName,
          rtc: prepared.rtc
        };
        runtime.set(call.publicId, connected);
        return presentVoiceSession({
          callId: call.publicId,
          channelName: call.channelName,
          analysisConsent: "GRANTED",
          runtime: connected,
          rtc: prepared.rtc
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
        !config.agora.providerEventSecret ||
        !verifySignature(config.agora.providerEventSecret, input.payload, input.signature)
      ) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      const providerEvent = AgoraTranscriptProviderEventSchema.parse(input.payload);
      if (!isFresh(providerEvent.occurredAt)) {
        throw new ApiCommandError(401, "WEBHOOK_EVENT_EXPIRED", "Provider event was rejected.");
      }
      if (providerEvent.callId !== input.callId) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      await validateProviderBinding({
        callId: input.callId,
        channelName: providerEvent.channelName,
        sessionId: providerEvent.sessionId
      });
      const normalized = normalizeTranscriptEvent(providerEvent);
      return acceptProviderTranscriptEvent(database(), {
        callId: input.callId,
        provider: "agora-conversation-ai",
        providerEventId: providerEvent.eventId,
        providerTurnId: normalized.providerTurnId,
        speaker: normalized.speaker === "CUSTOMER" ? "CUSTOMER" : "AGENT",
        text: normalized.content,
        isFinal: normalized.isFinal,
        occurredAt: providerEvent.occurredAt,
        receivedAt: new Date().toISOString(),
        channelName: providerEvent.channelName,
        sessionId: providerEvent.sessionId,
        requestId: input.requestId,
        sequenceNo: normalized.sequenceNo,
        language: normalized.language
      });
    },

    async reconcileAgoraNotification(input: {
      rawBody: Buffer;
      signature?: string;
      payload: unknown;
      requestId: string;
    }) {
      if (
        !config.agora.ncsWebhookSecret ||
        !verifyAgoraNotificationSignature(config.agora.ncsWebhookSecret, input.rawBody, input.signature)
      ) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      const notification = AgoraConversationHistoryNotificationSchema.parse(input.payload);
      const notificationMilliseconds = Number(notification.notifyMs);
      const noticeTime =
        notification.occurredAt ??
        (Number.isFinite(notificationMilliseconds)
          ? new Date(notificationMilliseconds).toISOString()
          : "invalid");
      if (!isFresh(noticeTime) || String(notification.productId) !== config.agora.ncsProductId) {
        throw new ApiCommandError(401, "WEBHOOK_EVENT_EXPIRED", "Provider event was rejected.");
      }
      const callId = notification.payload.labels.call_id;
      const call = await validateProviderBinding({
        callId,
        channelName: notification.payload.channelName,
        sessionId: notification.payload.sessionId
      });
      try {
        await database().providerWebhookNotice.create({
          data: { provider: "agora-conversation-ai", noticeId: notification.noticeId, callId: call.id }
        });
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          return { accepted: true, persisted: 0, duplicate: true };
        }
        throw error;
      }
      let persisted = 0;
      for (const turn of notification.payload.history) {
        const result = await acceptProviderTranscriptEvent(database(), {
          callId,
          provider: "agora-conversation-ai",
          providerEventId: notification.noticeId,
          providerTurnId: turn.id,
          speaker: turn.role === "user" ? "CUSTOMER" : "AGENT",
          text: turn.text,
          isFinal: turn.isFinal,
          occurredAt: turn.occurredAt ?? noticeTime,
          receivedAt: new Date().toISOString(),
          channelName: notification.payload.channelName,
          sessionId: notification.payload.sessionId,
          requestId: input.requestId,
          ...(turn.sequenceNo === undefined ? {} : { sequenceNo: turn.sequenceNo }),
          ...(turn.language === undefined ? {} : { language: turn.language })
        });
        if (result.persisted) persisted += 1;
      }
      return { accepted: true, persisted, duplicate: false };
    },

    async getCanonicalCall(callId: string) {
      return getCallSession(database(), callId);
    }
  };
}
