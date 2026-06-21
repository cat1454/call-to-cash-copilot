import assert from "node:assert/strict";
import test from "node:test";

import { getVoiceModeLabel, parseDemoMode } from "./runtime.js";

test("demo mode is explicit and defaults on for the current simulation", () => {
  assert.equal(parseDemoMode(undefined), true);
  assert.equal(parseDemoMode("true"), true);
  assert.equal(parseDemoMode("false"), false);
});

test("voice mode labels cannot make replay look like live Agora", () => {
  assert.equal(getVoiceModeLabel("agora"), "Agora Live");
  assert.match(getVoiceModeLabel("replay"), /Replay Demo.*không phải thoại trực tiếp/u);
});
