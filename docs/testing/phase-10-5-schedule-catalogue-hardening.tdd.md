# Phase 10.5 Schedule Catalogue Hardening TDD Evidence

Date: 2026-06-25

## Scope

- Replaced the older month/day schedule fixture contract with strict Excel-editable CSV inputs:
  `trip-schedule-demo.csv`, `pickup-point-demo.csv`, `trip-inventory-demo.csv`,
  `revenue-twin-demand-demo.csv`, and `revenue-twin-policy-demo.csv`.
- Kept the existing `trip_departures` database model unchanged. The importer validates rich
  catalogue rows and maps them into the current table through `tripScheduleRowToDepartureSeed`.
- Added 96 scheduled demo departures and 24 cancelled negative controls across four routes and six
  future service dates.
- Added route/pickup/operator metadata support for Phase 11 snapshots without giving browser or LLM
  authority over price, capacity, pickup, discount, or inventory.
- Added a server-derived `pickupPointId` constraint to the shared Revenue Twin demand contract so
  pickup-incompatible same-route alternatives are rejected before ranking. Fixture pickup codes stay
  operator-editable (`HUE_TERMINAL`) and are mapped to runtime IDs (`pickup_HUE_TERMINAL`) by the API
  adapter.
- Added an executable schedule resolution contract: `MATCHED`, `NEEDS_CLARIFICATION`, and
  `NO_MATCH`. Only `MATCHED` carries a departure ID; safe reason codes cover missing route/date/time,
  ambiguous time, not-found departures, cancelled departures, and unsupported pickups.
- The inventory fixture now seeds the existing `inventory_holds` authority as deterministic
  `CONSUMED` and `ACTIVE` holds inside the same catalogue transaction; no `availableSeats` column
  was introduced.

## Tests Run

### 2026-06-25 follow-up hardening

```text
.\node_modules\.bin\tsx.CMD --test apps\api\src\modules\booking\commands\upsert-booking-from-facts.test.ts
```

Result: pass, 2 tests. Added regression coverage that booking draft resolution assigns a
catalogue departure only when the schedule match is unique; a same-route, same-time input across
multiple service dates remains unresolved until the customer supplies a clarifying date.

```text
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

Result: pass. Root `pnpm test` ran without `TEST_DATABASE_URL`, so DB-backed API and DB package
cases were skipped in that aggregate run. The current local Docker/PostgreSQL service was not
running (`ECONNREFUSED`), so the 0-skipped DB-backed catalogue proof below must be rerun after
starting Postgres before treating the phase as complete in this workspace.

Latest DB rerun on the local test database:

```text
$env:DATABASE_URL='postgresql://call_to_cash:call_to_cash@localhost:55400/call_to_cash_test?schema=public'; corepack pnpm db:migrate:deploy
$env:DATABASE_URL='postgresql://call_to_cash:call_to_cash@localhost:55400/call_to_cash_test?schema=public'; corepack pnpm db:validate
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@localhost:55400/call_to_cash_test?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; .\node_modules\.bin\tsx.CMD --test prisma\catalogue-revenue-twin.test.ts
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@localhost:55400/call_to_cash_test?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; corepack pnpm --filter @call-to-cash/db test
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@localhost:55400/call_to_cash_test?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; corepack pnpm --filter @call-to-cash/api test
```

Result: pass. Migrations applied, schema validated, catalogue regression passed 4 tests with
0 skipped, DB package passed 6 tests with 0 skipped, and API passed 65 tests with 0 skipped.
The suites were run sequentially because they share the same PostgreSQL test database and can
deadlock or create fixture races if run in parallel.

```text
.\node_modules\.bin\tsx.CMD --test prisma\schedule-fixture.test.ts
```

Result: pass, 6 tests.
Latest result: pass, 8 tests. Added row-numbered negative coverage for invalid service date,
invalid local time, invalid timezone, invalid operator relation, invalid status, negative capacity,
negative fare, unknown pickup, unknown policy, and cancelled control-row mapping.

```text
Import-Csv prisma\fixtures\trip-schedule-demo.csv
```

Result: `scheduled=96 cancelled=24 total=120`.

```text
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; .\node_modules\.bin\tsx.CMD --test prisma\catalogue-revenue-twin.test.ts
```

Result: pass, 2 tests, 0 skipped. Covered idempotent fixture DB seed, rollback on a later
database natural-key violation, and the DAD-NHA Phase 11 anchor from real `trip_departures` through
persisted offer acceptance and transactional hold creation.
Latest result: pass, 4 tests, 0 skipped. Added DB-backed proof that expired holds do not reduce
availability, stale inventory versions require reevaluation without creating a hold, and expired
offers cannot create accepted holds.

```text
corepack pnpm --filter @call-to-cash/shared test
```

Result: pass, 27 tests. Includes the schedule resolution contract test.

```text
corepack pnpm --filter @call-to-cash/domain test
```

Result: pass, 15 tests. Added deterministic pickup-compatibility filtering coverage.

```text
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; corepack pnpm --filter @call-to-cash/db test
```

Result: pass, 6 tests, 0 skipped.

```text
.\node_modules\.bin\tsx.CMD --test apps\api\src\modules\revenue-twin\voice-selection.test.ts
```

Result: pass, 5 tests.

```text
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; .\node_modules\.bin\tsx.CMD --test apps\api\src\app.test.ts
```

Result: pass, 24 tests, 0 skipped.

```text
$env:TEST_DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; $env:DATABASE_URL=$env:TEST_DATABASE_URL; corepack pnpm --filter @call-to-cash/api test
```

Result: pass, 63 tests, 0 skipped.

```text
.\node_modules\.bin\tsx.CMD --test apps\api\src\modules\call-session\commands\append-transcript-turn.test.ts
```

Result: pass, 14 tests. Includes `MATCHED`, `NEEDS_CLARIFICATION`, `NO_MATCH`,
`DEPARTURE_CANCELLED`, and `PICKUP_NOT_SUPPORTED` resolver coverage.

```text
corepack pnpm --filter @call-to-cash/web test
```

Result: pass, 72 tests.

```text
.\node_modules\.bin\tsc.CMD -p apps\api\tsconfig.json --noEmit
```

Result: pass.

```text
corepack pnpm --filter @call-to-cash/shared typecheck
corepack pnpm --filter @call-to-cash/domain typecheck
corepack pnpm --filter @call-to-cash/api typecheck
```

Result: pass after rebuilding `@call-to-cash/shared` so downstream packages consumed the updated
Revenue Twin demand contract.

```text
.\node_modules\.bin\prisma.CMD validate --schema prisma\schema.prisma
```

Result: pass.

```text
$env:DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; corepack pnpm db:validate
$env:DATABASE_URL='postgresql://call_to_cash:call_to_cash@127.0.0.1:55400/call_to_cash?schema=public'; corepack pnpm db:migrate:deploy
```

Result: pass; schema valid and no pending migrations.

```text
node --check scripts\prebuild-install.mjs
node scripts\prebuild-install.mjs
node --test tests\workspaceStructure.test.js tests\packageRuntimeExports.test.js
```

Result: pass. The root `prebuild` lifecycle now uses a guard script that no-ops when pnpm
workspace dependencies are already installed, preventing nested pnpm lifecycle builds from
recreating `node_modules` during normal `pnpm build`.

```text
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

Result: pass. Root `pnpm test` intentionally ran without `TEST_DATABASE_URL`, so DB-backed API
cases were skipped there; the DB/API package runs above provide the 0-skipped PostgreSQL proof.
`pnpm typecheck` and `pnpm build` both produced the existing Vite chunk-size warning for the web
bundle and exited successfully.

## Boundary

No endpoint, realtime event, domain state, database migration, environment variable, payment
behavior, or live Agora claim was added.
