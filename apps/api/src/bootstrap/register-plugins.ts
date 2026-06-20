import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

import { errorEnvelope } from "../platform/http/api-response.js";
import type { ApiDependencies } from "./types.js";

export function registerPlugins(app: FastifyInstance, dependencies: ApiDependencies): void {
  const { config, ownedDatabaseClient } = dependencies;

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

  if (ownedDatabaseClient !== undefined) {
    app.addHook("onClose", async () => {
      await ownedDatabaseClient.$disconnect();
    });
  }
}
