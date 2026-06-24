import assert from "node:assert/strict";
import test from "node:test";

import { getDemoReadinessMessage, isDemoReadyPayload } from "./useApiMode.js";

test("authoritative demo requires a ready API response instead of silently falling back to local fixtures", () => {
  assert.equal(isDemoReadyPayload({ status: "ready" }), true);
  assert.equal(isDemoReadyPayload({ status: "ok" }), false);
  assert.equal(isDemoReadyPayload(null), false);
  assert.match(getDemoReadinessMessage("unreachable"), /không thể kết nối API/iu);
});
