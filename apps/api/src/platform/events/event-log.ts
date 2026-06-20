import { randomUUID } from "node:crypto";

import { Prisma } from "@call-to-cash/db";
import { EventEnvelopeSchema, type EventEnvelope } from "@call-to-cash/shared";

type Transaction = Prisma.TransactionClient;

function opaqueEventId(): string {
  return `evt_${randomUUID().replaceAll("-", "")}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

function eventActionName(event: string): string {
  return `EVENT_${event.toUpperCase().replaceAll(".", "_")}`;
}

export async function appendEvent(
  transaction: Transaction,
  input: {
    callId: string;
    bookingId?: string | null;
    event: string;
    data: unknown;
    requestId: string;
    occurredAt: Date;
  }
): Promise<EventEnvelope> {
  await transaction.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${input.callId}))
  `);
  const existingEvents = await transaction.auditLog.count({
    where: {
      aggregateType: "CALL_STREAM",
      aggregateId: input.callId,
      eventId: { not: null }
    }
  });
  const envelope = EventEnvelopeSchema.parse({
    eventId: opaqueEventId(),
    event: input.event,
    version: 1,
    occurredAt: iso(input.occurredAt),
    correlationId: input.requestId,
    callId: input.callId,
    bookingId: input.bookingId ?? null,
    sequence: existingEvents + 1,
    data: input.data
  });

  await transaction.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: eventActionName(input.event),
      aggregateType: "CALL_STREAM",
      aggregateId: input.callId,
      requestId: input.requestId,
      eventId: envelope.eventId,
      afterState: envelope as Prisma.InputJsonValue,
      metadata: { event: input.event },
      createdAt: input.occurredAt
    }
  });

  return envelope;
}
