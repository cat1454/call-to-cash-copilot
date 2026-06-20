# Receipt module

## Purpose

Own Trust Receipt reads, verification read model, and demo-only tamper comparison.

## Owns

Receipt projections, proof verification read output, mismatch/manual-review presentation, and candidate comparison for demo mode.

## Public routes / entry points

`GET /v1/receipts/:receiptId`, `GET /v1/receipts/:receiptId/verify`.

## Inputs and outputs

Inputs are receipt IDs and optional demo candidate values. Outputs are privacy-safe receipt and verification projections.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, and platform HTTP/events/security helpers.

## Forbidden dependencies

No payment intent creation, no provider verification, no direct mutation of locked agreement snapshots, and no on-chain payload construction.

## Transaction and event rules

Tamper mismatch updates proof/receipt/manual-review state and appends the receipt verification event in one transaction.

## Privacy / security rules

Receipt projections must not expose raw phone, full transcript, canonical agreement payload, or raw provider secrets.

## Invariants

- Tamper verification never mutates locked agreement state.
- Candidate comparison uses a copy, not the canonical stored agreement object.
- Demo candidate verification remains guarded by `DEMO_MODE=true`.

## Tests that protect this module

Receipt safe projection, tamper mismatch, manual-review transition, and locked-agreement immutability API tests.

## Future extension points

Support-facing receipt trace reads and production verification endpoints with authorization.

## Non-goals

No payment settlement, provider polling, or agreement rewrite behavior.
