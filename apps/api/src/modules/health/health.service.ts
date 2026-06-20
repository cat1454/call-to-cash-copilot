import type { RuntimeConfig } from "@call-to-cash/config";
import { Prisma, type DatabaseClient } from "@call-to-cash/db";
import { ErrorCodeSchema } from "@call-to-cash/shared";

import { ApiCommandError } from "../../platform/http/api-command-error.js";

export function getHealthStatus() {
  return {
    status: "ok",
    service: "api"
  };
}

export async function getReadinessStatus(config: RuntimeConfig, databaseClient?: DatabaseClient) {
  if (databaseClient === undefined) {
    throw new ApiCommandError(
      503,
      ErrorCodeSchema.enum.DATABASE_UNAVAILABLE,
      "Database is not configured.",
      undefined,
      true
    );
  }

  try {
    await databaseClient.$queryRaw(Prisma.sql`SELECT 1 AS ready`);
  } catch {
    throw new ApiCommandError(
      503,
      ErrorCodeSchema.enum.DATABASE_UNAVAILABLE,
      "Database is unavailable.",
      undefined,
      true
    );
  }

  return {
    status: "ready",
    mode: config.demoMode ? "demo" : "live",
    providers: {
      payment: config.paymentProvider,
      voice: config.voiceProvider,
      ai: config.aiProvider
    },
    dependencies: { database: "ready" }
  };
}
