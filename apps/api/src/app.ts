import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { z, type ZodType } from "zod";

import { readRuntimeConfig, type RuntimeConfig } from "@call-to-cash/config";
import { createPrismaClientFromEnvironment, Prisma, type DatabaseClient } from "@call-to-cash/db";
import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  BookingIdSchema,
  CallIdSchema,
  ConfirmBookingRequestSchema,
  CreateCallRequestSchema,
  CreateMockPaymentIntentRequestSchema,
  CreateTranscriptTurnRequestSchema,
  ErrorCodeSchema,
  PaymentIntentIdSchema,
  ReceiptIdSchema,
  SimulatePaymentFailureRequestSchema,
  VerifyMockPaymentRequestSchema
} from "@call-to-cash/shared";

import { ApiCommandError, Phase5ReplayService } from "./phase5-service.js";

function successEnvelope<T>(requestId: string, data: T) {
  return ApiSuccessEnvelopeSchema.parse({
    success: true as const,
    data,
    meta: { requestId }
  });
}

type BuildAppOptions = {
  databaseClient?: DatabaseClient;
};

function errorEnvelope(
  requestId: string,
  code: string,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
) {
  return ApiErrorEnvelopeSchema.parse({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId,
      retryable
    }
  });
}

function parseWithSchema<T extends ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiCommandError(400, "VALIDATION_ERROR", "Request validation failed.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  return parsed.data;
}

function requireIdempotencyKey(headers: Record<string, unknown>): string {
  const value = headers["idempotency-key"];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiCommandError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key is required.");
  }

  return value;
}

function ssePayload(events: unknown[]): string {
  return events
    .map((event) => {
      const envelope = event as { event: string; eventId: string };
      return `event: ${envelope.event}\nid: ${envelope.eventId}\ndata: ${JSON.stringify(event)}\n\n`;
    })
    .join("");
}

export function buildApp(
  config: RuntimeConfig = readRuntimeConfig(),
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Redact sensitive headers and fields before they reach log sinks.
      redact: ["req.headers.authorization", "req.headers.cookie"]
    }
  });

  // CORS: allow the Vite dev server and any configured API consumer.
  // In production, restrict origin to the deployed web URL via environment config.
  void app.register(cors, {
    origin:
      config.nodeEnv === "production"
        ? false // tighten in production via a concrete allowed-origins list
        : true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  });

  // Rate limiting: applied globally. Set RATE_LIMIT_MAX=0 to disable in local dev.
  if (config.rateLimitMax > 0) {
    void app.register(rateLimit, {
      global: true,
      max: config.rateLimitMax,
      timeWindow: "1 minute",
      // Return structured error envelope instead of raw Fastify rate-limit payload.
      errorResponseBuilder: (request, context) =>
        errorEnvelope(
          request.id,
          "RATE_LIMITED",
          `Too many requests. Limit is ${context.max} per ${context.after}.`,
          true
        )
    });
  }

  const ownedDatabaseClient =
    options.databaseClient === undefined && process.env.DATABASE_URL !== undefined
      ? createPrismaClientFromEnvironment()
      : undefined;
  const databaseClient = options.databaseClient ?? ownedDatabaseClient;
  const phase5Service =
    databaseClient === undefined ? undefined : new Phase5ReplayService(databaseClient);

  if (ownedDatabaseClient !== undefined) {
    app.addHook("onClose", async () => {
      await ownedDatabaseClient.$disconnect();
    });
  }

  app.get("/health", async (request) =>
    successEnvelope(request.id, {
      status: "ok",
      service: "api"
    })
  );

  app.get("/ready", async (request, reply) => {
    if (databaseClient === undefined) {
      return reply
        .code(503)
        .send(
          errorEnvelope(
            request.id,
            ErrorCodeSchema.enum.DATABASE_UNAVAILABLE,
            "Database is not configured.",
            true
          )
        );
    }
    try {
      await databaseClient.$queryRaw(Prisma.sql`SELECT 1 AS ready`);
    } catch {
      return reply
        .code(503)
        .send(
          errorEnvelope(
            request.id,
            ErrorCodeSchema.enum.DATABASE_UNAVAILABLE,
            "Database is unavailable.",
            true
          )
        );
    }

    return successEnvelope(request.id, {
      status: "ready",
      mode: config.demoMode ? "demo" : "live",
      providers: {
        payment: config.paymentProvider,
        voice: config.voiceProvider,
        ai: config.aiProvider
      },
      dependencies: { database: "ready" }
    });
  });

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

  app.post("/v1/calls", async (request, reply) => {
    const body = parseWithSchema(CreateCallRequestSchema, request.body);
    const data = await getService().createCall({
      sourceMode: body.sourceMode,
      ...(body.customerId === undefined ? {} : { customerId: body.customerId }),
      ...(body.operatorId === undefined ? {} : { operatorId: body.operatorId }),
      requestId: request.id
    });

    return reply.code(201).send(successEnvelope(request.id, data));
  });

  app.get("/v1/calls/:callId", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await getService().getCall(params.callId));
  });

  app.post("/v1/calls/:callId/end", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const body = parseWithSchema(
      z.object({ reason: z.enum(["CUSTOMER_ENDED", "OPERATOR_ENDED", "SYSTEM_ENDED"]) }).strict(),
      request.body
    );

    return successEnvelope(
      request.id,
      await getService().endCall(params.callId, body.reason, request.id)
    );
  });

  app.post("/v1/calls/:callId/transcript-turns", async (request, reply) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    const body = parseWithSchema(CreateTranscriptTurnRequestSchema, request.body);
    const data = await getService().submitTranscriptTurn(params.callId, body.turn, request.id);

    return reply.code(202).send(successEnvelope(request.id, data));
  });

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

  app.get("/v1/calls/:callId/risk", async (request) => {
    const params = parseWithSchema(CallParamsSchema, request.params);
    return successEnvelope(request.id, await getService().getRisk(params.callId));
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
        .send(errorEnvelope(request.id, "AUTH_FORBIDDEN", "Endpoint available in demo mode only.", false));
    }
    const body = parseWithSchema(SimulatePaymentFailureRequestSchema, request.body);
    return successEnvelope(
      request.id,
      await getService().simulatePaymentFailure(body, request.id)
    );
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

  return app;
}
