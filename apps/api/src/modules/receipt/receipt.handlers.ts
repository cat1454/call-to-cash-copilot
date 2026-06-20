import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { verifyReceiptTamper } from "./commands/verify-receipt-tamper.js";
import { getReceipt } from "./queries/get-receipt.js";
import { verifyReceipt } from "./queries/verify-receipt.js";
import type { ServiceData } from "./types.js";

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

export function createReceiptHandlers(databaseClient?: DatabaseClient) {
  return {
    get(receiptId: string): Promise<ServiceData> {
      return getReceipt(requireDatabaseClient(databaseClient), receiptId);
    },
    verify(
      receiptId: string,
      input: { candidateDepositAmountMinor?: number | undefined },
      requestId: string
    ): Promise<ServiceData> {
      const client = requireDatabaseClient(databaseClient);
      return input.candidateDepositAmountMinor === undefined
        ? verifyReceipt(client, receiptId)
        : verifyReceiptTamper(client, receiptId, input.candidateDepositAmountMinor, requestId);
    }
  };
}
