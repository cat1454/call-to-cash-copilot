import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { presentRisk } from "../call-session.presenter.js";
import type { ServiceData } from "../types.js";

export async function getCallRisk(client: DatabaseClient, callId: string): Promise<ServiceData> {
  const risk = await client.riskAssessment.findFirst({
    where: { callSession: { publicId: callId } },
    orderBy: { createdAt: "desc" },
    include: { booking: true, callSession: true }
  });
  if (risk === null) {
    throw new ApiCommandError(
      409,
      "RISK_ASSESSMENT_NOT_READY",
      "Risk assessment is not ready.",
      undefined,
      true
    );
  }

  return presentRisk(risk, callId);
}
