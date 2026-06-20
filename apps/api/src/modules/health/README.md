# Health module

## Purpose

Own liveness and readiness routes.

## Owns

`GET /health` and `GET /ready`.

## Public routes / entry points

`GET /health`, `GET /ready`.

## Inputs and outputs

Inputs are runtime config and dependency reachability. Outputs are shared API envelopes.

## Allowed dependencies

Fastify route registration, `@call-to-cash/config`, `@call-to-cash/db`, and platform HTTP helpers.

## Forbidden dependencies

No booking, payment, receipt, event, or provider business logic.

## Transaction and event rules

Health checks are read-only and never append business events.

## Privacy / security rules

Readiness output may name configured provider modes but must not reveal credentials or secret URLs.

## Invariants

- `/health` means the process is alive.
- `/ready` means configured required dependencies are reachable.
- Do not claim Agora, Solana, Redis, or S3 readiness before they are implemented/configured.

## Tests that protect this module

`GET /health returns the standard success envelope` and `GET /ready reports explicit demo providers`.

## Future extension points

Provider readiness checks and dependency-specific diagnostics.

## Non-goals

No business state mutation or provider initialization side effects.
