# API test support

## Purpose

Own test-only helpers for building apps, databases, clocks, fixtures, and API assertions.

## Owns

Future shared test app builders, database reset helpers, fixture factories, and assertion utilities.

## Public routes / entry points

No public runtime routes; test helper imports only.

## Inputs and outputs

Inputs are test runtime config and optional database URLs. Outputs are app instances, fixtures, and assertions.

## Allowed dependencies

Node test utilities, `@call-to-cash/shared`, `@call-to-cash/db`, and public app composition helpers.

## Forbidden dependencies

No production-only secrets, no destructive resets against non-test databases, and no hidden mutation of global app behavior.

## Transaction and event rules

Test helpers may set up data but must not weaken production transaction/event invariants.

## Privacy / security rules

Synthetic test data only; never encode real PII or credentials in fixtures.

## Invariants

- DB integration tests require explicit `TEST_DATABASE_URL`.
- Skipped DB tests must be reported honestly.

## Tests that protect this module

Future extracted API integration and e2e tests.

## Future extension points

Split current `app.test.ts` into focused integration/e2e suites.

## Non-goals

No runtime dependency wiring outside tests.
