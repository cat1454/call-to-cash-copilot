import { createRequire } from "node:module";

import { AgoraAdapterError } from "./errors.js";
import type { AgoraSessionMetadata, AgoraTokenConfig } from "./types.js";

const require = createRequire(import.meta.url);
const { RtcRole, RtcTokenBuilder } = require("agora-token") as typeof import("agora-token");

export function issueRtcToken(
  config: AgoraTokenConfig,
  input: { channelName: string; uid: number; now?: Date }
): AgoraSessionMetadata {
  if (!config.appId || !config.appCertificate || !input.channelName) {
    throw new AgoraAdapterError(
      "AGORA_TOKEN_ISSUE_FAILED",
      "Agora voice service is not configured.",
      false
    );
  }
  if (!Number.isInteger(input.uid) || input.uid < 1 || input.uid > 4_294_967_295) {
    throw new AgoraAdapterError("AGORA_TOKEN_ISSUE_FAILED", "Agora user id is invalid.", false);
  }
  const now = input.now ?? new Date();
  const expiresAtEpoch = Math.floor(now.getTime() / 1_000) + config.tokenTtlSeconds;
  try {
    return {
      appId: config.appId,
      channelName: input.channelName,
      uid: input.uid,
      token: RtcTokenBuilder.buildTokenWithUid(
        config.appId,
        config.appCertificate,
        input.channelName,
        input.uid,
        RtcRole.PUBLISHER,
        expiresAtEpoch,
        expiresAtEpoch
      ),
      expiresAt: new Date(expiresAtEpoch * 1_000).toISOString()
    };
  } catch {
    throw new AgoraAdapterError(
      "AGORA_TOKEN_ISSUE_FAILED",
      "Agora session credentials could not be issued.",
      true
    );
  }
}
