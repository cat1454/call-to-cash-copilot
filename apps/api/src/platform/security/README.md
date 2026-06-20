# Platform security

## Purpose

Own technical security helpers such as demo-mode guards and PII redaction.

## Owns

Demo-only endpoint enforcement, redaction utilities, and future auth/ownership integration seams.

## Public routes / entry points

Helpers used by routes, presenters, and platform layers.

## Inputs and outputs

Inputs are runtime config, request context, and candidate payloads. Outputs are allow/deny decisions or redacted projections.

## Allowed dependencies

`@call-to-cash/config`, `@call-to-cash/shared`, and local platform HTTP types.

## Forbidden dependencies

No business scoring, no payment verification, and no direct Prisma mutation logic.

## Transaction and event rules

Security helpers do not append events unless a future audit-specific helper is explicitly designed for it.

## Privacy / security rules

Never expose raw phone, names, addresses, full transcript, audio, canonical agreement payload, private keys, webhook secrets, or raw AI reasoning by default.

## Invariants

- Demo-only tamper/failure helpers remain guarded by `DEMO_MODE=true`.
- Redaction helpers must be deterministic and conservative.

## Tests that protect this module

Current API demo guard tests and future redaction snapshot tests.

## Future extension points

Authentication, RBAC, ownership checks, consent enforcement, and audit context.

## Non-goals

No product/business authorization policy hidden in arbitrary helpers.
