# Phase 4 PostgreSQL, Prisma, inventory, and durable state — TDD evidence

## Scope

Phase 4 implements the durable PostgreSQL/Prisma boundary, reviewed migration, deterministic seed, inventory hold repository, and privacy-safe receipt trace projection. API routes, SSE/outbox delivery, replay orchestration, mock payment vertical slice, Solana, Agora, Redis, and object storage remain later phases.

## RED

| Step | Command | Expected failure |
|---|---|---|
| RED | `corepack pnpm --filter @call-to-cash/db test` | Failed before implementation because the new repository tests imported missing Phase 4 exports from `packages/db/src/index.ts`. |

The first tests were written around the highest-risk persistence invariants:

- concurrent holds cannot oversell one departure;
- inventory idempotency keys return the original hold and reject changed input;
- server-time expiry releases availability and appends audit evidence;
- receipt trace reaches call/transcript/risk/payment/proof records without returning encrypted phone, raw transcript, or canonical payload;
- database constraints reject locked-agreement mutation, cross-booking aggregate links, and audit-log mutation.

## GREEN

| Check | Command | Result |
|---|---|---|
| Prisma schema | `corepack pnpm db:validate` | Pass |
| Clean migration | `corepack pnpm --filter @call-to-cash/db migrate:deploy` against `call_to_cash_phase4_clean` | Pass; one migration applied |
| Seed idempotency | `corepack pnpm --filter @call-to-cash/db seed` twice | Pass; deterministic departure count remains 1 |
| DB integration | `TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/db test` | Pass; 5/5 PostgreSQL tests |
| Full test suite | `TEST_DATABASE_URL=... corepack pnpm test` | Pass; 47 non-empty tests, 0 failed |
| Build | `corepack pnpm build` | Pass |

## Notes

- The root `format:check` command still reports pre-existing formatting drift outside the Phase 4 slice. Phase 4 touched files were formatted with Prettier and `prisma format`.
- Coverage percentage is not claimed because the workspace still has no `test:coverage` command or configured threshold.
- Docker Compose runs PostgreSQL only. Redis/MinIO are intentionally deferred until their first consumers exist.
