import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { presentCall } from "../call-session.presenter.js";
import type { ServiceData } from "../types.js";

export async function getCallSession(client: DatabaseClient, callId: string): Promise<ServiceData> {
  const call = await client.callSession.findUnique({
    where: { publicId: callId },
    include: { booking: true }
  });
  if (call === null) {
    throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
  }

  return presentCall(call);
}
