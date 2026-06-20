import { randomUUID } from "node:crypto";

import { CallStatus, EventName } from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { presentCreatedCall } from "../call-session.presenter.js";
import type { CreateCallSessionInput, ServiceData, Transaction } from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export async function createCallSession(
  transactionClient: { $transaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> },
  input: CreateCallSessionInput
): Promise<ServiceData> {
  const now = new Date();
  const publicId = opaqueId("call");
  const channelName = `ctc_${publicId}`;

  return transactionClient.$transaction(async (transaction) => {
    const customer =
      input.customerId === undefined
        ? null
        : await transaction.user.findUnique({ where: { publicId: input.customerId } });
    const operator =
      input.operatorId === undefined
        ? null
        : await transaction.user.findUnique({ where: { publicId: input.operatorId } });
    const call = await transaction.callSession.create({
      data: {
        publicId,
        customerId: customer?.id ?? null,
        operatorId: operator?.id ?? null,
        status: "CREATED",
        channelName,
        purpose: "BOOKING",
        sourceMode: input.sourceMode,
        analysisEnabled: true,
        createdAt: now
      }
    });

    await transaction.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "CALL_CREATED",
        aggregateType: "CALL",
        aggregateId: publicId,
        requestId: input.requestId,
        afterState: { status: "CREATED", sourceMode: input.sourceMode },
        createdAt: now
      }
    });
    await appendEvent(transaction, {
      callId: call.publicId,
      event: EventName.CallCreated,
      data: {
        status: CallStatus.Created,
        channelName: call.channelName,
        sourceMode: call.sourceMode
      },
      requestId: input.requestId,
      occurredAt: now
    });

    return presentCreatedCall(call);
  });
}
