# Live parser summary hardening - TDD evidence

## Scope

As a live Agora caller, I can speak natural Vietnamese final turns and see the
server-authoritative decision summary update from validated booking/risk state, not only from
seed/replay phrasing.

This slice does not add an endpoint, event name, database migration, environment variable,
payment behavior, provider authority, proof behavior, or receipt behavior.

## Guarantees

| Guarantee                                                                                                                                                                                          | Test target                             | Result |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ |
| LLM candidate diagnostics persist missing and ambiguous fields instead of empty arrays.                                                                                                            | `append-transcript-turn.test.ts`        | PASS   |
| `transcript.analysis.updated` validates against the shared event schema and contains only privacy-safe booking projection data.                                                                    | `append-transcript-turn.test.ts`        | PASS   |
| Frontend consumes `transcript.analysis.updated` into the AI decision summary without storing raw phone data.                                                                                       | `serverSimulationState.test.js`         | PASS   |
| High-confidence LLM proposals remain same-turn, confidence-gated, catalogue/supported-pickup validated, and cannot set payment/state/proof/receipt authority.                                      | existing Phase 10/live hardening tests  | PASS   |
| Phase 10.5 CSV schedule fixture is Excel-editable, uses strict ISO service dates/timezone/service codes, and validates 96 scheduled rows plus cancelled controls.                                  | `prisma/schedule-fixture.test.ts`       | PASS   |
| Deterministic parser accepts arbitrary catalogue routes, destination-before-origin phrasing, route-derived pickup, masked contact, and avoids treating clock minutes as seats.                     | `replay-extractor.test.ts`              | PASS   |
| Hybrid LLM pickup proposals validate against catalogue-derived pickup points instead of a fixed hardcoded list.                                                                                    | `append-transcript-turn.test.ts`        | PASS   |
| Imported schedule-style rows drive authoritative booking summary, fare/deposit, active inventory hold, and payment remains blocked before agreement confirmation.                                  | `app.test.ts` with `TEST_DATABASE_URL`  | PASS   |
| Phase 11 anchor reads fixture-backed PostgreSQL departures and seeded inventory holds, rejects cancelled/out-of-window alternatives, persists a real offer, and accepts with a transactional hold. | `prisma/catalogue-revenue-twin.test.ts` | PASS   |

## Focused checks run

```text
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/commands/append-transcript-turn.test.ts
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/replay/replay-extractor.test.ts
.\node_modules\.bin\tsx.CMD --test prisma\schedule-fixture.test.ts
.\node_modules\.bin\tsx.CMD --test prisma\catalogue-revenue-twin.test.ts
corepack pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext prisma/schedule-fixture.ts prisma/schedule-fixture.test.ts prisma/seed.ts
corepack pnpm --filter @call-to-cash/web exec node --experimental-test-module-mocks --test src/features/simulation/hooks/serverSimulationState.test.js
corepack pnpm --filter @call-to-cash/shared exec tsx --test src/phase10-extraction.test.ts
corepack pnpm --filter @call-to-cash/ai test
corepack pnpm --filter @call-to-cash/api test
corepack pnpm --filter @call-to-cash/web test
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; corepack pnpm --filter @call-to-cash/api test
```

`.\node_modules\.bin\tsc.CMD -p apps\api\tsconfig.json --noEmit` now passes after moving local
debug helpers out of `apps/api/src` and restoring the live voice dependency-injection surface.
