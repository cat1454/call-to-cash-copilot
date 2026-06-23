import assert from "node:assert/strict";
import test from "node:test";

import { resolveRevenueTwinVoiceSelection } from "./voice-selection.js";

const offers = [
  { offerId: "rtw_offer_first", scheduledAt: "2030-06-20T07:30:00.000Z" },
  { offerId: "rtw_offer_second", scheduledAt: "2030-06-20T08:00:00.000Z" }
];

test("maps a final-customer ordinal selection to its stored offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Chốt chuyến đầu tiên.", offers), {
    kind: "ACCEPT",
    offerId: "rtw_offer_first"
  });
});

test("maps a final-customer departure time to its stored offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Đi chuyến 8 giờ.", offers), {
    kind: "ACCEPT",
    offerId: "rtw_offer_second"
  });
});

test("accepts an unqualified affirmative only for exactly one offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Được.", offers), { kind: "CLARIFY" });
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Được.", offers.slice(0, 1)), {
    kind: "ACCEPT",
    offerId: "rtw_offer_first"
  });
});

test("keeps ambiguous or no-preference customer language non-mutating", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Chuyến nào cũng được.", offers), {
    kind: "CLARIFY"
  });
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Để tôi suy nghĩ.", offers), { kind: "NONE" });
});
