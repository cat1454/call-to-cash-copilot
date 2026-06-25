import { config as loadEnv } from "dotenv";
import { readRelayConfig } from "../../rtm-relay/src/config.js";
import { readRuntimeConfig } from "@call-to-cash/config";
import { AgoraRtmBrowserRelay } from "../../rtm-relay/src/rtm-browser-relay.js";
import { issueRtcAndRtmToken } from "@call-to-cash/agora";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const relayConfig = readRelayConfig();
const config = readRuntimeConfig();

async function run() {
  const token = issueRtcAndRtmToken(config.agora, {
    channelName: "test-channel",
    uid: config.agora.liveRelay.uid
  });

  const relay = new AgoraRtmBrowserRelay(relayConfig);
  try {
    await relay.start({
      callId: "call_test_12345",
      channelName: "test-channel",
      sessionId: "test-session",
      agentUid: 9001,
      token
    });
    console.log("Relay logic started successfully with REAL token!");
  } catch (err) {
    console.log("Relay logic failed with REAL token:", err);
  } finally {
    await relay.close();
  }
}

run().catch(console.error);
