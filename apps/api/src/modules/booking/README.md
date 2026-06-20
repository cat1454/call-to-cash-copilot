# Booking module

## 1. Purpose

Own booking draft orchestration, inventory holds, booking reads, agreement locking, and booking-confirmation events.

## 2. Owned routes

- `GET /v1/bookings/:bookingId`
- `POST /v1/bookings/:bookingId/confirm`

## 3. Owned use cases

- Draft upsert from extracted call facts
- Transaction-aware inventory hold reservation
- Booking risk context and public projection
- Canonical agreement creation, SHA-256 hashing, and immutable lock
- Idempotent booking confirmation and committed booking/risk/gate events

## 4. Inputs and outputs

Call-session invokes the narrow `BookingDraftWriter` port with a Prisma transaction and normalized facts. HTTP handlers accept only shared DTOs and return the existing public API response data.

## 5. Allowed dependencies

`packages/domain`, `packages/db`, `packages/shared`, and API platform validation/event helpers.

## 6. Forbidden dependencies

No call-session route handlers, frontend, Agora, Solana, payment-provider, or direct HTTP response construction in commands.

## 7. Transaction and event rules

Booking draft writes, inventory holds, extraction/risk linkage, and committed events run in one caller-owned serializable transaction. Confirmation, locked agreement persistence, booking transition, audit row, and `agreement.locked` also commit atomically.

## 8. Privacy rules

Public projections expose only the masked phone field. Canonical agreement persistence is server generated and never contains raw phone numbers, full transcripts, or internal risk reasoning.

## 9. Invariants

- Booking owns agreement locking and inventory hold orchestration.
- Call-session may request draft updates through `BookingDraftWriter`, but does not own booking policy.
- Payment is not owned by this module.
- An agreement is locked before payment intent creation.
- Inventory must be active at confirmation and payment-intent creation.
- Booking mutations and committed events are atomic.

## 10. Tests

`apps/api/src/app.test.ts` covers API behavior. `packages/db/src/db.test.ts` protects oversell, idempotency, expiry, and rollback of an in-transaction reservation when a later parent write fails.

## 11. Future extension points

Future Agora/LLM extraction enters through call-session and then the booking draft writer. Future Solana payment consumes a locked agreement and must not alter booking rules.

## 12. Non-goals

No payment, proof, receipt, call-event, Agora, Solana, Redis, S3, frontend, API-path, shared-DTO, event-name, or schema changes are made here.
