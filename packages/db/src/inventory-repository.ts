import { Prisma, type InventoryHold } from "./generated/prisma/client.js";

import type { DatabaseClient } from "./client.js";
import {
  IdempotencyConflictError,
  InventoryPersistenceGuardError,
  InventoryUnavailableError
} from "./errors.js";

export type ReserveInventoryInput = {
  publicId: string;
  idempotencyKey: string;
  bookingId: string;
  departureId: string;
  quantity: number;
  now: Date;
  expiresAt: Date;
  requestId?: string;
};

const MAX_SERIALIZABLE_ATTEMPTS = 3;

function isRetryableTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function inSerializableTransaction<T>(
  client: DatabaseClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000
      });
    } catch (error) {
      if (!isRetryableTransactionConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Serializable transaction retry loop exited unexpectedly.");
}

async function lockDeparture(
  transaction: Prisma.TransactionClient,
  departureId: string
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "trip_departures"
    WHERE "id" = ${departureId}::uuid
    FOR UPDATE
  `);

  if (rows.length === 0) {
    throw new InventoryPersistenceGuardError("INVENTORY_DEPARTURE_NOT_FOUND");
  }
}

async function expireDueInTransaction(
  transaction: Prisma.TransactionClient,
  departureId: string,
  now: Date
): Promise<number> {
  const due = await transaction.inventoryHold.findMany({
    where: {
      departureId,
      status: "ACTIVE",
      expiresAt: { lte: now }
    },
    select: { id: true, publicId: true, quantity: true, expiresAt: true }
  });

  if (due.length === 0) {
    return 0;
  }

  await transaction.inventoryHold.updateMany({
    where: { id: { in: due.map((hold) => hold.id) }, status: "ACTIVE" },
    data: { status: "EXPIRED", releasedAt: now, updatedAt: now }
  });
  await transaction.auditLog.createMany({
    data: due.map((hold) => ({
      actorType: "SYSTEM" as const,
      action: "INVENTORY_HOLD_EXPIRED",
      aggregateType: "INVENTORY_HOLD",
      aggregateId: hold.publicId,
      afterState: {
        status: "EXPIRED",
        quantity: hold.quantity,
        expiresAt: hold.expiresAt.toISOString()
      },
      metadata: { source: "server_expiry" },
      createdAt: now
    }))
  });

  return due.length;
}

function isSameIdempotentRequest(hold: InventoryHold, input: ReserveInventoryInput): boolean {
  return (
    hold.publicId === input.publicId &&
    hold.bookingId === input.bookingId &&
    hold.departureId === input.departureId &&
    hold.quantity === input.quantity &&
    hold.expiresAt.getTime() === input.expiresAt.getTime()
  );
}

export class InventoryRepository {
  constructor(private readonly client: DatabaseClient) {}

  async reserve(input: ReserveInventoryInput): Promise<InventoryHold> {
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity <= 0 ||
      input.expiresAt.getTime() <= input.now.getTime()
    ) {
      throw new InventoryPersistenceGuardError("INVALID_INVENTORY_HOLD");
    }

    return inSerializableTransaction(this.client, async (transaction) => {
      await lockDeparture(transaction, input.departureId);

      const replay = await transaction.inventoryHold.findUnique({
        where: { idempotencyKey: input.idempotencyKey }
      });
      if (replay !== null) {
        if (!isSameIdempotentRequest(replay, input)) {
          throw new IdempotencyConflictError();
        }
        return replay;
      }

      const [departure, booking] = await Promise.all([
        transaction.tripDeparture.findUnique({
          where: { id: input.departureId },
          select: { capacity: true, operationalStatus: true }
        }),
        transaction.booking.findUnique({
          where: { id: input.bookingId },
          select: { id: true }
        })
      ]);
      if (departure === null) {
        throw new InventoryPersistenceGuardError("INVENTORY_DEPARTURE_NOT_FOUND");
      }
      if (booking === null) {
        throw new InventoryPersistenceGuardError("BOOKING_NOT_FOUND");
      }
      if (departure.operationalStatus !== "SCHEDULED") {
        throw new InventoryPersistenceGuardError("INVENTORY_DEPARTURE_NOT_SCHEDULED");
      }

      await expireDueInTransaction(transaction, input.departureId, input.now);
      const occupied = await transaction.inventoryHold.aggregate({
        where: {
          departureId: input.departureId,
          OR: [{ status: "CONSUMED" }, { status: "ACTIVE", expiresAt: { gt: input.now } }]
        },
        _sum: { quantity: true }
      });
      const availableSeats = Math.max(0, departure.capacity - (occupied._sum.quantity ?? 0));
      if (input.quantity > availableSeats) {
        throw new InventoryUnavailableError(input.quantity, availableSeats);
      }

      const hold = await transaction.inventoryHold.create({
        data: {
          publicId: input.publicId,
          idempotencyKey: input.idempotencyKey,
          bookingId: input.bookingId,
          departureId: input.departureId,
          quantity: input.quantity,
          status: "ACTIVE",
          expiresAt: input.expiresAt
        }
      });
      await transaction.booking.update({
        where: { id: input.bookingId },
        data: {
          tripDepartureId: input.departureId,
          inventoryHoldExpiresAt: input.expiresAt,
          version: { increment: 1 }
        }
      });
      await transaction.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "INVENTORY_HOLD_CREATED",
          aggregateType: "INVENTORY_HOLD",
          aggregateId: input.publicId,
          requestId: input.requestId ?? null,
          afterState: {
            status: "ACTIVE",
            quantity: input.quantity,
            expiresAt: input.expiresAt.toISOString()
          },
          metadata: {
            bookingId: input.bookingId,
            departureId: input.departureId
          },
          createdAt: input.now
        }
      });

      return hold;
    });
  }

  async expireDue(departureId: string, now: Date): Promise<number> {
    return inSerializableTransaction(this.client, async (transaction) => {
      await lockDeparture(transaction, departureId);
      return expireDueInTransaction(transaction, departureId, now);
    });
  }

  async getAvailableSeats(departureId: string, now: Date): Promise<number> {
    const departure = await this.client.tripDeparture.findUnique({
      where: { id: departureId },
      select: {
        capacity: true,
        operationalStatus: true,
        inventoryHolds: {
          where: {
            OR: [{ status: "CONSUMED" }, { status: "ACTIVE", expiresAt: { gt: now } }]
          },
          select: { quantity: true }
        }
      }
    });
    if (departure === null) {
      throw new InventoryPersistenceGuardError("INVENTORY_DEPARTURE_NOT_FOUND");
    }
    if (departure.operationalStatus !== "SCHEDULED") {
      return 0;
    }

    const occupied = departure.inventoryHolds.reduce((sum, hold) => sum + hold.quantity, 0);
    return Math.max(0, departure.capacity - occupied);
  }
}
