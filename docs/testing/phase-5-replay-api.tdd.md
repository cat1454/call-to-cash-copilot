# Phase 5 replay API, durable SSE, and mock transaction slice — TDD evidence

## Scope

Phase 5 adds the server-authoritative replay API on top of the Phase 4 PostgreSQL model:

- call creation, reads, and completion;
- persisted final transcript turns with deterministic replay extraction and risk scoring;
- durable per-call canonical events with ordered SSE replay and `Last-Event-ID`;
- immutable agreement locking;
- idempotent deterministic mock payment creation and verification;
- one proof and Trust Receipt per successful verification;
- persisted mismatch/manual-review handling and a demo-only tamper comparison copy.

The web REST/SSE adapter, authentication/RBAC, Agora, Solana, optional LLM extraction, Redis, and object storage remain later phases.

## RED

| Step | Command | Expected failure |
|---|---|---|
| RED 1 | `corepack pnpm --filter @call-to-cash/api test` | Failed because Phase 5 DB/service imports and business routes did not exist. |
| RED 2 | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test` | Failed because SSE closed after replay and mismatch updates rolled back with the HTTP error. |
| RED 3 | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test` | Failed because verification did not yet enforce idempotency-key replay and payload-conflict rules. |
| RED 4 | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test` | Failed because booking confirmation required an idempotency header but did not reject changed payload reuse. |
| RED 5 | `corepack pnpm --filter @call-to-cash/domain test` | Failed until post-issuance proof mismatch transitions were represented in the centralized booking/receipt state tables. |

The tests target the highest-risk invariants:

- external input is validated by shared schemas and cannot set authoritative state;
- transcript state commits before events are visible;
- event IDs and per-call sequences survive reconnect;
- the regular SSE response remains open and emits post-subscription commits;
- confirmation, payment creation, and payment verification are idempotent;
- definitive mismatch evidence commits before the API returns an error;
- successful verification creates exactly one transaction, proof, and receipt;
- tamper comparison never mutates the locked canonical agreement;
- receipt/event projections exclude raw phone, transcript, and canonical agreement payload.

## GREEN

| Check | Command | Result |
|---|---|---|
| API typecheck | `corepack pnpm --filter @call-to-cash/api typecheck` | Pass |
| API lint | `corepack pnpm --filter @call-to-cash/api lint` | Pass |
| API PostgreSQL integration | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test` | Pass; 7/7 tests |
| DB PostgreSQL integration | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/db test` | Pass; 5/5 tests |
| Shared/domain contracts | `corepack pnpm --filter @call-to-cash/shared test` and `corepack pnpm --filter @call-to-cash/domain test` | Pass; 8/8 and 9/9 tests |
| Workspace gates | `corepack pnpm db:validate`, `lint`, `typecheck`, `test`, `build` | Pass |

## Notes

- Phase 5 reuses append-only `audit_logs` rows with `aggregate_type = CALL_STREAM` as its lightweight transactional event log, so it requires no database migration.
- PostgreSQL advisory transaction locks serialize sequence allocation for each call.
- Confirmation and mock verification store only idempotency-key hashes and request fingerprints in audit/verification metadata; raw keys are not persisted.
- The normal SSE endpoint stays open and polls committed event rows; `?snapshot=true` is a finite testing/recovery surface.
- The root `format:check` still reports pre-existing Prettier drift in 25 untouched files. All Phase 5 TypeScript/JSON files pass a targeted Prettier check.
- Coverage percentage is not claimed because the workspace has no configured `test:coverage` command or threshold.
