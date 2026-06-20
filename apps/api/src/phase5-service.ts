import { createHash } from "node:crypto";

import {
  transitionBooking,
  transitionReceipt,
  type StateTransitionResult
} from "@call-to-cash/domain";
import { Prisma, type DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  Currency,
  EventEnvelopeSchema,
  EventName,
  ProofStatus,
  ReceiptStatus,
  RiskNextAction,
  type EnumValue,
  type EventEnvelope
} from "@call-to-cash/shared";

import { appendEvent } from "./platform/events/event-log.js";
import { ApiCommandError } from "./platform/http/api-command-error.js";

type Transaction = Prisma.TransactionClient;
type BookingStatusValue = EnumValue<typeof BookingStatus>;
type ReceiptStatusValue = EnumValue<typeof ReceiptStatus>;
type ServiceData = Record<string, unknown>;

function iso(date: Date): string {
  return date.toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function shortSignature(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }
  return result.status;
}

async function transitionBookingThrough(
  transaction: Transaction,
  bookingId: string,
  currentStatus: BookingStatusValue,
  targets: readonly BookingStatusValue[]
): Promise<BookingStatusValue> {
  let status = currentStatus;
  for (const target of targets) {
    status = requireTransition(
      transitionBooking(status, target),
      "Booking state transition is not allowed."
    );
    await transaction.booking.update({
      where: { id: bookingId },
      data: { status, version: { increment: 1 } }
    });
  }
  return status;
}

/**
 * Temporary Stage E strangler facade. Receipt reads, receipt tamper verification,
 * and recoverable call-event reads move in Stage F; payment orchestration lives in
 * modules/payment.
 */
export class Phase5ReplayService {
  constructor(private readonly client: DatabaseClient) {}

  async getReceipt(receiptId: string): Promise<ServiceData> {
    const receipt = await this.client.trustReceipt.findUnique({
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
    const transaction = receipt.paymentIntent.transactions[0];
    return {
      receiptId: receipt.publicId,
      bookingId: receipt.booking.publicId,
      status: receipt.status,
      booking: {
        bookingId: receipt.booking.publicId,
        route: `${receipt.booking.routeFrom} → ${receipt.booking.routeTo}`,
        departureAt:
          receipt.booking.departureAtUtc === null
            ? iso(receipt.issuedAt)
            : iso(receipt.booking.departureAtUtc),
        passengerCount: receipt.booking.passengerCount ?? 1,
        contactPhoneMasked: receipt.booking.contactPhoneMasked ?? "[PHONE]"
      },
      deposit: {
        amount: { currency: Currency.Vnd, minor: receipt.paymentIntent.amountMinor },
        status: receipt.paymentIntent.status
      },
      verification: {
        status: receipt.proofRecord.verificationStatus,
        agreementVersion: receipt.proofRecord.agreement.version,
        transactionSignatureShort:
          transaction === undefined ? "mock" : shortSignature(transaction.txSignature)
      }
    };
  }

  async verifyReceipt(
    receiptId: string,
    input: { candidateDepositAmountMinor?: number | undefined },
    requestId: string
  ): Promise<ServiceData> {
    const now = new Date();
    return this.client.$transaction(async (transaction) => {
      const receipt = await transaction.trustReceipt.findUnique({ where: { publicId: receiptId } });
      if (receipt === null || receipt.proofRecordId === null) {
        throw new ApiCommandError(404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
      }
      const receiptBooking = await transaction.booking.findUniqueOrThrow({
        where: { id: receipt.bookingId },
        select: { publicId: true }
      });
      const receiptProof = await transaction.proofRecord.findUniqueOrThrow({
        where: { id: receipt.proofRecordId }
      });
      const receiptAgreement = await transaction.agreement.findUniqueOrThrow({
        where: { id: receiptProof.agreementId }
      });
      let status = receiptProof.verificationStatus;
      if (input.candidateDepositAmountMinor !== undefined) {
        const candidate = JSON.parse(JSON.stringify(receiptAgreement.canonicalPayload)) as {
          commercialTerms?: { depositAmountVnd?: number };
        };
        if (candidate.commercialTerms !== undefined) {
          candidate.commercialTerms.depositAmountVnd = input.candidateDepositAmountMinor;
        }
        if (sha256(JSON.stringify(candidate)) !== receiptProof.proofHashSha256) {
          status = ProofStatus.Mismatch;
          await transaction.proofRecord.update({
            where: { id: receiptProof.id },
            data: { verificationStatus: "MISMATCH", verifiedAt: now }
          });
          await transaction.trustReceipt.update({
            where: { id: receipt.id },
            data: {
              status: requireTransition(
                transitionReceipt(receipt.status as ReceiptStatusValue, ReceiptStatus.Mismatch),
                "Receipt cannot enter mismatch from its current state."
              ),
              verifiedAt: now
            }
          });
          const currentBooking = await transaction.booking.findUniqueOrThrow({
            where: { id: receipt.bookingId },
            select: { status: true }
          });
          await transitionBookingThrough(
            transaction,
            receipt.bookingId,
            currentBooking.status as BookingStatusValue,
            [BookingStatus.ManualReviewRequired]
          );
          const call = await transaction.callSession.findFirstOrThrow({
            where: { bookingId: receipt.bookingId }
          });
          await appendEvent(transaction, {
            callId: call.publicId,
            bookingId: receiptBooking.publicId,
            event: EventName.ReceiptVerified,
            data: {
              receiptId: receipt.publicId,
              status: ReceiptStatus.Mismatch,
              verification: ProofStatus.Mismatch,
              agreementVersion: receiptAgreement.version,
              verifiedAt: iso(now),
              customerMessage: "Receipt proof requires manual review.",
              nextAction: RiskNextAction.ManualReview
            },
            requestId,
            occurredAt: now
          });
        }
      }
      return {
        bookingId: receiptBooking.publicId,
        receiptId: receipt.publicId,
        status,
        agreementVersion: receiptAgreement.version,
        proofHash: receiptProof.proofHashSha256,
        verifiedAt: receiptProof.verifiedAt === null ? null : iso(receiptProof.verifiedAt),
        ...(status === ProofStatus.Mismatch ? { nextAction: RiskNextAction.ManualReview } : {})
      };
    });
  }

  async getEvents(callId: string, lastEventId?: string): Promise<EventEnvelope[]> {
    const call = await this.client.callSession.findUnique({ where: { publicId: callId } });
    if (call === null) {
      throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
    }
    const rows = await this.client.auditLog.findMany({
      where: { aggregateType: "CALL_STREAM", aggregateId: callId, eventId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { afterState: true }
    });
    const events = rows
      .map((row) => EventEnvelopeSchema.safeParse(row.afterState))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((left, right) => left.sequence - right.sequence);
    if (lastEventId === undefined) {
      return events;
    }
    const index = events.findIndex((event) => event.eventId === lastEventId);
    return index === -1 ? events : events.slice(index + 1);
  }
}
