# Phase 10 strict-schema LLM extraction - TDD evidence

## Discovery

- Canonical ingress: `appendTranscriptTurn` handles one durable final transcript turn in a
  serializable transaction. Only `CUSTOMER` turns reach booking extraction.
- Existing deterministic extractor: `replay-extractor.ts`; its catalogue-backed facts remain the
  booking input and default fallback.
- Persistence: `booking_extractions` already has JSON payload, confidence, status, source-turn
  sequence range, and extractor version fields. No migration is required for this first slice.
- Provider decision: `AI_PROVIDER=openai` with `OPENAI_MODEL=gpt-5-mini` is the approved,
  server-only optional provider. It uses the Responses API structured JSON-schema transport;
  deterministic extraction remains the default and the fallback.

## Guarantees

| Guarantee | Test target | Status |
| --- | --- | --- |
| Unknown, authority, raw-reasoning, invalid-confidence, invalid-ID, and empty-evidence output is rejected. | `packages/shared/src/phase10-extraction.test.ts` | PASS |
| Deterministic extraction is the default and fallback. | `packages/ai/src/ai.test.ts` | PASS |
| Valid structured output, ambiguous output, unavailable provider, cross-turn evidence, and abort are handled safely. | `packages/ai/src/ai.test.ts` | PASS |
| Only customer turns reach booking extraction; LLM candidates cannot bypass deterministic corroboration. | `apps/api/src/modules/call-session/commands/append-transcript-turn.test.ts` | PASS |

## Focused checks run

| Command | Result |
| --- | --- |
| `corepack pnpm --filter @call-to-cash/shared exec tsx --test src/phase10-extraction.test.ts` | PASS - 3/3 |
| `corepack pnpm --filter @call-to-cash/config test` | PASS - 14/14 |
| `corepack pnpm --filter @call-to-cash/ai build && corepack pnpm --filter @call-to-cash/ai test` | PASS - 6/6 |
| `corepack pnpm --filter @call-to-cash/api typecheck` | PASS |
| `corepack pnpm --filter @call-to-cash/api test` | PASS - 23 passed, 10 skipped because `TEST_DATABASE_URL` is not configured |

## Remaining validation

Dependencies were installed with `corepack pnpm install --frozen-lockfile`. No live provider,
root test/build, Docker, database migration, or browser/provider smoke test has run in this
environment. DB-backed API tests require a separate `TEST_DATABASE_URL`.

The existing API lint debt in `replay-extractor.ts` was intentionally left untouched because that
file was dirty before this Phase 10 slice and is outside the feature boundary.
