import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";
import { createHmac } from "crypto";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRuntimeConfig();

const payload = {
  callId: "call_test_12345",
  channelName: "test-channel",
  sessionId: "test-session",
  agentUid: 9001,
  token: "fake-token"
};

const signature = `sha256=${createHmac("sha256", config.agora.liveRelay.controlSecret).update(JSON.stringify(payload)).digest("hex")}`;

fetch("http://127.0.0.1:3011/v1/relay/sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ctc-relay-signature": signature
  },
  body: JSON.stringify(payload)
}).then(r => r.text().then(t => console.log(r.status, t)));
