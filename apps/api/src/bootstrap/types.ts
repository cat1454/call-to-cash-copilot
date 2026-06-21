import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";
import type { PaymentProvider } from "@call-to-cash/solana";

export type BuildAppOptions = {
  databaseClient?: DatabaseClient;
  paymentProvider?: PaymentProvider;
};

export type ApiDependencies = {
  config: RuntimeConfig;
  databaseClient?: DatabaseClient;
  ownedDatabaseClient?: DatabaseClient;
  paymentProvider?: PaymentProvider;
  mockPaymentProvider: PaymentProvider;
};
