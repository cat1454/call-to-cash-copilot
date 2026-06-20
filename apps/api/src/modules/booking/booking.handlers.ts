import type { DatabaseClient } from "@call-to-cash/db";
import type { ConfirmBookingRequest } from "@call-to-cash/shared";
import { Prisma } from "@call-to-cash/db";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { confirmBooking } from "./commands/confirm-booking.js";
import { getBooking } from "./queries/get-booking.js";
import type { ServiceData } from "./types.js";

function requireClient(client?: DatabaseClient): DatabaseClient {
  if (client === undefined) {
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  }
  return client;
}

export function createBookingHandlers(databaseClient?: DatabaseClient) {
  return {
    get(bookingId: string): Promise<ServiceData> {
      return getBooking(requireClient(databaseClient), bookingId);
    },
    async confirm(
      bookingId: string,
      input: ConfirmBookingRequest,
      idempotencyKey: string,
      requestId: string
    ): Promise<ServiceData> {
      const client = requireClient(databaseClient);
      return client.$transaction(
        (transaction) =>
          confirmBooking(transaction, bookingId, input, idempotencyKey, requestId, new Date()),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 10_000
        }
      );
    }
  };
}
