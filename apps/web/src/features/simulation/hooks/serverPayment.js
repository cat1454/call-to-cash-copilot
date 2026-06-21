export function buildVerificationPayload(intent) {
  if (intent.provider === "solana_devnet") {
    return {
      paymentIntentId: intent.paymentIntentId
    };
  }
  return {
    paymentIntentId: intent.paymentIntentId,
    observedAmount: intent.amount,
    observedRecipient: intent.recipient,
    observedReference: intent.reference
  };
}
