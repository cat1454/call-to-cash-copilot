import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";

// Force load the exact root .env
loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRuntimeConfig();

async function run() {
  const auth = `Basic ${Buffer.from(`${config.agora.customerId}:${config.agora.customerSecret}`).toString("base64")}`;
  const res = await fetch(`https://api.agora.io/api/conversational-ai-agent/v2/projects/${config.agora.appId}/join`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'test-agent',
      pipeline_id: config.agora.agentProperties.pipeline_id,
      properties: {
        channel: 'test-channel',
        token: 'fake-token',
        agent_rtc_uid: '9001',
        agent_rtm_uid: '9001',
        remote_rtc_uids: ['12345'],
        advanced_features: { enable_rtm: true },
        parameters: { data_channel: 'rtm' }
      },
      labels: { call_id: 'test', schema_version: 'ctc-v1' }
    })
  });
  console.log("Status:", res.status);
  console.log(await res.text());
}
run().catch(console.error);
