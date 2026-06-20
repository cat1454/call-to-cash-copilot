# Bootstrap

## Purpose

Own API composition: dependency creation, Fastify plugin registration, and route registration.

## Owns

Runtime dependency wiring, lifecycle hooks, plugin order, and the single place where feature routes are mounted.

## Public routes / entry points

Future `create-dependencies`, `register-plugins`, and `register-routes` functions.

## Inputs and outputs

Inputs are runtime config and optional test dependencies. Output is a configured Fastify instance/dependency graph.

## Allowed dependencies

Fastify, `@call-to-cash/config`, `@call-to-cash/db`, local `platform`, and feature module route registrars.

## Forbidden dependencies

No booking, risk, payment, agreement, proof, or receipt business rules.

## Transaction and event rules

Bootstrap never opens business transactions and never appends events directly.

## Privacy / security rules

Bootstrap may pass config and dependencies but must not log secrets or expose provider credentials.

## Invariants

- Plugin order remains explicit.
- Test dependency injection remains supported.
- Process-owned database clients are closed on app shutdown.

## Tests that protect this module

`apps/api/src/app.test.ts` health/ready and route tests.

## Future extension points

Auth plugins, observability plugins, and provider registries.

## Non-goals

No feature orchestration and no direct Prisma business query logic.
