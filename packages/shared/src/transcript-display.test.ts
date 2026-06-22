import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTranscriptFrame,
  joinTranscriptFragments,
  normalizeTranscriptDisplayText
} from "./transcript-display.js";

test("joins delta fragments with a safe Vietnamese word boundary", () => {
  assert.equal(joinTranscriptFragments("Dạ, em muốn", "đặt ba chỗ."), "Dạ, em muốn đặt ba chỗ.");
});

test("replaces snapshot interim text instead of appending duplicate snapshots", () => {
  const first = applyTranscriptFrame([], {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 1,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Dạ, em muốn"
  });
  const second = applyTranscriptFrame(first.turns, {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 2,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Dạ, em muốn đặt ba chỗ"
  });

  assert.equal(second.turns.length, 1);
  assert.equal(second.turns[0]?.displayText, "Dạ, em muốn đặt ba chỗ");
});

test("normalizes repeated whitespace and punctuation spacing without rewriting meaning", () => {
  assert.equal(normalizeTranscriptDisplayText("Dạ,   em muốn   đặt"), "Dạ, em muốn đặt");
  assert.equal(
    normalizeTranscriptDisplayText("Dạ, em muốn , đặt ba chỗ ."),
    "Dạ, em muốn, đặt ba chỗ."
  );
});

test("deduplicates repeated final frames and ignores later interim frames for a finalized turn", () => {
  const final = applyTranscriptFrame([], {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 3,
    delivery: "SNAPSHOT",
    final: true,
    rawText: "Dạ, em muốn đặt ba chỗ."
  });
  const duplicate = applyTranscriptFrame(final.turns, {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 3,
    delivery: "SNAPSHOT",
    final: true,
    rawText: "Dạ, em muốn đặt ba chỗ."
  });
  const lateInterim = applyTranscriptFrame(final.turns, {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 4,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Dạ, em muốn"
  });

  assert.equal(final.finalized, true);
  assert.equal(duplicate.duplicateFinal, true);
  assert.equal(duplicate.turns.length, 1);
  assert.equal(lateInterim.changed, false);
  assert.equal(lateInterim.turns[0]?.displayText, "Dạ, em muốn đặt ba chỗ.");
});

test("ignores stale sequence frames", () => {
  const current = applyTranscriptFrame([], {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 5,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Dạ, em muốn đặt ba chỗ"
  });
  const stale = applyTranscriptFrame(current.turns, {
    providerTurnId: "turn-1",
    speaker: "CUSTOMER",
    sequence: 4,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Dạ, em muốn"
  });

  assert.equal(stale.stale, true);
  assert.equal(stale.turns[0]?.displayText, "Dạ, em muốn đặt ba chỗ");
});

test("does not merge different provider turn ids or speakers", () => {
  const first = applyTranscriptFrame([], {
    providerTurnId: "customer-turn",
    speaker: "CUSTOMER",
    sequence: 1,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Em muốn đặt vé"
  });
  const second = applyTranscriptFrame(first.turns, {
    providerTurnId: "agent-turn",
    speaker: "AGENT",
    sequence: 2,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Mình ghi nhận."
  });
  const third = applyTranscriptFrame(second.turns, {
    providerTurnId: "another-customer-turn",
    speaker: "CUSTOMER",
    sequence: 3,
    delivery: "SNAPSHOT",
    final: false,
    rawText: "Từ Đà Nẵng ra Hà Nội"
  });

  assert.deepEqual(
    third.turns.map((turn) => `${turn.speaker}:${turn.displayText}`),
    ["CUSTOMER:Em muốn đặt vé", "AGENT:Mình ghi nhận.", "CUSTOMER:Từ Đà Nẵng ra Hà Nội"]
  );
});

test("preserves sensitive formats such as time, money and masked phone text", () => {
  assert.equal(
    normalizeTranscriptDisplayText("Lúc 19 : 00, cọc 300 . 000 đ, số 0912 345 678."),
    "Lúc 19:00, cọc 300.000 đ, số 0912 345 678."
  );
});

test("does not split email addresses or URLs while normalizing display text", () => {
  assert.equal(normalizeTranscriptDisplayText("person@example.com"), "person@example.com");
  assert.equal(
    normalizeTranscriptDisplayText("Mở https://example.com/path lúc 19 : 00"),
    "Mở https://example.com/path lúc 19:00"
  );
});
