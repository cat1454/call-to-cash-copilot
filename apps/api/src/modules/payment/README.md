# Payment module

## 1. Purpose

Own the mock payment intent lifecycle, server-side observation verification, payment-safe projections, and the proof/Trust Receipt side effects of a successful verification.

## 2. Owned routes

- `POST /v1/payments/mock/create`
- `POST /v1/payments/mock/verify`
- `POST /v1/payments/mock/simulate-failure`
- `GET /v1/payments/:bookingId/status`

## 3. Owned use cases

Payment intent creation, verification, demo-only failure simulation, payment-status reads, payment transaction persistence, and proof/Trust Receipt creation required by a successful verification.

## 4. Inputs and outputs

Inputs are existing shared payment request DTOs, server request IDs, and required idempotency keys. Outputs retain the documented public payment-intent, verification, failure, and status response shapes.

## 5. Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, booking read context, platform validation/idempotency helpers, committed event writer, and payment provider adapters.

## 6. Forbidden dependencies

No browser-supplied authority, direct Prisma access from routes, booking or agreement policy ownership, agreement mutation, Solana SDKs, wallet private keys, or receipt read/tamper-verification ownership.

## 7. Transaction and event rules

Intent creation persists the intent, booking transition, and `payment.intent.created` event in one transaction. Successful verification persists the payment transaction, hold consumption, proof, Trust Receipt, booking/payment transitions, and `payment.confirmed`/receipt events in one transaction. Rejected verification persists its evidence, transition, and `payment.failed` event together. The demo expiry mutation deliberately retains its pre-existing no-event behavior.

## 8. Idempotency rules

Creation uses the durable unique payment-intent idempotency key. Verification stores a hash and request fingerprint in the persisted transaction metadata. Exact replays return the original result; reuse with another input fails with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`. No in-memory idempotency is used.

## 9. Privacy rules

Public projections exclude raw provider metadata, raw phone numbers, full transcript text, canonical agreement JSON, AI reasoning, private keys, and credentials. Proof stores only the approved agreement hash/reference material; the receipt payload retains masked contact only.

## 10. Invariants

- Payment owns intent creation and verification, not booking/agreement policy.
- Payment consumes the locked agreement and active inventory hold created by booking.
- An intent requires a locked agreement, open gate, and active hold.
- Amount, recipient, and reference are server-validated; empty/wrong reference fails closed.
- Successful verification creates exactly one transaction, proof, and Trust Receipt atomically.
- Receipt read and verification routes remain outside this module until Stage F.

## 11. Tests

`apps/api/src/app.test.ts` characterizes intent/verification idempotency, missing keys, failure closure, safe receipt projection, events, and receipt issuance. DB-backed execution additionally validates durable records and event evidence when `TEST_DATABASE_URL` is configured.

## 12. Future extension points

`platform/providers/mock-payment-provider.ts` is the deterministic provider implementation. A future `SolanaDevnetPaymentProvider` must implement the same expectation/validation boundary and feed these commands without bypassing payment rules.

## 13. Non-goals

No Solana integration, frontend work, DTO/event/error/schema changes, migration, receipt read extraction, receipt tamper verification extraction, or call-event extraction in Stage E.
