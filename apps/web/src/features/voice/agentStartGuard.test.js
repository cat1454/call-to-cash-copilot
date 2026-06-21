import assert from "node:assert/strict";
import test from "node:test";

import { AgentStartBlockedError, createAgentStartGate } from "./agentStartGuard.js";

test("agent start is blocked until RTC and microphone publishing are both ready", async () => {
  const gate = createAgentStartGate();
  await assert.rejects(
    () => gate.start({ rtcConnected: true, microphonePublished: false }, async () => "agent"),
    AgentStartBlockedError
  );
  await assert.rejects(
    () => gate.start({ rtcConnected: false, microphonePublished: true }, async () => "agent"),
    AgentStartBlockedError
  );
});

test("agent start runs once after browser RTC readiness", async () => {
  const gate = createAgentStartGate();
  let calls = 0;
  const startAgent = async () => {
    calls += 1;
    return { agentId: "agent_1" };
  };
  const readiness = { rtcConnected: true, microphonePublished: true, browserRtcUid: 10002 };

  const [first, duplicate] = await Promise.all([
    gate.start(readiness, startAgent),
    gate.start(readiness, startAgent)
  ]);

  assert.deepEqual(first, { agentId: "agent_1" });
  assert.deepEqual(duplicate, { agentId: "agent_1" });
  assert.equal(calls, 1);
});
