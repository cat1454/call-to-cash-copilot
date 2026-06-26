import assert from "node:assert/strict";
import test from "node:test";

import { AgoraLiveTranscriptRelayClient } from "./live-transcript-relay-client.js";

test("starts the isolated relay with an HMAC-protected command and no transcript payload", async () => {
  let sent: { url: string; init?: RequestInit | undefined } | undefined;
  const client = new AgoraLiveTranscriptRelayClient(
    { url: "http://127.0.0.1:3011", controlSecret: "control-secret" },
    async (url, init) => {
      sent = { url: String(url), init };
      return new Response(null, { status: 202 });
    }
  );

  await client.start({
    callId: "call_123456",
    channelName: "call_123456",
    sessionId: "agent-session-1",
    agentUid: 9001,
    token: "server-issued-rtm-token"
  });

  assert.equal(sent?.url, "http://127.0.0.1:3011/v1/relay/sessions");
  assert.match(
    String(sent?.init?.headers && new Headers(sent.init.headers).get("x-ctc-relay-signature")),
    /^sha256=/
  );
  assert.match(String(sent?.init?.body), /agent-session-1/);
});

test("fails closed when the isolated relay cannot accept a start command", async () => {
  const client = new AgoraLiveTranscriptRelayClient(
    { url: "http://127.0.0.1:3011", controlSecret: "control-secret" },
    async () => new Response(null, { status: 503 })
  );

  await assert.rejects(
    client.start({
      callId: "call_123456",
      channelName: "call_123456",
      sessionId: "agent-session-1",
      agentUid: 9001,
      token: "server-issued-rtm-token"
    }),
    /Live transcript relay is unavailable/
  );
});

test("stops the isolated relay without an empty JSON body or content-type", async () => {
  let sent: { url: string; init?: RequestInit | undefined } | undefined;
  const client = new AgoraLiveTranscriptRelayClient(
    { url: "http://127.0.0.1:3011", controlSecret: "control-secret" },
    async (url, init) => {
      sent = { url: String(url), init };
      return new Response(null, { status: 204 });
    }
  );

  await client.stop("call_123456");

  const headers = new Headers(sent?.init?.headers);
  assert.equal(sent?.url, "http://127.0.0.1:3011/v1/relay/sessions/call_123456");
  assert.equal(sent?.init?.method, "DELETE");
  assert.equal(headers.get("content-type"), null);
  assert.equal(sent?.init && "body" in sent.init, false);
  assert.match(String(headers.get("x-ctc-relay-signature")), /^sha256=/);
});

test("treats relay stop 404 as idempotent cleanup", async () => {
  const client = new AgoraLiveTranscriptRelayClient(
    { url: "http://127.0.0.1:3011", controlSecret: "control-secret" },
    async () => new Response(null, { status: 404 })
  );

  await client.stop("call_123456");
});
