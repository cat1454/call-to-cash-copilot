import { PaymentAnchorType, ProofStatus } from "@call-to-cash/shared";

import type { Transaction } from "../types.js";
import { opaqueId } from "../types.js";

export async function createVerifiedProofRecord(
  transaction: Transaction,
  input: {
    bookingId: string;
    agreementId: string;
    paymentTransactionId: string;
    agreementHash: string;
    reference: string;
    chain: "MOCK" | "SOLANA_DEVNET";
    now: Date;
  }
): Promise<{ id: string; publicId: string }> {
  const pendingProof = await transaction.proofRecord.create({
    data: {
      publicId: opaqueId("proof"),
      bookingId: input.bookingId,
      agreementId: input.agreementId,
      paymentTransactionId: input.paymentTransactionId,
      proofHashSha256: input.agreementHash,
      anchorType:
        input.chain === "SOLANA_DEVNET"
          ? PaymentAnchorType.SolanaReference
          : PaymentAnchorType.ServerAttestation,
      anchorValue: input.reference,
      verificationStatus: ProofStatus.Pending
    }
  });

  return transaction.proofRecord.update({
    where: { id: pendingProof.id },
    data: { verificationStatus: ProofStatus.Match, verifiedAt: input.now }
  });
}
