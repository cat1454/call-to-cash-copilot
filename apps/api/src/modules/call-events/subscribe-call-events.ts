import type { DatabaseClient } from "@call-to-cash/db";
import type { FastifyReply } from "fastify";

import { ssePayload } from "../../platform/events/sse-writer.js";
import { readCommittedCallEvents } from "./call-stream-reader.js";
import type { CallEventCursor } from "./types.js";

export async function subscribeCallEvents(
  reply: FastifyReply,
  client: DatabaseClient,
  callId: string,
  cursor?: CallEventCursor
): Promise<FastifyReply> {
  const events = await readCommittedCallEvents(client, callId, cursor);
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  reply.raw.write(ssePayload(events));

  let lastSentEventId = events.at(-1)?.eventId ?? cursor;
  let polling = false;
  const poll = async () => {
    if (polling || reply.raw.destroyed) {
      return;
    }
    polling = true;
    try {
      const nextEvents = await readCommittedCallEvents(client, callId, lastSentEventId);
      if (nextEvents.length > 0) {
        reply.raw.write(ssePayload(nextEvents));
        lastSentEventId = nextEvents.at(-1)?.eventId;
      }
    } finally {
      polling = false;
    }
  };
  const pollTimer = setInterval(() => {
    void poll();
  }, 100);
  const heartbeatTimer = setInterval(() => {
    if (!reply.raw.destroyed) {
      reply.raw.write(": heartbeat\n\n");
    }
  }, 15_000);
  reply.raw.once("close", () => {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  });

  return reply;
}
