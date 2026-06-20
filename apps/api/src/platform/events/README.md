# Platform events

## Purpose

Own durable event writing, event replay, event projection helpers, and SSE frame serialization.

## Owns

Committed event append to `audit_logs`, per-call sequence allocation, event replay after `Last-Event-ID`, and SSE serialization.

## Public routes / entry points

Infrastructure helpers used by feature commands and the call-events module.

## Inputs and outputs

Inputs are transaction clients, event names, aggregate IDs, request IDs, and event payloads. Outputs are validated shared event envelopes or SSE text frames.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/db` Prisma types, and technical serialization utilities.

## Forbidden dependencies

No domain scoring logic, no payment-gate decisions, no provider calls, and no feature-specific state transitions.

## Transaction and event rules

Events must be appended inside the same transaction as the corresponding state mutation whenever a mutation exists.

## Privacy / security rules

Event payloads must not include raw phone, full transcript outside approved transcript events, canonical agreement payloads, secrets, or raw provider credentials.

## Invariants

- SSE emits only committed event rows.
- Event names and envelopes validate against `EventEnvelopeSchema`.
- Reconnect behavior honors `Last-Event-ID`.

## Tests that protect this module

API SSE ordering/reconnect tests and shared event contract tests.

## Future extension points

Dedicated outbox worker and external event consumers.

## Non-goals

No business policy or provider-specific verification.
