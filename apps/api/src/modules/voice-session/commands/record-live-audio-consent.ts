import { Prisma } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";

export async function recordLiveAudioConsent(
  client: import("@call-to-cash/db").DatabaseClient,
  input: {
    callId: string;
    status: "GRANTED" | "REVOKED" | "DECLINED";
    policyVersion: string;
    requestId: string;
  }
): Promise<{ callId: string; status: "GRANTED" | "REVOKED" | "DECLINED" }> {
  return client.$transaction(
    async (transaction) => {
      const call = await transaction.callSession.findUnique({ where: { publicId: input.callId } });
      if (call === null)
        throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
      await transaction.consentRecord.create({
        data: {
          callSessionId: call.id,
          userId: call.customerId,
          consentType: "ANALYSIS",
          status: input.status,
          policyVersion: input.policyVersion,
          capturedVia: "WEB_MODAL"
        }
      });
      await transaction.callSession.update({
        where: { id: call.id },
        data: { analysisEnabled: input.status === "GRANTED" }
      });
      await transaction.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: `LIVE_AUDIO_CONSENT_${input.status}`,
          aggregateType: "CALL",
          aggregateId: call.publicId,
          requestId: input.requestId,
          metadata: { consentType: "ANALYSIS", policyVersion: input.policyVersion }
        }
      });
      return { callId: call.publicId, status: input.status };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
