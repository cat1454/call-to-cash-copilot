import "dotenv/config";
import { AgoraConversationAgentClient } from "./packages/agora/src/conversation-agent-client.ts";

const client = new AgoraConversationAgentClient({
  appId: process.env.AGORA_APP_ID!,
  customerId: process.env.AGORA_CUSTOMER_ID!,
  customerSecret: process.env.AGORA_CUSTOMER_SECRET!,
  baseUrl: process.env.AGORA_API_BASE_URL!,
  properties: JSON.parse(process.env.AGORA_CAI_PROPERTIES_JSON!)
});

client.start({
  channelName: "test_channel",
  agentToken: "test_token",
  agentUid: 9001,
  customerUid: 12345,
  name: "test_call",
  callId: "test_call"
}).then(console.log).catch(err => {
  console.error("ERROR", err);
  console.error(JSON.stringify(err, null, 2));
  process.exit(1);
});
