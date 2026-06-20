import Fastify, { type FastifyInstance } from "fastify";

import { readRuntimeConfig, type RuntimeConfig } from "@call-to-cash/config";
import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  ErrorCodeSchema
} from "@call-to-cash/shared";

function successEnvelope<T>(requestId: string, data: T) {
  return ApiSuccessEnvelopeSchema.parse({
    success: true as const,
    data,
    meta: { requestId }
  });
}

export function buildApp(config: RuntimeConfig = readRuntimeConfig()): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async (request) =>
    successEnvelope(request.id, {
      status: "ok",
      service: "api"
    })
  );

  app.get("/ready", async (request) =>
    successEnvelope(request.id, {
      status: "ready",
      mode: config.demoMode ? "demo" : "live",
      providers: {
        payment: config.paymentProvider,
        voice: config.voiceProvider,
        ai: config.aiProvider
      }
    })
  );

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(
      ApiErrorEnvelopeSchema.parse({
        success: false,
        error: {
          code: ErrorCodeSchema.enum.RESOURCE_NOT_FOUND,
          message: "The requested resource was not found.",
          requestId: request.id,
          retryable: false
        }
      })
    )
  );

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send(
      ApiErrorEnvelopeSchema.parse({
        success: false,
        error: {
          code: ErrorCodeSchema.enum.INTERNAL_ERROR,
          message: "An unexpected error occurred.",
          requestId: request.id,
          retryable: false
        }
      })
    );
  });

  return app;
}
