import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { BookingIdSchema, ConfirmBookingRequestSchema } from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { requireIdempotencyKey } from "../../platform/http/idempotency.js";
import { successEnvelope } from "../../platform/http/api-response.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { createBookingHandlers } from "./booking.handlers.js";

export function registerBookingRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  const handlers = createBookingHandlers(dependencies.databaseClient);
  const ParamsSchema = z.object({ bookingId: BookingIdSchema }).strict();
  app.get("/v1/bookings/:bookingId", async (request) => {
    const { bookingId } = parseWithSchema(ParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.get(bookingId));
  });
  app.post("/v1/bookings/:bookingId/confirm", async (request) => {
    const { bookingId } = parseWithSchema(ParamsSchema, request.params);
    const body = parseWithSchema(ConfirmBookingRequestSchema, request.body);
    return successEnvelope(
      request.id,
      await handlers.confirm(bookingId, body, requireIdempotencyKey(request.headers), request.id)
    );
  });
}
