# Payment module

## Purpose

Own payment intent lifecycle, provider observation validation, proof/receipt issuance orchestration, and payment status projections.

## Owns

Mock payment creation, mock verification, failure simulation, expiry behavior, idempotency checks, payment transaction records, proof records, Trust Receipt creation, and payment events.

## Public routes / entry points

`POST /v1/payments/mock/create`, `POST /v1/payments/mock/verify`, `POST /v1/payments/mock/simulate-failure`, `GET /v1/payments/:bookingId/status`.

## Inputs and outputs

Inputs are shared payment DTOs and idempotency keys. Outputs are payment intent, verification, failure, and status projections.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, platform providers/events/security/http helpers.

## Forbidden dependencies

No browser authority, no agreement mutation, no route-owned payment-gate logic, and no separate Solana business pipeline.

## Transaction and event rules

Successful verification creates transaction, proof, receipt, state updates, idempotency evidence, and events atomically. Failure records rejected evidence and emits failure/manual-review state atomically.

## Privacy / security rules

Do not expose private keys, raw provider metadata, raw PII, canonical agreement payloads, or full transcript data.

## Invariants

- Payment verification is idempotent.
- A payment intent can be created only from a locked agreement and open payment gate.
- Successful verification creates transaction, proof, receipt, and event atomically.

## Tests that protect this module

Payment create/verify idempotency, wrong amount/recipient/reference, expiry, receipt issuance, and failure/manual-review API tests.

## Future extension points

Replace `MockPaymentProvider` with `SolanaDevnetPaymentProvider` behind the same command path.

## Non-goals

No Solana SDK integration or wallet UI work during this refactor.
