import type { DatabaseClient } from "@call-to-cash/db";
import type { SimulatePaymentFailureRequest, VerifyPaymentRequest } from "@call-to-cash/shared";
import type { PaymentProvider } from "@call-to-cash/solana";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { createPaymentIntentInTransaction } from "./commands/create-payment-intent.js";
import { simulatePaymentFailure } from "./commands/simulate-payment-failure.js";
import { verifyPaymentInTransaction } from "./commands/verify-payment.js";
import { getPaymentStatus } from "./queries/get-payment-status.js";
import type { PaymentIntentCreateResult, ServiceData } from "./types.js";

function requireDatabaseClient(databaseClient?: DatabaseClient): DatabaseClient {
  if (databaseClient === undefined) {
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  }
  return databaseClient;
}

function requirePaymentProvider(paymentProvider?: PaymentProvider): PaymentProvider {
  if (paymentProvider === undefined) {
    throw new ApiCommandError(
      503,
      "SOLANA_RPC_UNAVAILABLE",
      "Selected payment provider is not configured.",
      undefined,
      true
    );
  }
  return paymentProvider;
}

export function createPaymentHandlers(
  databaseClient: DatabaseClient | undefined,
  paymentProvider: PaymentProvider | undefined,
  mockPaymentProvider: PaymentProvider
) {
  return {
    createConfigured(
      bookingId: string,
      idempotencyKey: string,
      requestId: string
    ): Promise<PaymentIntentCreateResult> {
      return createPaymentIntentInTransaction(
        requireDatabaseClient(databaseClient),
        requirePaymentProvider(paymentProvider),
        bookingId,
        idempotencyKey,
        requestId
      );
    },
    createMock(
      bookingId: string,
      idempotencyKey: string,
      requestId: string
    ): Promise<PaymentIntentCreateResult> {
      return createPaymentIntentInTransaction(
        requireDatabaseClient(databaseClient),
        mockPaymentProvider,
        bookingId,
        idempotencyKey,
        requestId
      );
    },
    verifyConfigured(
      input: VerifyPaymentRequest,
      idempotencyKey: string,
      requestId: string
    ): Promise<ServiceData> {
      return verifyPaymentInTransaction(
        requireDatabaseClient(databaseClient),
        requirePaymentProvider(paymentProvider),
        input,
        idempotencyKey,
        requestId
      );
    },
    verifyMock(
      input: VerifyPaymentRequest,
      idempotencyKey: string,
      requestId: string
    ): Promise<ServiceData> {
      return verifyPaymentInTransaction(
        requireDatabaseClient(databaseClient),
        mockPaymentProvider,
        input,
        idempotencyKey,
        requestId
      );
    },
    simulate(input: SimulatePaymentFailureRequest, requestId: string): Promise<ServiceData> {
      return simulatePaymentFailure(
        requireDatabaseClient(databaseClient),
        mockPaymentProvider,
        input,
        requestId
      );
    },
    status(bookingId: string): Promise<ServiceData> {
      return getPaymentStatus(requireDatabaseClient(databaseClient), bookingId);
    }
  };
}
