# Platform HTTP

## Purpose

Own shared HTTP mechanics such as API envelopes, validation helpers, idempotency header extraction, request context, and error mapping.

## Owns

Transport-safe response builders and expected-error translation.

## Public routes / entry points

Helper functions used by route handlers; no public REST routes.

## Inputs and outputs

Inputs are Fastify requests, headers, validation results, and known application errors. Outputs are shared success/error envelopes.

## Allowed dependencies

Fastify types, Zod, and `@call-to-cash/shared`.

## Forbidden dependencies

No Prisma, no domain policy, no provider SDK, and no feature-specific state mutation.

## Transaction and event rules

HTTP helpers do not own transactions or event append.

## Privacy / security rules

Errors must not leak stack traces, SQL details, secrets, raw PII, or provider credentials.

## Invariants

- Public error envelopes stay compatible with `ApiErrorEnvelopeSchema`.
- Idempotency keys are required only where command contracts require them.

## Tests that protect this module

API app tests for validation errors, missing idempotency keys, unknown routes, and ready/health envelopes.

## Future extension points

Auth context, correlation IDs, standardized pagination, and rate-limit headers.

## Non-goals

No business use-case orchestration.
