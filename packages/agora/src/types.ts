export type AgoraTokenConfig = {
  appId: string;
  appCertificate: string;
  tokenTtlSeconds: number;
};

export type AgoraConversationAgentConfig = {
  appId: string;
  customerId: string;
  customerSecret: string;
  baseUrl: string;
  properties: Record<string, unknown>;
};

export type AgoraSessionMetadata = {
  appId: string;
  channelName: string;
  uid: number;
  token: string;
  expiresAt: string;
};

export type AgoraAgentSession = { agentId: string; name: string };

export type NormalizedTranscriptTurn = {
  providerTurnId: string;
  sequenceNo: number;
  speaker: "CUSTOMER" | "AGENT" | "OPERATOR" | "SYSTEM";
  content: string;
  language: string;
  isFinal: boolean;
  startedAt?: string;
  endedAt?: string;
  sttConfidence?: number;
};
