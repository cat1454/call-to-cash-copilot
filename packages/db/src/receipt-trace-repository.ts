import type { DatabaseClient } from "./client.js";

function shorten(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export class ReceiptTraceRepository {
  constructor(private readonly client: DatabaseClient) {}

  async findByPublicId(publicId: string) {
    const record = await this.client.trustReceipt.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        status: true,
        issuedAt: true,
        verifiedAt: true,
        proofRecord: {
          select: {
            publicId: true,
            proofHashSha256: true,
            anchorType: true,
            verificationStatus: true,
            verifiedAt: true,
            paymentTransaction: {
              select: {
                id: true,
                chain: true,
                txSignature: true,
                verificationStatus: true,
                verifiedAt: true
              }
            },
            agreement: {
              select: {
                publicId: true,
                version: true,
                status: true,
                payloadHashSha256: true,
                policyVersion: true,
                confirmedAt: true,
                inventoryHold: {
                  select: {
                    publicId: true,
                    quantity: true,
                    status: true,
                    expiresAt: true
                  }
                }
              }
            }
          }
        },
        paymentIntent: {
          select: {
            publicId: true,
            status: true,
            currency: true,
            amountMinor: true,
            expiresAt: true
          }
        },
        booking: {
          select: {
            publicId: true,
            status: true,
            routeFrom: true,
            routeTo: true,
            departureAtUtc: true,
            passengerCount: true,
            contactPhoneMasked: true,
            riskAssessments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                publicId: true,
                policyVersion: true,
                completenessScore: true,
                disputeRiskScore: true,
                paymentReadinessScore: true,
                gateDecision: true,
                createdAt: true
              }
            },
            callSession: {
              select: {
                publicId: true,
                status: true,
                sourceMode: true,
                createdAt: true,
                transcriptTurns: {
                  orderBy: { sequenceNo: "asc" },
                  select: {
                    publicId: true,
                    sequenceNo: true,
                    speaker: true,
                    source: true,
                    isFinal: true,
                    createdAt: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (
      record === null ||
      record.proofRecord === null ||
      record.proofRecord.paymentTransaction === null ||
      record.booking.callSession === null
    ) {
      return null;
    }

    const { agreement, paymentTransaction } = record.proofRecord;
    const callSession = record.booking.callSession;

    return {
      receipt: {
        publicId: record.publicId,
        status: record.status,
        issuedAt: record.issuedAt,
        verifiedAt: record.verifiedAt
      },
      proof: {
        publicId: record.proofRecord.publicId,
        proofHashSha256: record.proofRecord.proofHashSha256,
        anchorType: record.proofRecord.anchorType,
        verificationStatus: record.proofRecord.verificationStatus,
        verifiedAt: record.proofRecord.verifiedAt
      },
      paymentTransaction: {
        id: paymentTransaction.id,
        chain: paymentTransaction.chain,
        transactionSignatureShort: shorten(paymentTransaction.txSignature),
        verificationStatus: paymentTransaction.verificationStatus,
        verifiedAt: paymentTransaction.verifiedAt
      },
      paymentIntent: record.paymentIntent,
      agreement,
      inventoryHold: agreement.inventoryHold,
      booking: {
        publicId: record.booking.publicId,
        status: record.booking.status,
        routeFrom: record.booking.routeFrom,
        routeTo: record.booking.routeTo,
        departureAtUtc: record.booking.departureAtUtc,
        passengerCount: record.booking.passengerCount,
        contactPhoneMasked: record.booking.contactPhoneMasked
      },
      riskAssessment: record.booking.riskAssessments[0] ?? null,
      transcriptTurns: callSession.transcriptTurns,
      callSession: {
        publicId: callSession.publicId,
        status: callSession.status,
        sourceMode: callSession.sourceMode,
        createdAt: callSession.createdAt
      }
    };
  }
}
