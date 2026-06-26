import assert from "node:assert/strict";
import test from "node:test";

import {
  mayContainRevenueTwinVoiceSelection,
  resolveRevenueTwinVoiceSelection
} from "./voice-selection.js";

const offers = [
  { offerId: "rtw_offer_first", scheduledAt: "2026-06-28T00:30:00.000Z" },
  { offerId: "rtw_offer_second", scheduledAt: "2026-06-28T01:00:00.000Z" }
];

test("maps a final-customer ordinal selection to its stored offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Chot chuyen dau tien.", offers), {
    kind: "ACCEPT",
    offerId: "rtw_offer_first"
  });
});

test("maps a final-customer departure time to its stored offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Di chuyen 8 gio.", offers), {
    kind: "ACCEPT",
    offerId: "rtw_offer_second"
  });
});

test("does not classify a normal booking sentence with a time as a Revenue Twin selection", () => {
  assert.equal(
    mayContainRevenueTwinVoiceSelection(
      "Muon dat xe tu Da Nang di Nha Trang ngay 28 thang 6, 7 gio sang cho 3 nguoi."
    ),
    false
  );
  assert.equal(mayContainRevenueTwinVoiceSelection("Di chuyen 8 gio."), true);
});

test("accepts an unqualified affirmative only for exactly one offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Duoc.", offers), { kind: "CLARIFY" });
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Duoc.", offers.slice(0, 1)), {
    kind: "ACCEPT",
    offerId: "rtw_offer_first"
  });
});

test("keeps ambiguous or no-preference customer language non-mutating", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Chuyen nao cung duoc.", offers), {
    kind: "CLARIFY"
  });
  assert.deepEqual(resolveRevenueTwinVoiceSelection("De toi suy nghi.", offers), { kind: "NONE" });
});

test("maps an explicit waitlist request without selecting an offer", () => {
  assert.deepEqual(resolveRevenueTwinVoiceSelection("Cho toi vao danh sach cho.", []), {
    kind: "WAITLIST"
  });
});
