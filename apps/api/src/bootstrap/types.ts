import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";
import type { PaymentProvider } from "@call-to-cash/solana";
import type { BookingExtractor } from "@call-to-cash/ai";

export type BuildAppOptions = {
  databaseClient?: DatabaseClient;
  paymentProvider?: PaymentProvider;
  bookingExtractor?: BookingExtractor;
};

export type ApiDependencies = {
  config: RuntimeConfig;
  databaseClient?: DatabaseClient;
  ownedDatabaseClient?: DatabaseClient;
  paymentProvider?: PaymentProvider;
  mockPaymentProvider: PaymentProvider;
  bookingExtractor?: BookingExtractor;
};
