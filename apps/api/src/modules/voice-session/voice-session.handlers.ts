import { randomInt, randomUUID, timingSafeEqual, createHash, createHmac } from "node:crypto";

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
import { redactContent } from "../call-session/call-session.presenter.js";
import { createCallSession } from "../call-session/commands/create-call-session.js";
import { endCallSession } from "../call-session/commands/end-call-session.js";
import { getCallSession } from "../call-session/queries/get-call-session.js";
import { recordLiveAudioConsent } from "./commands/record-live-audio-consent.js";
import { AgoraLiveTranscriptRelayClient } from "./live-transcript-relay-client.js";
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

type VoiceSessionLogger = {
  info(bindings: unknown, message?: string): void;
  warn(bindings: unknown, message?: string): void;
};

type VoiceStartStage = "preflight" | "relay_start" | "agora_join" | "relay_bind" | "connected";

type VoiceSessionDependencies = {
  logger?: VoiceSessionLogger;
  runtimeStore?: Map<string, VoiceSessionRuntime>;
  generateCustomerUid?: () => number;
  generateRequestSuffix?: () => string;
  agentClient?: Pick<AgoraConversationAgentClient, "start" | "stop">;
  liveRelayClient?: Pick<AgoraLiveTranscriptRelayClient, "start" | "stop">;
};

function isLogger(
  value: VoiceSessionDependencies | VoiceSessionLogger | undefined
): value is VoiceSessionLogger {
  return (
    typeof value === "object" &&
    value !== null &&
    "info" in value &&
    typeof value.info === "function" &&
    "warn" in value &&
    typeof value.warn === "function"
  );
}

function validateAgoraUidPlan(config: RuntimeConfig, customerUid: number): void {
  const planned = [customerUid, config.agora.agentUid, config.agora.liveRelay.uid];
  if (
    planned.some((uid) => !Number.isInteger(uid) || uid < 1 || uid > 4_294_967_295) ||
    new Set(planned).size !== planned.length
  ) {
    throw new ApiCommandError(422, "AGORA_CHANNEL_UNAVAILABLE", "Agora UID plan is invalid.");
  }
}

function pipelineFingerprint(properties: Record<string, unknown>): string | undefined {
  const pipelineId = properties.pipeline_id;
  if (typeof pipelineId !== "string" || pipelineId.length === 0) return undefined;
  return createHash("sha256").update(pipelineId).digest("hex").slice(0, 12);
}

function voiceStartFailureDiagnostics(error: unknown): Record<string, unknown> {
  if (error instanceof AgoraAdapterError) {
    return {
      failureCode: error.code,
      providerHttpStatus: error.httpStatus,
      retryable: error.retryable
    };
  }
  if (error instanceof ApiCommandError) {
    return { failureCode: error.code, apiStatus: error.statusCode, retryable: error.retryable };
  }
  return {
    failureCode: "UNEXPECTED",
    errorName: error instanceof Error ? error.name : typeof error
  };
}

export function createVoiceSessionHandlers(
  config: RuntimeConfig,
  databaseClient?: DatabaseClient,
  dependenciesOrLogger?: VoiceSessionDependencies | VoiceSessionLogger
) {
  const dependencies = isLogger(dependenciesOrLogger)
    ? { logger: dependenciesOrLogger }
    : (dependenciesOrLogger ?? {});
  const logger = dependencies.logger;
  const database = () => requireDatabase(databaseClient);
  const runtime = dependencies.runtimeStore ?? new Map<string, VoiceSessionRuntime>();
  const agentClient =
    dependencies.agentClient ??
    new AgoraConversationAgentClient({
      appId: config.agora.appId,
      customerId: config.agora.customerId,
      customerSecret: config.agora.customerSecret,
      baseUrl: config.agora.baseUrl,
      properties: config.agora.agentProperties
    });
  const liveRelayClient =
    dependencies.liveRelayClient ??
    new AgoraLiveTranscriptRelayClient({
      url: config.agora.liveRelay.url,
      controlSecret: config.agora.liveRelay.controlSecret
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
      const customerUid = dependencies.generateCustomerUid?.() ?? randomInt(1, 4_000_000_000);
      validateAgoraUidPlan(config, customerUid);
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
      const logBase = {
        requestId: input.requestId,
        callId: input.callId,
        voiceProvider: config.voiceProvider,
        agoraReady: config.agora.ready,
        pipelineFingerprint: pipelineFingerprint(config.agora.agentProperties)
      };
      logger?.info(
        { event: "voice_session.start.requested", ...logBase },
        "Live voice start requested"
      );
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
      validateAgoraUidPlan(config, prepared.customerUid);
      if (prepared.customerUid !== input.browserRtcUid) {
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
      let stage: VoiceStartStage = "preflight";
      try {
        const agentToken = issueRtcAndRtmToken(config.agora, {
          channelName: call.channelName,
          uid: config.agora.agentUid
        });
        const agentRequestName = `${config.agora.agentName}-${call.publicId}-${
          dependencies.generateRequestSuffix?.() ?? randomUUID().slice(0, 8)
        }`;
        const relayToken = issueRtcAndRtmToken(config.agora, {
          channelName: call.channelName,
          uid: config.agora.liveRelay.uid
        });

        // Start relay first with a placeholder sessionId so it is ready to catch the first greeting.
        stage = "relay_start";
        logger?.info(
          { event: "voice_session.start.stage", ...logBase, stage },
          "Live voice start stage"
        );
        try {
          await liveRelayClient.start({
            callId: call.publicId,
            channelName: call.channelName,
            sessionId: "PENDING_AGENT",
            agentUid: config.agora.agentUid,
            token: relayToken
          });
        } catch (error) {
          logger?.warn(
            {
              event: "voice_session.start.stage",
              ...logBase,
              stage: "relay-start-pending-agent",
              ...voiceStartFailureDiagnostics(error)
            },
            "Live voice start stage failed"
          );
          throw error;
        }

        let agent: { agentId: string; name: string } | undefined;
        let relayStarted = true;
        try {
          stage = "agora_join";
          logger?.info(
            { event: "voice_session.start.stage", ...logBase, stage },
            "Live voice start stage"
          );
          agent = await agentClient.start({
            channelName: call.channelName,
            agentToken,
            agentUid: config.agora.agentUid,
            customerUid,
            name: agentRequestName,
            callId: call.publicId
          });
          // Bind any safely buffered early RTM transcript to the provider-issued session id.
          stage = "relay_bind";
          logger?.info(
            { event: "voice_session.start.stage", ...logBase, stage },
            "Live voice start stage"
          );
          await liveRelayClient.start({
            callId: call.publicId,
            channelName: call.channelName,
            sessionId: agent.agentId,
            agentUid: config.agora.agentUid,
            token: relayToken
          });
        } catch (error) {
          logger?.warn(
            {
              event: "voice_session.start.stage",
              ...logBase,
              stage: agent?.agentId ? "relay-bind-agent-session" : "agora-agent-start",
              ...voiceStartFailureDiagnostics(error)
            },
            "Live voice start stage failed"
          );
          if (agent?.agentId) {
            logger?.info(
              { event: "voice_session.start.stage", ...logBase, stage: "agent-cleanup" },
              "Live voice cleanup stage"
            );
            await agentClient.stop(agent.agentId).catch((cleanupError: unknown) => {
              logger?.warn(
                {
                  event: "voice_session.start.stage",
                  ...logBase,
                  stage: "agent-cleanup",
                  ...voiceStartFailureDiagnostics(cleanupError)
                },
                "Live voice cleanup stage failed"
              );
            });
          }
          if (relayStarted) {
            logger?.info(
              { event: "voice_session.start.stage", ...logBase, stage: "relay-cleanup" },
              "Live voice cleanup stage"
            );
            await liveRelayClient.stop(call.publicId).catch((cleanupError: unknown) => {
              logger?.warn(
                {
                  event: "voice_session.start.stage",
                  ...logBase,
                  stage: "relay-cleanup",
                  ...voiceStartFailureDiagnostics(cleanupError)
                },
                "Live voice cleanup stage failed"
              );
            });
            relayStarted = false;
          }
          throw error;
        }
        if (agent === undefined) {
          throw new ApiCommandError(
            503,
            "AGORA_CHANNEL_UNAVAILABLE",
            "Agora agent session is unavailable.",
            undefined,
            true
          );
        }
        const connected = {
          status: "CONNECTED" as const,
          customerUid,
          agentId: agent.agentId,
          agentRequestName,
          relayActive: true as const,
          rtc: prepared.rtc
        };
        runtime.set(call.publicId, connected);
        stage = "connected";
        logger?.info(
          { event: "voice_session.start.stage", ...logBase, stage },
          "Live voice connected"
        );
        return presentVoiceSession({
          callId: call.publicId,
          channelName: call.channelName,
          analysisConsent: "GRANTED",
          runtime: connected,
          rtc: prepared.rtc
        });
      } catch (error) {
        runtime.set(call.publicId, { status: "FAILED", customerUid });
        logger?.warn(
          {
            event: "voice_session.start.failed",
            ...logBase,
            stage,
            ...voiceStartFailureDiagnostics(error)
          },
          "Live voice start failed"
        );
        return mapAgoraError(error);
      }
    },

    async stop(input: { callId: string; requestId: string }) {
      const active = runtime.get(input.callId);
      runtime.set(input.callId, { ...active, status: "STOPPING" });
      if (active?.relayActive) {
        await liveRelayClient.stop(input.callId).catch(() => undefined);
      }
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
      const endedRuntime: VoiceSessionRuntime = active ? { ...active } : { status: "ENDED" };
      delete endedRuntime.relayActive;
      runtime.set(input.callId, { ...endedRuntime, status: "ENDED" });
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
        !verifyAgoraNotificationSignature(
          config.agora.ncsWebhookSecret,
          input.rawBody,
          input.signature
        )
      ) {
        throw new ApiCommandError(401, "WEBHOOK_SIGNATURE_INVALID", "Provider event was rejected.");
      }
      const notification = AgoraConversationHistoryNotificationSchema.parse(input.payload);
      const noticeTime = new Date(notification.notifyMs).toISOString();
      if (!isFresh(noticeTime)) {
        throw new ApiCommandError(401, "WEBHOOK_EVENT_EXPIRED", "Provider event was rejected.");
      }
      const callId = notification.payload.labels.call_id;
      const call = await validateProviderBinding({
        callId,
        channelName: notification.payload.channel,
        sessionId: notification.payload.agent_id
      });
      try {
        await database().providerWebhookNotice.create({
          data: {
            provider: "agora-conversation-ai",
            noticeId: notification.noticeId,
            callId: call.id
          }
        });
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          return { accepted: true, persisted: 0, duplicate: true };
        }
        throw error;
      }
      const existingTurns = await database().transcriptTurn.findMany({
        where: { callSessionId: call.id },
        select: { speaker: true, contentRedacted: true }
      });
      const unreconciledExisting = [...existingTurns];
      let persisted = 0;
      for (const [index, turn] of notification.payload.contents.entries()) {
        const text = turn.content.trim();
        if (text.length === 0) continue;
        const speaker = turn.role === "user" ? "CUSTOMER" : "AGENT";
        const matchingExistingIndex = unreconciledExisting.findIndex(
          (existing) =>
            existing.speaker === speaker && existing.contentRedacted === redactContent(text)
        );
        if (matchingExistingIndex >= 0) {
          unreconciledExisting.splice(matchingExistingIndex, 1);
          continue;
        }
        const occurredAt =
          turn.speech_end_ms === undefined
            ? noticeTime
            : new Date(turn.speech_end_ms).toISOString();
        const result = await acceptProviderTranscriptEvent(database(), {
          callId,
          provider: "agora-conversation-ai",
          providerEventId: notification.noticeId,
          providerTurnId: `${notification.noticeId}:${index}:${turn.role}`,
          speaker,
          text,
          isFinal: true,
          occurredAt,
          receivedAt: new Date().toISOString(),
          channelName: notification.payload.channel,
          sessionId: notification.payload.agent_id,
          requestId: input.requestId,
          sequenceNo: index + 1,
          language: "vi-VN"
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
