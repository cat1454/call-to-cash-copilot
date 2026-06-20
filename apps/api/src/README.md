# API source root

## Purpose

Compose and host the Call-to-Cash Fastify API while keeping public contracts, business rules, persistence, and event delivery in clear boundaries.

## Owns

`app.ts`, `server.ts`, bootstrap wiring, platform helpers, feature modules, and API test support.

## Public routes / entry points

`buildApp` for tests/runtime composition and `server.ts` for process startup.

## Inputs and outputs

Inputs are Fastify requests validated with `@call-to-cash/shared` schemas. Outputs are shared API envelopes and SSE frames.

## Allowed dependencies

`@call-to-cash/shared`, `@call-to-cash/domain`, `@call-to-cash/db`, `@call-to-cash/config`, provider packages, Fastify, and local `platform`/`modules` public entry points.

## Forbidden dependencies

No `apps/web` imports, no private provider secrets in frontend-visible output, and no module importing another module's private command implementation.

## Transaction and event rules

State-changing use cases must persist business state and append durable events atomically where applicable.

## Privacy / security rules

Default projections must not expose raw phone, full transcript, canonical agreement payloads, secrets, or raw provider credentials.

## Invariants

- Route handlers stay thin and transport-focused.
- `packages/domain` owns deterministic policy.
- `packages/shared` owns public schemas, enums, events, and errors.

## Tests that protect this module

`apps/api/src/app.test.ts`, package tests in `packages/shared`, `packages/domain`, and `packages/db`.

## Future extension points

Solana devnet provider, Agora transcript input, auth/RBAC hooks, and richer observability.

## Non-goals

No provider integration, schema migration, endpoint rename, DTO change, or UI refactor during the modular extraction.
