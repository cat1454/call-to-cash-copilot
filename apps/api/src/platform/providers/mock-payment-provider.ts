import type { ErrorCode } from "@call-to-cash/shared";

const MOCK_RECIPIENT = "mock-recipient-wallet";

export type MockPaymentExpectation = {
  recipient: string;
  reference: string;
  memoReference: string;
};

export function createMockPaymentExpectation(
  reference: string,
  agreementHash: string
): MockPaymentExpectation {
  return {
    recipient: MOCK_RECIPIENT,
    reference,
    memoReference: `mock:${agreementHash}`
  };
}

export function validateMockPaymentObservation(input: {
  expectedAmountMinor: number;
  expectedRecipient: string;
  expectedReference: string;
  observedAmountMinor: number;
  observedRecipient: string;
  observedReference: string;
}): ErrorCode | null {
  if (input.observedAmountMinor !== input.expectedAmountMinor) {
    return "PAYMENT_AMOUNT_MISMATCH";
  }
  if (input.observedRecipient !== input.expectedRecipient) {
    return "PAYMENT_RECIPIENT_MISMATCH";
  }
  if (input.observedReference !== input.expectedReference) {
    return "PAYMENT_REFERENCE_MISMATCH";
  }

  return null;
}
