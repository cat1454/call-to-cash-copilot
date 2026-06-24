import assert from "node:assert/strict";
import test from "node:test";

import { getReplayDelayMs } from "./replayPacing.js";

test("replay pacing keeps the opening beat but advances promptly after server-confirmed turns", () => {
  assert.equal(getReplayDelayMs({ turnIndex: 0, speaker: "customer" }), 700);
  assert.equal(getReplayDelayMs({ turnIndex: 1, speaker: "agent" }), 1_100);
  assert.equal(getReplayDelayMs({ turnIndex: 2, speaker: "customer" }), 650);
});
