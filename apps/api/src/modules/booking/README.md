# Booking module

## Purpose

Own booking read models, inventory hold orchestration, explicit confirmation, and immutable agreement locking.

## Owns

Booking retrieval, inventory reservation coordination, confirmation validation, agreement version creation, canonical agreement hash persistence, and `agreement.locked` event behavior.

## Public routes / entry points

`GET /v1/bookings/:bookingId`, `POST /v1/bookings/:bookingId/confirm`.

## Inputs and outputs

Inputs are shared booking IDs and confirmation DTOs. Outputs are booking and confirmed agreement projections.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, and platform HTTP/events/security helpers.

## Forbidden dependencies

No provider payment verification, no Solana adapter logic, no route-owned risk formulas, and no receipt issuance.

## Transaction and event rules

Confirmation must validate booking/risk/hold state, lock the agreement, transition booking state, record idempotency/audit evidence, and append events atomically.

## Privacy / security rules

Do not expose raw phone, pickup details beyond approved displays, or canonical agreement payload in ordinary read models.

## Invariants

- Payment cannot start without active inventory hold and locked agreement.
- Material changes invalidate explicit confirmation through domain policy.
- Locked agreements are append-only versions, never updated in place.

## Tests that protect this module

Domain booking tests, DB locked-agreement tests, and API booking confirmation/idempotency tests.

## Future extension points

Inventory policy adapters, richer booking projections, and operator confirmation methods.

## Non-goals

No payment-provider verification, receipt creation, or live voice processing.
