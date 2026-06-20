import type { DatabaseClient } from "@call-to-cash/db";
import type { SimulatePaymentFailureRequest, VerifyMockPaymentRequest } from "@call-to-cash/shared";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { createPaymentIntentInTransaction } from "./commands/create-payment-intent.js";
import { simulatePaymentFailure } from "./commands/simulate-payment-failure.js";
import { verifyPaymentInTransaction } from "./commands/verify-payment.js";
import { getPaymentStatus } from "./queries/get-payment-status.js";
import type { MockPaymentCreateResult, ServiceData } from "./types.js";

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

export function createPaymentHandlers(databaseClient?: DatabaseClient) {
  return {
    create(
      bookingId: string,
      idempotencyKey: string,
      requestId: string
    ): Promise<MockPaymentCreateResult> {
      return createPaymentIntentInTransaction(
        requireDatabaseClient(databaseClient),
        bookingId,
        idempotencyKey,
        requestId
      );
    },
    verify(
      input: VerifyMockPaymentRequest,
      idempotencyKey: string,
      requestId: string
    ): Promise<ServiceData> {
      return verifyPaymentInTransaction(
        requireDatabaseClient(databaseClient),
        input,
        idempotencyKey,
        requestId
      );
    },
    simulate(input: SimulatePaymentFailureRequest, requestId: string): Promise<ServiceData> {
      return simulatePaymentFailure(requireDatabaseClient(databaseClient), input, requestId);
    },
    status(bookingId: string): Promise<ServiceData> {
      return getPaymentStatus(requireDatabaseClient(databaseClient), bookingId);
    }
  };
}
