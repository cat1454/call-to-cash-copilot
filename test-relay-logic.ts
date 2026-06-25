import { config as loadEnv } from "dotenv";
import { readRelayConfig } from "./apps/rtm-relay/src/config.js";
import { AgoraRtmBrowserRelay } from "./apps/rtm-relay/src/rtm-browser-relay.js";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRelayConfig();

async function run() {
  const relay = new AgoraRtmBrowserRelay(config);
  try {
    await relay.start({
      callId: "call_test_12345",
      channelName: "test-channel",
      sessionId: "test-session",
      agentUid: 9001,
      token: "fake-token"
    });
    console.log("Relay logic started successfully");
  } catch (err) {
    console.log("Relay logic failed:", err);
  } finally {
    await relay.close();
  }
}
run().catch(console.error);
