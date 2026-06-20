import assert from "node:assert/strict";
import test from "node:test";

import { parseDemoMode } from "./runtime.js";

test("demo mode is explicit and defaults on for the current simulation", () => {
  assert.equal(parseDemoMode(undefined), true);
  assert.equal(parseDemoMode("true"), true);
  assert.equal(parseDemoMode("false"), false);
});
