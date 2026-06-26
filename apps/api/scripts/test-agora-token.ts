import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";
import { issueRtcAndRtmToken, withCtcAgoraV1Prompt } from "@call-to-cash/agora";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRuntimeConfig();

async function run() {
  const token = issueRtcAndRtmToken(config.agora, {
    channelName: "test-channel-2",
    uid: config.agora.agentUid
  });

  const auth = `Basic ${Buffer.from(`${config.agora.customerId}:${config.agora.customerSecret}`).toString("base64")}`;

  const { pipeline_id, ...properties } = config.agora.agentProperties;
  const promptProperties = withCtcAgoraV1Prompt(properties, "");

  try {
    const response = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${config.agora.appId}/join`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "test-agent-4",
          pipeline_id,
          properties: {
            ...promptProperties,
            channel: "test-channel-2",
            token,
            agent_rtc_uid: String(config.agora.agentUid),
            agent_rtm_uid: String(config.agora.agentUid),
            remote_rtc_uids: ["12345"],
            advanced_features: { enable_rtm: true },
            parameters: { data_channel: "rtm" }
          },
          labels: { call_id: "test", schema_version: "ctc-v1" }
        })
      }
    );
    console.log("Payload:", JSON.stringify(config.agora.agentProperties));
    console.log("Status:", response.status);
    console.log(await response.text());
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.error);
