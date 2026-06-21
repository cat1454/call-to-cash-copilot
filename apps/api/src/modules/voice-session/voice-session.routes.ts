import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  CallIdSchema,
  CreateVoiceSessionRequestSchema,
  RecordLiveAudioConsentRequestSchema
} from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { successEnvelope } from "../../platform/http/api-response.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { createVoiceSessionHandlers } from "./voice-session.handlers.js";

const CallParamsSchema = z.object({ callId: CallIdSchema }).strict();

export function registerVoiceSessionRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies
): void {
  const handlers = createVoiceSessionHandlers(dependencies.config, dependencies.databaseClient);
  app.post("/v1/voice-sessions", async (request, reply) => {
    const body = parseWithSchema(CreateVoiceSessionRequestSchema, request.body);
    return reply
      .code(201)
      .send(
        successEnvelope(
          request.id,
          await handlers.create({
            policyVersion: body.consent.policyVersion,
            requestId: request.id
          })
        )
      );
  });
  app.get("/v1/voice-sessions/:callId", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.get(params.callId));
  });
  app.post("/v1/voice-sessions/:callId/consent", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const body = parseWithSchema(
      RecordLiveAudioConsentRequestSchema.extend({
        status: z.enum(["GRANTED", "REVOKED", "DECLINED"])
      }).strict(),
      request.body
    );
    return successEnvelope(
      request.id,
      await handlers.recordConsent({ callId: params.callId, ...body, requestId: request.id })
    );
  });
  app.post("/v1/voice-sessions/:callId/start", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(
      request.id,
      await handlers.start({ callId: params.callId, requestId: request.id })
    );
  });
  app.post("/v1/voice-sessions/:callId/stop", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(
      request.id,
      await handlers.stop({ callId: params.callId, requestId: request.id })
    );
  });
  app.post("/v1/voice-sessions/:callId/provider-events", async (request, reply) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const signature = request.headers["x-agora-signature"];
    const data = await handlers.ingestProviderEvent({
      callId: params.callId,
      payload: request.body,
      ...(typeof signature === "string" ? { signature } : {}),
      requestId: request.id
    });
    return reply.code(202).send(successEnvelope(request.id, data));
  });
}
