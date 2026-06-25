import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AgoraConversationAgentClient,
  AgoraConversationHistoryNotificationSchema,
  TranscriptDeduplicator,
  normalizeTranscriptEvent,
  verifyAgoraNotificationSignature
} from "./index.js";
import { createHmac } from "node:crypto";

test("normalizes final provider transcript turns and keeps provider turn identity", () => {
  assert.deepEqual(
    normalizeTranscriptEvent({
      type: "transcript.turn",
      eventId: "evt_1",
      callId: "call_012345",
      channelName: "ctc_call_012345",
      sessionId: "agent_1",
      occurredAt: "2026-06-21T10:00:00.000Z",
      turn: {
        id: "provider-turn-1",
        sequenceNo: 2,
        speaker: "CUSTOMER",
        text: "  Xin chào  ",
        language: "vi-VN",
        final: true,
        confidence: 0.91
      }
    }),
    {
      providerTurnId: "provider-turn-1",
      sequenceNo: 2,
      speaker: "CUSTOMER",
      content: "Xin chào",
      language: "vi-VN",
      isFinal: true,
      sttConfidence: 0.91
    }
  );
});

test("deduplicator only accepts a provider turn once", () => {
  const deduplicator = new TranscriptDeduplicator();
  assert.equal(deduplicator.accept("provider-turn-1"), true);
  assert.equal(deduplicator.accept("provider-turn-1"), false);
});

test("normalization preserves interim status so the API can refuse durable admission", () => {
  const turn = normalizeTranscriptEvent({
    type: "transcript.turn",
    eventId: "evt_interim",
    callId: "call_012345",
    channelName: "ctc_call_012345",
    sessionId: "agent_1",
    occurredAt: "2026-06-21T10:00:00.000Z",
    turn: {
      id: "provider-turn-interim",
      sequenceNo: 3,
      speaker: "CUSTOMER",
      text: "Tôi muốn đi...",
      language: "vi-VN",
      final: false
    }
  });
  assert.equal(turn.isFinal, false);
});

test("normalization cleans display-safe whitespace and punctuation without changing final authority", () => {
  const turn = normalizeTranscriptEvent({
    type: "transcript.turn",
    eventId: "evt_spacing",
    callId: "call_012345",
    channelName: "ctc_call_012345",
    sessionId: "agent_1",
    occurredAt: "2026-06-21T10:00:00.000Z",
    turn: {
      id: "provider-turn-spacing",
      sequenceNo: 4,
      speaker: "CUSTOMER",
      text: "Dạ,   em muốn , đặt ba chỗ .",
      language: "vi-VN",
      final: true
    }
  });

  assert.equal(turn.content, "Dạ, em muốn, đặt ba chỗ.");
  assert.equal(turn.isFinal, true);
});

test("normalization preserves time money and phone-like spacing", () => {
  const turn = normalizeTranscriptEvent({
    type: "transcript.turn",
    eventId: "evt_formats",
    callId: "call_012345",
    channelName: "ctc_call_012345",
    sessionId: "agent_1",
    occurredAt: "2026-06-21T10:00:00.000Z",
    turn: {
      id: "provider-turn-formats",
      sequenceNo: 5,
      speaker: "CUSTOMER",
      text: "Lúc 19 : 00, cọc 300 . 000 đ, số 0912 345 678.",
      language: "vi-VN",
      final: true
    }
  });

  assert.equal(turn.content, "Lúc 19:00, cọc 300.000 đ, số 0912 345 678.");
});

test("native pipeline join injects the versioned V1 system message without custom LLM overrides", async () => {
  let joinBody: Record<string, unknown> | undefined;
  const client = new AgoraConversationAgentClient(
    {
      appId: "app-id",
      customerId: "customer-id",
      customerSecret: "customer-secret",
      baseUrl: "https://example.test",
      properties: {
        pipeline_id: "pipeline-id",
        llm: { vendor: "openai", model: "gpt-4.1", endpoint: "https://llm.example.test" },
        asr: { language: "vi-VN" },
        tts: { voice: "vi-female" },
        providerManagedSetting: true
      }
    },
    async (_url, init) => {
      joinBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 });
    }
  );

  await client.start({
    channelName: "ctc_call_012345",
    agentToken: "server-only-token",
    agentUid: 10001,
    customerUid: 10002,
    name: "call-012345",
    callId: "call_012345"
  });

  assert.equal(joinBody?.pipeline_id, "pipeline-id");
  const properties = joinBody?.properties as Record<string, unknown>;
  const llm = properties.llm as Record<string, unknown>;
  assert.equal("vendor" in llm, false);
  assert.equal("model" in llm, false);
  assert.equal("endpoint" in llm, false);
  assert.equal("url" in llm, false);
  assert.equal("api_key" in llm, false);
  assert.deepEqual(properties.asr, { language: "vi-VN" });
  assert.deepEqual(properties.tts, { voice: "vi-female" });
  assert.equal(properties.providerManagedSetting, true);
  assert.deepEqual(properties.remote_rtc_uids, ["10002"]);
  assert.equal(properties.agent_rtc_uid, "10001");
  assert.equal(properties.agent_rtm_uid, "10001");
  assert.deepEqual(joinBody?.labels, { call_id: "call_012345", schema_version: "ctc-v1" });
  assert.notEqual(properties.remote_rtc_uids[0], properties.agent_rtc_uid);
  const systemMessages = llm.system_messages as Array<{ role: string; content: string }>;
  assert.equal(systemMessages.length, 1);
  assert.equal(systemMessages[0]?.role, "system");
  assert.match(systemMessages[0]?.content ?? "", /Prompt ID: CTC-AGORA-VI-V1/u);
});

test("join request defaults ASR to Vietnamese when the pipeline properties omit it", async () => {
  let joinBody: Record<string, unknown> | undefined;
  const client = new AgoraConversationAgentClient(
    {
      appId: "app-id",
      customerId: "customer-id",
      customerSecret: "customer-secret",
      baseUrl: "https://example.test",
      properties: { pipeline_id: "pipeline-id" }
    },
    async (_url, init) => {
      joinBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 });
    }
  );

  await client.start({
    channelName: "ctc_call_012345",
    agentToken: "server-only-token",
    agentUid: 10001,
    customerUid: 10002,
    name: "call-012345",
    callId: "call_012345"
  });

  assert.deepEqual((joinBody?.properties as Record<string, unknown>).asr, { language: "vi-VN" });
});

test("accepts the documented Agora event 103 history payload", () => {
  const parsed = AgoraConversationHistoryNotificationSchema.parse({
    noticeId: "notice-103-1",
    productId: 17,
    eventType: 103,
    notifyMs: 1782100000000,
    sid: "notification-session-1",
    payload: {
      agent_id: "agent-session-1",
      name: "call-agent",
      channel: "ctc_call_012345",
      start_ts: 1782099900,
      stop_ts: 1782100000,
      contents: [
        { role: "user", content: "Tôi muốn đi Sa Pa." },
        { role: "assistant", content: "Bạn muốn khởi hành khi nào?" }
      ],
      labels: { call_id: "call_012345", schema_version: "ctc-v1" }
    }
  });

  assert.equal(parsed.payload.channel, "ctc_call_012345");
  assert.equal(parsed.payload.contents.length, 2);
});

test("notification signature verifies exact raw request bytes", () => {
  const body = Buffer.from('{"noticeId":"notice_1"}', "utf8");
  const signature = createHmac("sha256", "ncs-secret").update(body).digest("hex");
  assert.equal(verifyAgoraNotificationSignature("ncs-secret", body, signature), true);
  assert.equal(verifyAgoraNotificationSignature("ncs-secret", Buffer.from("{}"), signature), false);
  assert.equal(verifyAgoraNotificationSignature("ncs-secret", body, undefined), false);
});

test("join failure preserves only safe provider diagnostics", async () => {
  const client = new AgoraConversationAgentClient(
    {
      appId: "app-id",
      customerId: "customer-id",
      customerSecret: "customer-secret",
      baseUrl: "https://example.test",
      properties: { pipeline_id: "pipeline-id" }
    },
    async () =>
      new Response(
        JSON.stringify({ detail: "invalid agent configuration", reason: "invalid_pipeline" }),
        { status: 422 }
      )
  );

  await assert.rejects(
    () =>
      client.start({
        channelName: "ctc_call_012345",
        agentToken: "server-only-token",
        agentUid: 10001,
        customerUid: 10002,
        name: "call-012345",
        callId: "call_012345"
      }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      const diagnostic = error as Error & {
        httpStatus?: number;
        providerDetail?: string;
        providerReason?: string;
        code?: string;
        retryable?: boolean;
      };
      assert.equal(diagnostic.httpStatus, 422);
      assert.equal(diagnostic.providerDetail, "invalid agent configuration");
      assert.equal(diagnostic.providerReason, "invalid_pipeline");
      assert.equal(diagnostic.code, "AGORA_CHANNEL_UNAVAILABLE");
      assert.equal(diagnostic.retryable, false);
      return true;
    }
  );
});

test("join client does not log tokens or prompt content", () => {
  const source = readFileSync(new URL("conversation-agent-client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(log|info|warn|error)/u);
  assert.doesNotMatch(source, /promptContentLength.*console/u);
});
