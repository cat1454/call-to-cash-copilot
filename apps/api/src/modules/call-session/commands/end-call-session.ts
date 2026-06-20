import { transitionCall, type StateTransitionResult } from "@call-to-cash/domain";
import { CallStatus, EventName } from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { iso, presentEndedCall } from "../call-session.presenter.js";
import type { CallStatusValue, EndCallSessionInput, ServiceData, Transaction } from "../types.js";

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }

  return result.status;
}

export async function endCallSession(
  transactionClient: { $transaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> },
  input: EndCallSessionInput
): Promise<ServiceData> {
  const now = new Date();
  return transactionClient.$transaction(async (transaction) => {
    const call = await transaction.callSession.findUnique({ where: { publicId: input.callId } });
    if (call === null) {
      throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
    }
    const targetStatus =
      call.status === CallStatus.Created ? CallStatus.Cancelled : CallStatus.Ended;
    const endedAt = call.endedAt ?? now;
    const updated =
      call.status === CallStatus.Ended || call.status === CallStatus.Cancelled
        ? call
        : await transaction.callSession.update({
            where: { id: call.id },
            data: {
              status: requireTransition(
                transitionCall(call.status as CallStatusValue, targetStatus),
                "Call state transition is not allowed."
              ),
              endedAt
            }
          });

    await appendEvent(transaction, {
      callId: call.publicId,
      bookingId: null,
      event: EventName.CallEnded,
      data: {
        status: updated.status,
        reason: input.reason,
        endedAt: iso(endedAt)
      },
      requestId: input.requestId,
      occurredAt: now
    });

    return presentEndedCall(updated, endedAt);
  });
}
