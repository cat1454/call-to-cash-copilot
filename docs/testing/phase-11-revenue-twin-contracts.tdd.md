# Phase 11.0 Revenue Twin Contract TDD Evidence

## Discovery

1. **Inventory authority:** `packages/db/src/inventory-repository.ts`, called through API booking orchestration; a locked transaction creates the authoritative hold.
2. **Departure representation:** Prisma `TripDeparture` (`routeCode`, route endpoints, scheduled instant, capacity, fare, version) and catalogue-backed booking resolution.
3. **Money:** VND integer minor units via shared `MoneySchema`; no floating-point currency.
4. **Public IDs:** prefixed strict schemas in `packages/shared/src/schemas/primitives.ts`.
5. **Event envelope:** `{ eventId, event, version, occurredAt, correlationId?, callId, bookingId, sequence, data }`.
6. **API envelope:** `{ success: true, data, meta }` or safe `{ success: false, error }`.
7. **Errors:** shared enum with mapped status/retry behavior in `ERROR-CODES.md`.
8. **Idempotency:** command key plus server-side durable replay/conflict enforcement for booking, inventory, and payment.
9. **Booking to payment:** booking fields → inventory hold → locked agreement/open gate → payment intent → server verification → proof/receipt.
10. **Phase 11 module boundaries:** shared contracts/events/errors; pure domain acceptance freshness guard; future API orchestration; future database repository; future web read model.

## Test cases

- strict demand context and fixed-time validation;
- strict departure/offer capacity and integer-money validation;
- policy/evaluation/identifier-only acceptance validation;
- safe versioned event payload validation;
- pure acceptance freshness guard rejects stale inventory without creating a hold.

## Commands and evidence

```text
corepack pnpm --filter @call-to-cash/shared test                 PASS (26 tests)
corepack pnpm --filter @call-to-cash/shared typecheck            PASS
corepack pnpm --filter @call-to-cash/domain test                 PASS (10 tests)
corepack pnpm --filter @call-to-cash/domain typecheck            PASS
corepack pnpm test                                                PASS (database-backed cases skipped without TEST_DATABASE_URL)
corepack pnpm build                                               PASS
```

`corepack pnpm format:check` reports existing formatting debt in unrelated files. `corepack pnpm lint` is blocked by the pre-existing dirty `apps/api/src/modules/call-session/replay/replay-extractor.ts` (`prefer-const`); no repository-wide formatting cleanup was performed.

## Scope and gaps

No migration, repository, route, worker, provider integration, dashboard, voice directive, or infrastructure was added. Phase 11.1 begins only after a durable departure snapshot contract can be mapped to the existing authority without exposing PII.
