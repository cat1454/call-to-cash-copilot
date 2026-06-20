import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { presentReceipt } from "../receipt.presenter.js";
import type { ServiceData } from "../types.js";

export async function getReceipt(client: DatabaseClient, receiptId: string): Promise<ServiceData> {
  const receipt = await client.trustReceipt.findUnique({
    where: { publicId: receiptId },
    include: {
      booking: true,
      paymentIntent: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } } },
      proofRecord: { include: { agreement: true } }
    }
  });
  if (receipt === null || receipt.proofRecord === null) {
    throw new ApiCommandError(404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
  }

  return presentReceipt(receipt);
}
