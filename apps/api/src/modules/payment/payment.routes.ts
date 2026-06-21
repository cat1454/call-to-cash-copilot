import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  BookingIdSchema,
  CreateMockPaymentIntentRequestSchema,
  PaymentIntentIdSchema,
  SimulatePaymentFailureRequestSchema,
  VerifyMockPaymentRequestSchema,
  VerifySolanaPaymentRequestSchema
} from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { errorEnvelope, successEnvelope } from "../../platform/http/api-response.js";
import { requireIdempotencyKey } from "../../platform/http/idempotency.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { createPaymentHandlers } from "./payment.handlers.js";

export function registerPaymentRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  const handlers = createPaymentHandlers(
    dependencies.databaseClient,
    dependencies.paymentProvider,
    dependencies.mockPaymentProvider
  );
  const PaymentParamsSchema = z.object({ bookingId: BookingIdSchema }).strict();

  app.post("/v1/payments/create", async (request, reply) => {
    const body = parseWithSchema(CreateMockPaymentIntentRequestSchema, request.body);
    const result = await handlers.createConfigured(
      body.bookingId,
      requireIdempotencyKey(request.headers),
      request.id
    );
    return reply.code(result.statusCode).send(successEnvelope(request.id, result.data));
  });

  app.post("/v1/payments/verify", async (request) => {
    const schema =
      dependencies.paymentProvider?.name === "solana_devnet"
        ? VerifySolanaPaymentRequestSchema
        : VerifyMockPaymentRequestSchema;
    const body = parseWithSchema(schema, request.body);
    return successEnvelope(
      request.id,
      await handlers.verifyConfigured(body, requireIdempotencyKey(request.headers), request.id)
    );
  });

  app.post("/v1/payments/mock/create", async (request, reply) => {
    const body = parseWithSchema(CreateMockPaymentIntentRequestSchema, request.body);
    const result = await handlers.createMock(
      body.bookingId,
      requireIdempotencyKey(request.headers),
      request.id
    );
    return reply.code(result.statusCode).send(successEnvelope(request.id, result.data));
  });

  app.post("/v1/payments/mock/verify", async (request) => {
    const body = parseWithSchema(VerifyMockPaymentRequestSchema, request.body);
    PaymentIntentIdSchema.parse(body.paymentIntentId);
    return successEnvelope(
      request.id,
      await handlers.verifyMock(body, requireIdempotencyKey(request.headers), request.id)
    );
  });

  app.post("/v1/payments/mock/simulate-failure", async (request, reply) => {
    if (!dependencies.config.demoMode) {
      return reply
        .code(403)
        .send(
          errorEnvelope(
            request.id,
            "AUTH_FORBIDDEN",
            "Endpoint available in demo mode only.",
            false
          )
        );
    }
    const body = parseWithSchema(SimulatePaymentFailureRequestSchema, request.body);
    return successEnvelope(request.id, await handlers.simulate(body, request.id));
  });

  app.get("/v1/payments/:bookingId/status", async (request) => {
    const params = parseWithSchema(PaymentParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.status(params.bookingId));
  });
}
