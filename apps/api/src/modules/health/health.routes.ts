import type { FastifyInstance } from "fastify";

import { successEnvelope } from "../../platform/http/api-response.js";
import type { ApiDependencies } from "../../bootstrap/types.js";
import { getHealthStatus, getReadinessStatus } from "./health.service.js";

export function registerHealthRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get("/health", async (request) => successEnvelope(request.id, getHealthStatus()));

  app.get("/ready", async (request) =>
    successEnvelope(
      request.id,
      await getReadinessStatus(
        dependencies.config,
        dependencies.databaseClient,
        dependencies.paymentProvider
      )
    )
  );
}
