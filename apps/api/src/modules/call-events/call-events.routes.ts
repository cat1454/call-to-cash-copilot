import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { CallIdSchema } from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { ssePayload } from "../../platform/events/sse-writer.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { createCallEventHandlers } from "./call-events.handlers.js";

const CallParamsSchema = z.object({ callId: CallIdSchema }).strict();
const EventStreamQuerySchema = z
  .object({
    snapshot: z.literal("true").optional()
  })
  .strict();

export function registerCallEventRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  const handlers = createCallEventHandlers(dependencies.databaseClient);

  app.get("/v1/calls/:callId/events", async (request, reply) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const query = parseWithSchema(EventStreamQuerySchema, request.query);
    const lastEventId = request.headers["last-event-id"];
    const cursor = typeof lastEventId === "string" ? lastEventId : undefined;

    if (query.snapshot === "true") {
      const events = await handlers.snapshot(params.callId, cursor);
      reply.header("Cache-Control", "no-cache");
      return reply.type("text/event-stream").send(ssePayload(events));
    }

    return handlers.subscribe(reply, params.callId, cursor);
  });
}
