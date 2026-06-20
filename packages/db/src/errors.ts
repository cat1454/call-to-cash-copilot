export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD";

  constructor() {
    super("The idempotency key was already used with different inventory hold input.");
    this.name = "IdempotencyConflictError";
  }
}

export class InventoryUnavailableError extends Error {
  readonly code = "INVENTORY_UNAVAILABLE";

  constructor(
    readonly requestedSeats: number,
    readonly availableSeats: number
  ) {
    super(`Cannot reserve ${requestedSeats} seats; ${availableSeats} seats remain.`);
    this.name = "InventoryUnavailableError";
  }
}

export class InventoryPersistenceGuardError extends Error {
  constructor(
    readonly code:
      | "BOOKING_NOT_FOUND"
      | "INVENTORY_DEPARTURE_NOT_FOUND"
      | "INVENTORY_DEPARTURE_NOT_SCHEDULED"
      | "INVALID_INVENTORY_HOLD"
  ) {
    super(code);
    this.name = "InventoryPersistenceGuardError";
  }
}
