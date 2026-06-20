import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { presentPaymentStatus } from "../payment.presenter.js";
import type { ServiceData } from "../types.js";

export async function getPaymentStatus(
  client: DatabaseClient,
  bookingId: string
): Promise<ServiceData> {
  const intent = await client.paymentIntent.findFirst({
    where: { booking: { publicId: bookingId } },
    orderBy: { createdAt: "desc" },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (intent === null) {
    throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
  }
  const transaction = intent.transactions[0];
  return presentPaymentStatus({
    bookingId,
    paymentIntentId: intent.publicId,
    status: intent.status,
    transactionSignature: transaction?.txSignature ?? null,
    verifiedAt: transaction?.verifiedAt ?? null
  });
}
