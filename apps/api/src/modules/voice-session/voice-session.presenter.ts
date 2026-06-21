import type { AgoraSessionMetadata } from "@call-to-cash/agora";

import type { VoiceSessionRuntime } from "./types.js";

export function presentVoiceSession(input: {
  callId: string;
  channelName: string;
  analysisConsent: "GRANTED" | "REVOKED" | "DECLINED";
  runtime?: VoiceSessionRuntime | undefined;
  rtc?: AgoraSessionMetadata | undefined;
}) {
  return {
    callId: input.callId,
    status:
      input.rtc === undefined
        ? (input.runtime?.status ??
          (input.analysisConsent === "GRANTED" ? "READY" : "CONSENT_REQUIRED"))
        : "CONNECTED",
    analysisConsent: input.analysisConsent,
    channelName: input.channelName,
    agentStarted: input.runtime?.agentId !== undefined,
    ...(input.rtc === undefined ? {} : { rtc: input.rtc })
  };
}
