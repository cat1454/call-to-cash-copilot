import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  ApiErrorEnvelopeSchema,
  BookingIdSchema,
  CallIdSchema,
  ConfirmBookingRequestSchema,
  CreateMockPaymentIntentRequestSchema,
  ErrorCodeSchema,
  PaymentIntentIdSchema,
  ReceiptIdSchema,
  SimulatePaymentFailureRequestSchema,
  VerifyMockPaymentRequestSchema
} from "@call-to-cash/shared";

import { registerCallSessionRoutes } from "../modules/call-session/call-session.routes.js";
import { registerHealthRoutes } from "../modules/health/health.routes.js";
import { ssePayload } from "../platform/events/sse-writer.js";
import { ApiCommandError } from "../platform/http/api-command-error.js";
import { errorEnvelope, successEnvelope } from "../platform/http/api-response.js";
import { requireIdempotencyKey } from "../platform/http/idempotency.js";
import { parseWithSchema } from "../platform/http/validation.js";
import type { ApiDependencies } from "./types.js";

export function registerRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  const { config, phase5Service } = dependencies;
  registerHealthRoutes(app, dependencies);
  registerCallSessionRoutes(app, dependencies);

  const getService = () => {
    if (phase5Service === undefined) {
      throw new ApiCommandError(
        503,
        "DATABASE_UNAVAILABLE",
        "Database is not configured.",
        undefined,
        true
      );
    }

    return phase5Service;
  };

  const CallParamsSchema = z.object({ callId: CallIdSchema }).strict();
  const BookingParamsSchema = z.object({ bookingId: BookingIdSchema }).strict();
  const PaymentParamsSchema = z.object({ bookingId: BookingIdSchema }).strict();
  const ReceiptParamsSchema = z.object({ receiptId: ReceiptIdSchema }).strict();
  const ReceiptVerifyQuerySchema = z
    .object({
      candidateDepositAmountMinor: z.coerce.number().int().positive().optional()
    })
    .strict();
  const EventStreamQuerySchema = z
    .object({
      snapshot: z.literal("true").optional()
    })
    .strict();

  app.get("/v1/calls/:callId/events", async (request, reply) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const query = parseWithSchema(EventStreamQuerySchema, request.query);
    const lastEventId = request.headers["last-event-id"];
    const cursor = typeof lastEventId === "string" ? lastEventId : undefined;
    const events = await getService().getEvents(params.callId, cursor);

    if (query.snapshot === "true") {
      reply.header("Cache-Control", "no-cache");
      return reply.type("text/event-stream").send(ssePayload(events));
    }

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
        const nextEvents = await getService().getEvents(params.callId, lastSentEventId);
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
  });

  app.get("/v1/bookings/:bookingId", async (request) => {
    const params = parseWithSchema(BookingParamsSchema, request.params);
    return successEnvelope(request.id, await getService().getBooking(params.bookingId));
  });

  app.post("/v1/bookings/:bookingId/confirm", async (request) => {
    const params = parseWithSchema(BookingParamsSchema, request.params);
    const body = parseWithSchema(ConfirmBookingRequestSchema, request.body);
    const idempotencyKey = requireIdempotencyKey(request.headers);

    return successEnvelope(
      request.id,
      await getService().confirmBooking(params.bookingId, body, idempotencyKey, request.id)
    );
  });

  app.post("/v1/payments/mock/create", async (request, reply) => {
    const body = parseWithSchema(CreateMockPaymentIntentRequestSchema, request.body);
    const result = await getService().createMockPaymentIntent(
      body.bookingId,
      requireIdempotencyKey(request.headers),
      request.id
    );

    return reply.code(result.statusCode).send(successEnvelope(request.id, result.data));
  });

  app.post("/v1/payments/mock/verify", async (request) => {
    const body = parseWithSchema(VerifyMockPaymentRequestSchema, request.body);
    PaymentIntentIdSchema.parse(body.paymentIntentId);
    const idempotencyKey = requireIdempotencyKey(request.headers);

    return successEnvelope(
      request.id,
      await getService().verifyMockPayment(body, idempotencyKey, request.id)
    );
  });

  // Phase 7: simulate failure endpoint — DEMO_MODE only.
  app.post("/v1/payments/mock/simulate-failure", async (request, reply) => {
    if (!config.demoMode) {
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
    return successEnvelope(request.id, await getService().simulatePaymentFailure(body, request.id));
  });

  app.get("/v1/payments/:bookingId/status", async (request) => {
    const params = parseWithSchema(PaymentParamsSchema, request.params);
    return successEnvelope(request.id, await getService().getPaymentStatus(params.bookingId));
  });

  app.get("/v1/receipts/:receiptId", async (request) => {
    const params = parseWithSchema(ReceiptParamsSchema, request.params);
    return successEnvelope(request.id, await getService().getReceipt(params.receiptId));
  });

  app.get("/v1/receipts/:receiptId/verify", async (request) => {
    const params = parseWithSchema(ReceiptParamsSchema, request.params);
    const query = parseWithSchema(ReceiptVerifyQuerySchema, request.query);
    if (query.candidateDepositAmountMinor !== undefined && !config.demoMode) {
      throw new ApiCommandError(
        403,
        "AUTH_FORBIDDEN",
        "Candidate agreement verification is available only in demo mode."
      );
    }
    return successEnvelope(
      request.id,
      await getService().verifyReceipt(params.receiptId, query, request.id)
    );
  });

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
