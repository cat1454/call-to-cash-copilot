import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";
import { AgoraLiveTranscriptRelayClient } from "./modules/voice-session/live-transcript-relay-client.js";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRuntimeConfig();

async function run() {
  const client = new AgoraLiveTranscriptRelayClient(config.agora.liveRelay);
  try {
    await client.start({
      callId: "test-call",
      channelName: "test-channel",
      sessionId: "test-session",
      agentUid: 9001,
      token: "fake-token"
    });
    console.log("Relay started successfully");
  } catch (err) {
    console.log("Relay start failed", err);
  }
}
run().catch(console.error);
