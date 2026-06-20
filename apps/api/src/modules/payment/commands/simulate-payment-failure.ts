import type { DatabaseClient } from "@call-to-cash/db";
import type { SimulatePaymentFailureRequest } from "@call-to-cash/shared";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import type { ServiceData } from "../types.js";
import { opaqueId } from "../types.js";
import { verifyPaymentInTransaction } from "./verify-payment.js";

export async function simulatePaymentFailure(
  client: DatabaseClient,
  input: SimulatePaymentFailureRequest,
  requestId: string
): Promise<ServiceData> {
  const now = new Date();
  const intent = await client.paymentIntent.findUnique({
    where: { publicId: input.paymentIntentId }
  });
  if (intent === null) {
    throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
  }
  if (intent.status !== "CREATED" && intent.status !== "PENDING") {
    throw new ApiCommandError(
      409,
      "PAYMENT_INTENT_ALREADY_EXISTS",
      `Payment intent is already in a terminal state: ${intent.status}.`
    );
  }
  const booking = await client.booking.findUniqueOrThrow({ where: { id: intent.bookingId } });
  const call = await client.callSession.findFirstOrThrow({
    where: { bookingId: intent.bookingId }
  });

  if (input.outcome === "EXPIRED") {
    // Existing demo behavior intentionally mutates expiry without emitting an event.
    await client.paymentIntent.update({
      where: { id: intent.id },
      data: { expiresAt: new Date(now.getTime() - 1000) }
    });
    return {
      paymentIntentId: intent.publicId,
      outcome: "EXPIRED",
      message:
        "Payment intent forcibly expired. Next verify call will return PAYMENT_INTENT_EXPIRED."
    };
  }

  const verifyInput = {
    paymentIntentId: input.paymentIntentId,
    observedAmount: {
      currency: "VND" as const,
      minor: input.outcome === "WRONG_AMOUNT" ? intent.amountMinor + 1 : intent.amountMinor
    },
    observedRecipient:
      input.outcome === "WRONG_RECIPIENT" ? "wrong-recipient-wallet" : intent.recipientWallet,
    observedReference:
      input.outcome === "WRONG_REFERENCE" ? "ref_00000000wrong" : intent.solanaReference,
    transactionSignature: `sim_fail_${opaqueId("tx")}`
  };
  const idempotencyKey = `sim-fail-${input.outcome}-${intent.publicId}-${requestId}`;
  return verifyPaymentInTransaction(client, verifyInput, idempotencyKey, requestId).then(
    (result) => ({
      paymentIntentId: intent.publicId,
      outcome: input.outcome,
      verificationResult: result,
      booking: booking.publicId,
      call: call.publicId
    })
  );
}
