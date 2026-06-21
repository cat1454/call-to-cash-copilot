import assert from "node:assert/strict";
import test from "node:test";
import { VoiceConnectionState, connectionReducer } from "./connectionState.js";
test("voice connection accurately moves from permission to reconnect", () => {
  let state = connectionReducer(VoiceConnectionState.IDLE, { type: "REQUEST_PERMISSION" });
  state = connectionReducer(state, { type: "CREATE_SESSION" });
  state = connectionReducer(state, { type: "CONNECT" });
  state = connectionReducer(state, { type: "CONNECTED" });
  assert.equal(connectionReducer(state, { type: "RECONNECT" }), VoiceConnectionState.RECONNECTING);
});
