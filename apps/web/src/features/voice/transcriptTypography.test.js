import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("voice transcript bubbles use Vietnamese-safe wrapping typography", () => {
  const source = readFileSync(
    new URL("../simulation/components/VoiceSimulatorPanel.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /whitespace-pre-wrap/u);
  assert.match(source, /break-words/u);
  assert.match(source, /\[word-break:normal\]/u);
  assert.match(source, /tracking-normal/u);
});
