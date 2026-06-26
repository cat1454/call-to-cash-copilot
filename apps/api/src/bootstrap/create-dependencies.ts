import type { RuntimeConfig } from "@call-to-cash/config";
import { createPrismaClientFromEnvironment } from "@call-to-cash/db";
import { SolanaDevnetPaymentProvider, type PaymentProvider } from "@call-to-cash/solana";

import { MockPaymentProvider } from "../platform/providers/mock-payment-provider.js";
import type { ApiDependencies, BuildAppOptions } from "./types.js";

function createConfiguredPaymentProvider(
  config: RuntimeConfig,
  mockPaymentProvider: PaymentProvider
): PaymentProvider | undefined {
  if (config.paymentProvider === "mock") return mockPaymentProvider;
  if (!config.solanaDevnet.ready) return undefined;
  try {
    return new SolanaDevnetPaymentProvider({
      rpcUrl: config.solanaDevnet.rpcUrl,
      recipientPublicKey: config.solanaDevnet.recipientPublicKey,
      amountLamports: config.solanaDevnet.demoAmountLamports,
      label: config.solanaDevnet.paymentLabel,
      commitment: config.solanaDevnet.commitment
    });
  } catch {
    return undefined;
  }
}

export function createDependencies(
  config: RuntimeConfig,
  options: BuildAppOptions = {}
): ApiDependencies {
  const ownedDatabaseClient =
    options.databaseClient === undefined && process.env.DATABASE_URL !== undefined
      ? createPrismaClientFromEnvironment()
      : undefined;
  const databaseClient = options.databaseClient ?? ownedDatabaseClient;
  const mockPaymentProvider = new MockPaymentProvider();
  const paymentProvider =
    options.paymentProvider ?? createConfiguredPaymentProvider(config, mockPaymentProvider);
  return {
    config,
    mockPaymentProvider,
    ...(databaseClient === undefined ? {} : { databaseClient }),
    ...(ownedDatabaseClient === undefined ? {} : { ownedDatabaseClient }),
    ...(paymentProvider === undefined ? {} : { paymentProvider }),
    ...(options.bookingExtractor === undefined
      ? {}
      : { bookingExtractor: options.bookingExtractor })
  };
}
