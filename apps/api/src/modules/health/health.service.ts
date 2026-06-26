import type { RuntimeConfig } from "@call-to-cash/config";
import { Prisma, type DatabaseClient } from "@call-to-cash/db";
import { ErrorCodeSchema } from "@call-to-cash/shared";
import type { PaymentProvider } from "@call-to-cash/solana";

import { ApiCommandError } from "../../platform/http/api-command-error.js";

export function getApiDiscovery() {
  return {
    service: "call-to-cash-api",
    health: "/health",
    readiness: "/ready"
  };
}

export function getHealthStatus() {
  return {
    status: "ok",
    service: "api"
  };
}

export async function getReadinessStatus(
  config: RuntimeConfig,
  databaseClient?: DatabaseClient,
  paymentProvider?: PaymentProvider
) {
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

  if (config.paymentProvider === "solana_devnet" && paymentProvider === undefined) {
    throw new ApiCommandError(
      503,
      ErrorCodeSchema.enum.SOLANA_RPC_UNAVAILABLE,
      "Solana Devnet payment provider is not configured.",
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
