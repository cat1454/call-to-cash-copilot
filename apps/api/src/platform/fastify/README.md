# Platform Fastify

## Purpose

Own Fastify-specific plugin registration and runtime integration details.

## Owns

CORS, rate limit, config/database attachment, lifecycle hooks, and type augmentations.

## Public routes / entry points

Plugin registration functions; no business REST routes.

## Inputs and outputs

Inputs are Fastify instance, runtime config, and database dependency. Output is a configured Fastify instance.

## Allowed dependencies

Fastify, `@fastify/cors`, `@fastify/rate-limit`, `@call-to-cash/config`, and `@call-to-cash/db`.

## Forbidden dependencies

No feature command internals, no risk/payment policy, and no provider verification logic.

## Transaction and event rules

Plugins do not own business transactions or event append.

## Privacy / security rules

Logger redaction must include authorization/cookie headers and future secret-bearing fields.

## Invariants

- Existing CORS/rate-limit behavior remains compatible.
- Production CORS must not accidentally claim unrestricted readiness.

## Tests that protect this module

`apps/api/src/app.test.ts` and future plugin-focused tests.

## Future extension points

Auth plugin, metrics/tracing plugin, request context plugin.

## Non-goals

No route-specific behavior or direct Prisma feature queries.
