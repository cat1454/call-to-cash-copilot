import { randomUUID } from "node:crypto";

import type {
  CreateProviderIntentInput,
  PaymentProvider,
  ProviderPaymentIntent,
  ProviderPaymentVerification,
  VerifyProviderPaymentInput
} from "@call-to-cash/solana";

const MOCK_RECIPIENT = "mock-recipient-wallet";
type MockPaymentMismatchCode =
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_RECIPIENT_MISMATCH"
  | "PAYMENT_REFERENCE_MISMATCH";

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
}): MockPaymentMismatchCode | null {
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

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  createIntent(input: CreateProviderIntentInput): Promise<ProviderPaymentIntent> {
    const reference = input.persisted?.reference ?? `ref_${randomUUID().replaceAll("-", "")}`;
    const expectation = createMockPaymentExpectation(reference, input.agreementHash);
    return Promise.resolve({
      provider: this.name,
      chain: "MOCK",
      recipient: input.persisted?.recipient ?? expectation.recipient,
      reference,
      memo: input.persisted?.memo ?? expectation.memoReference,
      paymentAmount: {
        currency: "VND",
        minor: input.expectedAmountMinor,
        display: String(input.expectedAmountMinor)
      }
    });
  }

  verifyPayment(input: VerifyProviderPaymentInput): Promise<ProviderPaymentVerification> {
    const observedAmountMinor = input.observation.amountMinor ?? -1;
    const observedRecipient = input.observation.recipient ?? "";
    const observedReference = input.observation.reference ?? "";
    const mismatchCode = validateMockPaymentObservation({
      expectedAmountMinor: input.expected.amountMinor,
      expectedRecipient: input.expected.recipient,
      expectedReference: input.expected.reference,
      observedAmountMinor,
      observedRecipient,
      observedReference
    });
    const transactionSignature =
      input.observation.transactionSignature ?? `mock_tx_${randomUUID().replaceAll("-", "")}`;
    const base = {
      chain: "MOCK" as const,
      transactionSignature,
      observedAmountMinor,
      observedRecipient,
      observedReference,
      referenceMatched: observedReference === input.expected.reference,
      metadata: { simulated: true }
    };

    if (mismatchCode !== null) {
      return Promise.resolve({
        ...base,
        status: "REJECTED",
        error: {
          code: mismatchCode,
          httpStatus: 422,
          retryable: false,
          message: "Payment verification failed closed."
        }
      });
    }

    return Promise.resolve({ ...base, status: "CONFIRMED" });
  }
}
