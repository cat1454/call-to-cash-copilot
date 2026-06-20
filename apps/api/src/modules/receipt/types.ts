import { createHash } from "node:crypto";

import { transitionBooking, type StateTransitionResult } from "@call-to-cash/domain";
import { Prisma } from "@call-to-cash/db";
import { BookingStatus, type EnumValue } from "@call-to-cash/shared";

import { ApiCommandError } from "../../platform/http/api-command-error.js";

export type Transaction = Prisma.TransactionClient;
export type ServiceData = Record<string, unknown>;
export type BookingStatusValue = EnumValue<typeof BookingStatus>;

export function iso(date: Date): string {
  return date.toISOString();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function shortSignature(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function requireTransition<S extends string>(
  result: StateTransitionResult<S>,
  message: string
): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }

  return result.status;
}

export async function transitionBookingThrough(
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
