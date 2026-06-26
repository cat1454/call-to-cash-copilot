import { randomUUID } from "node:crypto";

import { InventoryUnavailableError, reserveInventory } from "@call-to-cash/db";

import type { Transaction } from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export async function reserveInventoryHold(
  transaction: Transaction,
  input: {
    bookingId: string;
    bookingPublicId: string;
    departureId: string | null;
    passengerCount: number | null;
    bookingVersion: number;
    requestId: string;
    now: Date;
  }
): Promise<void> {
  if (input.departureId === null || input.passengerCount === null) {
    return;
  }
  const active = await transaction.inventoryHold.findFirst({
    where: {
      bookingId: input.bookingId,
      status: "ACTIVE",
      expiresAt: { gt: input.now }
    }
  });
  if (active !== null) {
    return;
  }
  try {
    await reserveInventory(transaction, {
      publicId: opaqueId("hold"),
      idempotencyKey: `hold-${input.bookingPublicId}-v${input.bookingVersion}`,
      bookingId: input.bookingId,
      departureId: input.departureId,
      quantity: input.passengerCount,
      now: input.now,
      expiresAt: new Date(input.now.getTime() + 15 * 60_000),
      requestId: input.requestId
    });
  } catch (error) {
    if (error instanceof InventoryUnavailableError) {
      return;
    }
    throw error;
  }
}
