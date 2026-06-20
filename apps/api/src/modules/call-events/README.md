# Call-events module

## Purpose

Own SSE transport, committed event replay, `Last-Event-ID` recovery, and snapshot response behavior.

## Owns

`GET /v1/calls/:callId/events`, `snapshot=true`, connection lifecycle, heartbeat, polling, and SSE serialization of committed events.

## Public routes / entry points

`GET /v1/calls/:callId/events` and `GET /v1/calls/:callId/events?snapshot=true`.

## Inputs and outputs

Inputs are call IDs, `Last-Event-ID`, and snapshot query. Outputs are SSE frames containing shared event envelopes.

## Allowed dependencies

Fastify route APIs, `@call-to-cash/shared`, platform events, and platform HTTP helpers.

## Forbidden dependencies

No business state mutation, no Prisma feature writes, no payment verification, and no risk/gate calculation.

## Transaction and event rules

SSE streams only committed events and never creates or alters business state.

## Privacy / security rules

Events must be projected through privacy-safe event payloads; no secrets or raw protected data.

## Invariants

- SSE cannot emit uncommitted business state.
- Event ordering comes from durable per-call sequence allocation.
- Reconnect uses `Last-Event-ID` or snapshot/refetch fallback.

## Tests that protect this module

SSE snapshot, event order, and live subscription tests in `apps/api/src/app.test.ts`.

## Future extension points

Outbox-backed delivery and stronger replay gap detection.

## Non-goals

No feature orchestration and no event creation outside committed command transactions.
