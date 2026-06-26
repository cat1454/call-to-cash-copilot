import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  AcceptRevenueTwinOfferCommandSchema,
  CallIdSchema,
  DeclineRevenueTwinOfferCommandSchema,
  RevenueTwinOfferIdSchema
} from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { requireIdempotencyKey } from "../../platform/http/idempotency.js";
import { successEnvelope } from "../../platform/http/api-response.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { createRevenueTwinHandlers } from "./revenue-twin.handlers.js";

export function registerRevenueTwinRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies
): void {
  const handlers = createRevenueTwinHandlers(dependencies.databaseClient);
  const CallParams = z.object({ callId: CallIdSchema }).strict();
  const OfferParams = z
    .object({ callId: CallIdSchema, offerId: RevenueTwinOfferIdSchema })
    .strict();

  app.post("/v1/calls/:callId/revenue-twin/evaluations", async (request, reply) => {
    const { callId } = parseWithSchema(CallParams, request.params);
    return reply
      .code(201)
      .send(successEnvelope(request.id, await handlers.evaluate(callId, request.id)));
  });
  app.get("/v1/revenue-twin/dashboard", async (request) =>
    successEnvelope(request.id, await handlers.dashboard())
  );
  app.get("/v1/calls/:callId/revenue-twin/evaluations/latest", async (request) => {
    const { callId } = parseWithSchema(CallParams, request.params);
    return successEnvelope(request.id, await handlers.latest(callId));
  });
  app.post("/v1/calls/:callId/revenue-twin/offers/:offerId/accept", async (request) => {
    const { callId, offerId } = parseWithSchema(OfferParams, request.params);
    const body = parseWithSchema(AcceptRevenueTwinOfferCommandSchema, request.body);
    if (body.callId !== callId || body.offerId !== offerId) {
      throw new ApiCommandError(
        400,
        "VALIDATION_ERROR",
        "Offer route identifiers must match the acceptance command."
      );
    }
    if (requireIdempotencyKey(request.headers) !== body.idempotencyKey) {
      throw new ApiCommandError(
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must match the acceptance command."
      );
    }
    return successEnvelope(request.id, await handlers.accept(callId, offerId, body, request.id));
  });
  app.post("/v1/calls/:callId/revenue-twin/offers/:offerId/decline", async (request) => {
    const { callId, offerId } = parseWithSchema(OfferParams, request.params);
    const body = parseWithSchema(DeclineRevenueTwinOfferCommandSchema, request.body);
    if (body.callId !== callId || body.offerId !== offerId) {
      throw new ApiCommandError(
        400,
        "VALIDATION_ERROR",
        "Offer route identifiers must match the decline command."
      );
    }
    return successEnvelope(
      request.id,
      await handlers.decline(callId, offerId, body.evaluationId, request.id)
    );
  });
}
