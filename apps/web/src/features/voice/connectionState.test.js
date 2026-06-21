import assert from "node:assert/strict";
import test from "node:test";
import {
  VoiceConnectionState,
  connectionReducer,
  getVoiceConnectionPresentation
} from "./connectionState.js";
test("voice connection accurately moves from permission to reconnect", () => {
  let state = connectionReducer(VoiceConnectionState.IDLE, { type: "REQUEST_PERMISSION" });
  state = connectionReducer(state, { type: "CREATE_SESSION" });
  state = connectionReducer(state, { type: "CONNECT" });
  state = connectionReducer(state, { type: "CONNECTED" });
  assert.equal(connectionReducer(state, { type: "RECONNECT" }), VoiceConnectionState.RECONNECTING);
});

test("voice failures explain recovery and preserved state in Vietnamese", () => {
  const presentation = getVoiceConnectionPresentation(VoiceConnectionState.PERMISSION_DENIED);
  assert.equal(presentation.failed, true);
  assert.match(presentation.action, /thử lại|bản phát lại/u);
  assert.match(presentation.safety, /không.*mất|chưa.*bị mất/iu);
});

test("missing microphone has a distinct recoverable state", () => {
  assert.equal(
    connectionReducer(VoiceConnectionState.REQUESTING_PERMISSION, {
      type: "MICROPHONE_UNAVAILABLE"
    }),
    VoiceConnectionState.MICROPHONE_UNAVAILABLE
  );
});
