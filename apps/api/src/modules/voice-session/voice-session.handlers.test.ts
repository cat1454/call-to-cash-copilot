import assert from "node:assert/strict";
import test from "node:test";

import { AgoraAdapterError } from "@call-to-cash/agora";
import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { createVoiceSessionHandlers } from "./voice-session.handlers.js";
import type { VoiceSessionRuntime } from "./types.js";

const callId = "call_voice_start_001";
const channelName = "ctc_call_voice_start_001";

const voiceConfig: RuntimeConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3001,
  webOrigin: "",
  demoMode: true,
  paymentProvider: "mock",
  solanaDevnet: {
    cluster: "devnet",
    rpcUrl: "https://api.devnet.solana.com/",
    recipientPublicKey: "",
    demoAmountLamports: 1_000_000,
    paymentLabel: "Call-to-Cash Demo",
    commitment: "confirmed",
    ready: false
  },
  voiceProvider: "agora",
  agora: {
    appId: "00000000000000000000000000000000",
    appCertificate: "11111111111111111111111111111111",
    customerId: "customer",
    customerSecret: "secret",
    providerEventSecret: "provider-secret",
    ncsWebhookSecret: "ncs-secret",
    agentProperties: { pipeline_id: "pipeline" },
    tokenTtlSeconds: 600,
    agentUid: 9001,
    agentName: "call-to-cash-agent",
    baseUrl: "https://api.agora.io/",
    liveRelay: {
      url: "http://127.0.0.1:3011/",
      controlSecret: "relay-control-secret",
      uid: 9002,
      ready: true
    },
    ready: true
  },
  aiProvider: "deterministic",
  aiExtraction: {
    mode: "hybrid",
    model: "gpt-5-mini",
    apiKey: "",
    timeoutMs: 1_500,
    promptVersion: "CTC-BOOKING-EXTRACTION-V1"
  },
  logLevel: "silent",
  rateLimitMax: 0
};

function fakeDatabase(): DatabaseClient {
  return {
    callSession: {
      async findUnique() {
        return {
          publicId: callId,
          channelName,
          analysisEnabled: true,
          consentRecords: [{ status: "GRANTED" }]
        };
      }
    }
  } as unknown as DatabaseClient;
}

function preparedRuntime(customerUid = 1234): Map<string, VoiceSessionRuntime> {
  return new Map([
    [
      callId,
      {
        status: "READY",
        customerUid,
        rtc: {
          appId: voiceConfig.agora.appId,
          channelName,
          uid: customerUid,
          token: "browser-token",
          expiresAt: "2030-06-20T15:30:00.000Z"
        }
      }
    ]
  ]);
}

function captureLogger() {
  const entries: Array<{ level: "info" | "warn"; payload: Record<string, unknown> }> = [];
  return {
    entries,
    logger: {
      info(payload: Record<string, unknown>) {
        entries.push({ level: "info", payload });
      },
      warn(payload: Record<string, unknown>) {
        entries.push({ level: "warn", payload });
      }
    }
  };
}

test("voice start orders relay pending, Agora agent start, then relay binding", async () => {
  const order: string[] = [];
  const handlers = createVoiceSessionHandlers(voiceConfig, fakeDatabase(), {
    runtimeStore: preparedRuntime(),
    generateRequestSuffix: () => "fixed",
    liveRelayClient: {
      async start(session) {
        order.push(`relay-start:${session.sessionId}`);
      },
      async stop() {
        order.push("relay-stop");
      }
    },
    agentClient: {
      async start() {
        order.push("agent-start");
        return { agentId: "agent-session-1", name: "agent" };
      },
      async stop() {
        order.push("agent-stop");
      }
    }
  });

  const result = await handlers.start({
    callId,
    requestId: "req_voice_start",
    rtcConnected: true,
    microphonePublished: true,
    browserRtcUid: 1234
  });

  assert.deepEqual(order, [
    "relay-start:PENDING_AGENT",
    "agent-start",
    "relay-start:agent-session-1"
  ]);
  assert.equal(result.agentStarted, true);
});

test("voice start surfaces pending relay failure before provider agent calls", async () => {
  let agentStarts = 0;
  let relayStops = 0;
  const { entries, logger } = captureLogger();
  const handlers = createVoiceSessionHandlers(voiceConfig, fakeDatabase(), {
    runtimeStore: preparedRuntime(),
    logger,
    liveRelayClient: {
      async start() {
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          "Live transcript relay returned HTTP 503.",
          true,
          503,
          "relay unavailable"
        );
      },
      async stop() {
        relayStops += 1;
      }
    },
    agentClient: {
      async start() {
        agentStarts += 1;
        return { agentId: "agent-session-1", name: "agent" };
      },
      async stop() {}
    }
  });

  await assert.rejects(
    handlers.start({
      callId,
      requestId: "req_voice_start",
      rtcConnected: true,
      microphonePublished: true,
      browserRtcUid: 1234
    }),
    (error) => error instanceof ApiCommandError && error.statusCode === 503
  );
  assert.equal(agentStarts, 0);
  assert.equal(relayStops, 0);
  assert.equal(
    entries.some(
      (entry) => entry.level === "warn" && entry.payload.stage === "relay-start-pending-agent"
    ),
    true
  );
});

test("voice start cleans up pending relay exactly once when agent start fails", async () => {
  const order: string[] = [];
  const handlers = createVoiceSessionHandlers(voiceConfig, fakeDatabase(), {
    runtimeStore: preparedRuntime(),
    liveRelayClient: {
      async start(session) {
        order.push(`relay-start:${session.sessionId}`);
      },
      async stop() {
        order.push("relay-stop");
      }
    },
    agentClient: {
      async start() {
        order.push("agent-start");
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          "Agora Conversation AI Engine is unavailable.",
          true,
          503,
          "provider overloaded"
        );
      },
      async stop() {
        order.push("agent-stop");
      }
    }
  });

  await assert.rejects(
    handlers.start({
      callId,
      requestId: "req_voice_start",
      rtcConnected: true,
      microphonePublished: true,
      browserRtcUid: 1234
    }),
    (error) => error instanceof ApiCommandError && error.statusCode === 503
  );
  assert.deepEqual(order, ["relay-start:PENDING_AGENT", "agent-start", "relay-stop"]);
});

test("voice start cleans up agent and relay when final relay binding fails", async () => {
  const order: string[] = [];
  const handlers = createVoiceSessionHandlers(voiceConfig, fakeDatabase(), {
    runtimeStore: preparedRuntime(),
    liveRelayClient: {
      async start(session) {
        order.push(`relay-start:${session.sessionId}`);
        if (session.sessionId !== "PENDING_AGENT") {
          throw new AgoraAdapterError(
            "AGORA_CHANNEL_UNAVAILABLE",
            "Live transcript relay returned HTTP 503.",
            true,
            503,
            "bind failed"
          );
        }
      },
      async stop() {
        order.push("relay-stop");
      }
    },
    agentClient: {
      async start() {
        order.push("agent-start");
        return { agentId: "agent-session-1", name: "agent" };
      },
      async stop() {
        order.push("agent-stop");
      }
    }
  });

  await assert.rejects(
    handlers.start({
      callId,
      requestId: "req_voice_start",
      rtcConnected: true,
      microphonePublished: true,
      browserRtcUid: 1234
    }),
    (error) => error instanceof ApiCommandError && error.statusCode === 503
  );
  assert.deepEqual(order, [
    "relay-start:PENDING_AGENT",
    "agent-start",
    "relay-start:agent-session-1",
    "agent-stop",
    "relay-stop"
  ]);
});

test("voice start rejects UID collision before contacting relay or provider", async () => {
  let providerCalls = 0;
  const handlers = createVoiceSessionHandlers(
    {
      ...voiceConfig,
      agora: {
        ...voiceConfig.agora,
        liveRelay: { ...voiceConfig.agora.liveRelay, uid: voiceConfig.agora.agentUid }
      }
    },
    fakeDatabase(),
    {
      runtimeStore: preparedRuntime(),
      liveRelayClient: {
        async start() {
          providerCalls += 1;
        },
        async stop() {
          providerCalls += 1;
        }
      },
      agentClient: {
        async start() {
          providerCalls += 1;
          return { agentId: "agent-session-1", name: "agent" };
        },
        async stop() {
          providerCalls += 1;
        }
      }
    }
  );

  await assert.rejects(
    handlers.start({
      callId,
      requestId: "req_voice_start",
      rtcConnected: true,
      microphonePublished: true,
      browserRtcUid: 1234
    }),
    (error) =>
      error instanceof ApiCommandError &&
      error.statusCode === 422 &&
      error.code === "AGORA_CHANNEL_UNAVAILABLE"
  );
  assert.equal(providerCalls, 0);
});
