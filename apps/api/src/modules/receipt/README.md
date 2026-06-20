# Receipt module

## Purpose

Own Trust Receipt reads, verification read model, and demo-only tamper comparison.

## Owned routes

`GET /v1/receipts/:receiptId`, `GET /v1/receipts/:receiptId/verify`.

## Owned use cases

Receipt projections, proof verification read output, mismatch/manual-review presentation, and candidate comparison for demo mode.

## Inputs and outputs

Inputs are receipt IDs and optional demo candidate values. Outputs are privacy-safe receipt and verification projections.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, and platform HTTP/event helpers. Receipt reads the payment/proof/agreement trace but does not create payment.

## Forbidden dependencies

No payment intent creation, provider verification, direct mutation of locked agreement snapshots, SSE transport, or on-chain payload construction.

## Transaction and event rules

Read-only verification performs no mutation. Demo-only tamper mismatch updates proof/receipt/manual-review state and appends the `receipt.verified` event in one transaction.

## Privacy / security rules

Receipt projections must not expose raw phone, full transcript, canonical agreement payload, or raw provider secrets.

## Invariants

- Candidate agreement data is comparison input only and uses a copy, not the canonical stored agreement object.
- Tamper verification never mutates locked agreement state.
- Demo candidate verification remains guarded by `DEMO_MODE=true`.

## Tests that protect this module

Receipt safe projection, tamper mismatch, manual-review transition, and locked-agreement immutability API tests.

## Future extension points

Support-facing receipt trace reads and production verification endpoints with authorization.

## Non-goals

No payment settlement, provider polling, or agreement rewrite behavior.
