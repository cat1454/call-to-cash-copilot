import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  CallIdSchema,
  CreateCallRequestSchema,
  CreateTranscriptTurnRequestSchema
} from "@call-to-cash/shared";

import { successEnvelope } from "../../platform/http/api-response.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import type { ApiDependencies } from "../../bootstrap/types.js";
import { createCallSessionHandlers } from "./call-session.handlers.js";

export function registerCallSessionRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies
): void {
  const handlers = createCallSessionHandlers(dependencies.databaseClient);
  const CallParamsSchema = z.object({ callId: CallIdSchema }).strict();

  app.post("/v1/calls", async (request, reply) => {
    const body = parseWithSchema(CreateCallRequestSchema, request.body);
    const data = await handlers.createCall({
      sourceMode: body.sourceMode,
      ...(body.customerId === undefined ? {} : { customerId: body.customerId }),
      ...(body.operatorId === undefined ? {} : { operatorId: body.operatorId }),
      requestId: request.id
    });

    return reply.code(201).send(successEnvelope(request.id, data));
  });

  app.get("/v1/calls/:callId", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.getCall(params.callId));
  });

  app.post("/v1/calls/:callId/end", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const body = parseWithSchema(
      z.object({ reason: z.enum(["CUSTOMER_ENDED", "OPERATOR_ENDED", "SYSTEM_ENDED"]) }).strict(),
      request.body
    );

    return successEnvelope(
      request.id,
      await handlers.endCall(params.callId, body.reason, request.id)
    );
  });

  app.post("/v1/calls/:callId/transcript-turns", async (request, reply) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const body = parseWithSchema(CreateTranscriptTurnRequestSchema, request.body);
    const data = await handlers.appendTurn({
      callId: params.callId,
      turn: body.turn,
      requestId: request.id
    });

    return reply.code(202).send(successEnvelope(request.id, data));
  });

  app.get("/v1/calls/:callId/transcript", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.getTranscript(params.callId));
  });

  app.get("/v1/calls/:callId/risk", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.getRisk(params.callId));
  });
}
