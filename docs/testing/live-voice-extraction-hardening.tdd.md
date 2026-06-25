# Live voice extraction hardening — TDD evidence

## Scope

Derived from the observed live-voice failure: Vietnamese final turns could be visible while the
server-authoritative summary remained unfilled, and the hybrid LLM extractor could not supplement
an incomplete deterministic parse.

## Guarantees

| # | Guarantee | Test target | Result |
| --- | --- | --- | --- |
| 1 | A high-confidence LLM proposal can add a valid passenger count and supported pickup to an incomplete draft. | `append-transcript-turn.test.ts` | PASS |
| 2 | Route/date/time proposals are admitted only when they identify exactly one scheduled catalogue departure. | `append-transcript-turn.test.ts` | PASS |
| 3 | Low-confidence values and unsupported pickup text remain unresolved. | `append-transcript-turn.test.ts` | PASS |
| 4 | LLM proposals cannot set contact, price, inventory, payment, confirmation, risk, proof, or receipt state. | code guard + product contract | PASS |

## RED → GREEN

1. RED: the focused API test failed because `mergeValidatedCandidateFacts` was not exported.
2. GREEN: implemented same-turn, confidence, catalogue, supported-pickup, and exact-departure
   guards; reran the focused test with all eight cases passing.
3. A route-normalization test then exposed a missing normalizer import/type reference. The focused
   test and API typecheck were rerun after correction and passed.

## Commands run

```text
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/commands/append-transcript-turn.test.ts
corepack pnpm --filter @call-to-cash/api test
corepack pnpm --filter @call-to-cash/api lint
corepack pnpm --filter @call-to-cash/api typecheck
```

Database-backed API tests remain skipped when `TEST_DATABASE_URL` is not configured. This change
does not add a database schema, endpoint, event, or environment variable.
