import type { FastifyInstance } from "fastify";
import {
  ApiErrorEnvelopeSchema,
  ErrorCodeSchema
} from "@call-to-cash/shared";

import { registerCallSessionRoutes } from "../modules/call-session/call-session.routes.js";
import { registerCallEventRoutes } from "../modules/call-events/call-events.routes.js";
import { registerBookingRoutes } from "../modules/booking/booking.routes.js";
import { registerHealthRoutes } from "../modules/health/health.routes.js";
import { registerPaymentRoutes } from "../modules/payment/payment.routes.js";
import { registerReceiptRoutes } from "../modules/receipt/receipt.routes.js";
import { ApiCommandError } from "../platform/http/api-command-error.js";
import { errorEnvelope } from "../platform/http/api-response.js";
import type { ApiDependencies } from "./types.js";

export function registerRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  registerHealthRoutes(app, dependencies);
  registerCallSessionRoutes(app, dependencies);
  registerCallEventRoutes(app, dependencies);
  registerBookingRoutes(app, dependencies);
  registerPaymentRoutes(app, dependencies);
  registerReceiptRoutes(app, dependencies);

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
    if (error instanceof ApiCommandError) {
      return reply
        .code(error.statusCode)
        .send(errorEnvelope(request.id, error.code, error.message, error.retryable, error.details));
    }

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
}
