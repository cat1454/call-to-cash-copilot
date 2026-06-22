import type { AgoraSessionMetadata } from "@call-to-cash/agora";

export type VoiceSessionRuntime = {
  status: "READY" | "STARTING" | "CONNECTED" | "STOPPING" | "ENDED" | "FAILED";
  customerUid?: number;
  agentId?: string;
  agentRequestName?: string;
  relayActive?: true;
  rtc?: AgoraSessionMetadata;
};
