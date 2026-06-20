# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-20 (Asia/Saigon)
> **Branch / commit inspected:** `develop` / `6337227` (`Merge pull request #7 from cat1454/feat/phase-7`)
> **Purpose:** refresh the project baseline after the Phase 7 merge and identify the next safe implementation slice.
> **Conclusion:** the backend/domain/database side is now substantially through the replay-first mock payment/proof/receipt slice, but the full product is **not yet Phase 7 complete** because the web API-mode loop is only partially wired and the root quality gate is not green.

---

## 1. Executive summary

The repository has moved far beyond the original frontend-only simulation. It now contains a production-shaped TypeScript backend foundation:

```text
shared contracts
→ deterministic domain kernel
→ Prisma/PostgreSQL durable state
→ Fastify replay API
→ durable per-call SSE stream
→ mock payment verification
→ server-side proof record
→ Trust Receipt
→ demo mismatch/manual-review path
```

The important nuance: **Phase 7 is implemented as backend/API capability, not yet as a fully working browser-driven vertical slice.**

Evidence:

- `packages/shared`, `packages/domain`, `packages/db`, and `apps/api` now contain real TypeScript source and tests.
- `prisma/schema.prisma`, one migration, seed data, and `compose.yaml` exist.
- `apps/api` exposes the replay/payment/receipt endpoints and durable SSE stream.
- `apps/web` contains API/SSE client code and an API-mode branch inside `useCallSimulation`.
- However, the API-mode UI branch does not yet complete the authoritative happy path: it does not call `confirmBooking`, does not retain the server-created payment reference/recipient/amount read model, and currently verifies mock payment with `reference: ""`.

So the current state is best described as:

```text
Backend replay-first mock payment vertical slice: mostly implemented
Frontend API/SSE adapter: partially implemented
Frontend visible demo: still has fixture fallback and incomplete API happy path
External providers: still absent
Quality gate: build/typecheck pass; lint/test/format have current blockers
```

---

## 2. Audit scope and evidence

This report was updated by inspecting:

- repository instructions and ECC workflow metadata;
- git branch, recent commits, workspace manifests, lockfiles, CI, Compose, env examples, and Prisma config;
- `apps/api`, `apps/web`, `packages/shared`, `packages/domain`, `packages/db`, provider package boundaries, and tests;
- product, architecture, API/event/error, security, operations, report, and testing documentation;
- local verification commands available in the current checkout.

ECC skills consulted:

- `ECC/skills/repo-scan/SKILL.md`
- `ECC/skills/production-audit/SKILL.md`
- `ECC/skills/verification-loop/SKILL.md`
- `.agents/skills/call-to-cash-ui-ux/SKILL.md`

Status labels used below:

| Label | Meaning |
|---|---|
| **Implemented** | Source exists and behavior can be exercised or tested locally without inventing missing components. |
| **Partially implemented** | Source exists, but an acceptance-critical path is incomplete or not wired through the main product flow. |
| **Simulated** | UI/provider behavior is deterministic demo/mock behavior, not a real external integration. |
| **Specified** | Documented contract exists, but runtime behavior is absent or incomplete. |
| **Placeholder** | Package boundary exists with minimal or reserved source. |
| **Absent** | Required artifact/capability does not exist in the repository. |

---

## 3. Repository map and implementation status

| Area | Current contents | Status |
|---|---|---|
| Root workspace | pnpm/Turbo monorepo, Node 22, TypeScript, ESLint, Prettier, CI workflow, `.env.example` | **Implemented, with quality drift** |
| `apps/web` | React/Vite demo UI, Tailwind/global styling, API client, SSE client, API-mode hook/reducer, fixture fallback | **Implemented / Partially implemented** |
| `apps/api` | Fastify app, health/readiness, replay commands, SSE stream, mock payment/proof/receipt routes | **Implemented** |
| `packages/shared` | Zod schemas, enums, API envelopes, events, errors, constants, contract tests | **Implemented** |
| `packages/domain` | booking validation, risk scoring, payment gate, state transitions, inventory guards, agreement canonicalization | **Implemented** |
| `packages/db` | Prisma client factory, inventory repository, receipt trace repository, DB tests | **Implemented** |
| `packages/config` | runtime env validation for demo/provider/log/rate-limit config | **Implemented** |
| `packages/ai` | reserved adapter boundary only | **Placeholder** |
| `packages/agora` | reserved adapter boundary only | **Placeholder** |
| `packages/solana` | reserved adapter boundary only | **Placeholder** |
| `prisma/` | schema, migration, seed, config | **Implemented** |
| Local infrastructure | PostgreSQL-only `compose.yaml`; no Redis/MinIO | **Implemented for current DB consumer** |
| CI/CD | GitHub Actions workflow with Postgres service and workspace gates | **Implemented, likely failing until quality drift is fixed** |
| Documentation | product/architecture/contracts/security/operations/testing/report set | **Implemented / needs refresh in places** |

---

## 4. What is now implemented

### 4.1 Shared contracts and domain kernel

`packages/shared` and `packages/domain` now provide the source of truth for core rules:

- public ID schemas and DTO validation;
- API success/error envelopes;
- canonical event names and event envelope validation;
- booking/payment/receipt/proof state enums;
- payment gate thresholds and reason-code behavior;
- deterministic completeness, dispute-risk, and payment-readiness calculations;
- material-change confirmation invalidation;
- centralized state-transition guards;
- canonical agreement serialization with PII-safe output expectations.

This is the major improvement over the original fixture-owned frontend simulation.

### 4.2 Durable PostgreSQL/Prisma state

`prisma/schema.prisma` now defines the main production-shaped entities:

```text
users
call_sessions
consent_records
transcript_turns
trip_departures
inventory_holds
bookings
booking_extractions
risk_assessments
agreements
payment_intents
payment_transactions
proof_records
trust_receipts
object_assets
audit_logs
```

There is one migration:

```text
prisma/migrations/20260620131142_phase4_durable_state/migration.sql
```

Important constraints/repositories are present:

- inventory reservations are idempotent and designed to prevent oversell;
- locked agreements, aggregate ownership, and append-only audit rows are protected at the DB/test layer;
- receipt trace projection can follow receipt → proof → payment → agreement → booking → inventory/risk/transcript/call without exposing protected fields.

### 4.3 Fastify replay API and SSE

Implemented endpoints:

```text
GET  /health
GET  /ready
POST /v1/calls
GET  /v1/calls/:callId
POST /v1/calls/:callId/end
POST /v1/calls/:callId/transcript-turns
GET  /v1/calls/:callId/events
GET  /v1/calls/:callId/risk
GET  /v1/bookings/:bookingId
POST /v1/bookings/:bookingId/confirm
POST /v1/payments/mock/create
POST /v1/payments/mock/verify
POST /v1/payments/mock/simulate-failure
GET  /v1/payments/:bookingId/status
GET  /v1/receipts/:receiptId
GET  /v1/receipts/:receiptId/verify
```

Server-authoritative behavior now exists for:

- call creation/end;
- final transcript turn persistence;
- deterministic replay extraction for the currently recognized demo route;
- booking draft update and risk recomputation;
- inventory hold creation;
- explicit agreement confirmation and immutable locked agreement version;
- SHA-256 agreement hash;
- idempotent mock payment intent creation;
- mock payment verification against amount, recipient, and reference;
- proof record and Trust Receipt creation;
- wrong amount/recipient/reference failure;
- expired-intent simulation;
- demo-only receipt mismatch/manual-review verification;
- durable committed SSE events using `audit_logs` rows with `aggregate_type = CALL_STREAM`;
- `Last-Event-ID` replay and `?snapshot=true` recovery/testing surface.

### 4.4 Web UI and API adapter

The polished React/Vite demo UI still exists and has been modernized visually. It now includes:

- explicit demo-mode/provider labels;
- API base URL runtime config;
- `apiClient.js` for REST commands;
- `sseClient.js` for SSE stream consumption with reconnect cursor;
- `useApiMode` health probing and fallback to fixture mode;
- `useServerSimulation` and `serverSimulationState` for an API-driven simulation attempt;
- tests for API client and fetcher hooks.

But the main browser path is not yet a completed authoritative vertical slice. See section 6.

---

## 5. Phase-by-phase assessment

| Pipeline phase | Current assessment | Evidence |
|---:|---|---|
| 0 — Normalize contracts | **Mostly done** | canonical package namespace, SSE terminology, refund policy normalization, explicit demo envs |
| 1 — Make workspace executable | **Implemented with drift** | scripts, CI, TypeScript configs, env example, but root gate currently fails |
| 2 — Shared contracts | **Implemented** | `packages/shared/src/**`, contract tests |
| 3 — Domain kernel | **Implemented** | `packages/domain/src/**`, domain tests |
| 4 — PostgreSQL/Prisma durable state | **Implemented** | schema, migration, seed, repositories, DB tests |
| 5 — Fastify replay API + SSE | **Implemented** | `apps/api/src/app.ts`, `phase5-service.ts`, API tests |
| 6 — Adapt web UI to REST/SSE | **Partially implemented** | clients/hooks exist; main UI has API-mode branch through `useCallSimulation`; read-model/UI parity incomplete |
| 7 — Mock payment/proof/receipt/tamper vertical slice | **Backend implemented; product slice incomplete** | API service supports it; web API mode cannot yet complete happy path end-to-end |
| 8 — Solana devnet | **Not started** | provider package reserved only |
| 9 — Agora live voice/transcript | **Not started** | provider package reserved only |
| 10 — Optional LLM extraction | **Not started** | AI package reserved only |
| 11 — Redis + MinIO/S3 + consent/media | **Not started** | no Redis/MinIO; object asset schema exists only |
| 12 — hardening/observability/deployment | **Partial** | CI, health/ready, CORS/rate-limit exist; auth/RBAC/observability/rollback automation absent |

Bottom line: **it is reasonable to say “Phase 7 backend capability is merged”; it is not accurate to say “Phase 7 product acceptance is complete.”**

---

## 6. Current gaps blocking a true Phase 7 completion claim

### 6.1 Web API mode does not complete the authoritative happy path

`apps/web/src/features/simulation/hooks/useCallSimulation.js` chooses API mode when `/health` responds. However:

1. `useServerSimulation` submits transcript turns, but does not call `confirmBooking`.
2. Without agreement confirmation, the backend payment gate should stay locked.
3. The UI does not retain the full mock payment intent read model after `createMockPayment`.
4. The API-mode `simulateWalletPayment` call passes:

```js
{
  amount: { currency: "VND", minor: 300000 },
  recipient: "mock-recipient-wallet",
  reference: ""
}
```

That empty reference cannot satisfy server verification, because the backend verifies the observed reference against the server-created payment intent reference.

So the backend can issue a receipt through API tests, but the current browser API-mode path is not yet a working Call → Confirm → Payment → Receipt loop.

### 6.2 API-mode read models are still thin

When `apiMode` is true, `useCallSimulation` currently returns many placeholder UI values:

- `bookingData: createInitialBookingData()`
- `performance: createInitialPerformance()`
- `subtitles: { speaker: "", text: "" }`
- `prefetchContent: ""`
- `brainMode: "fast"`

This means the UI does not yet recover the full state from authoritative API read models after refresh/reconnect.

### 6.3 API integration tests were not run against PostgreSQL in this audit turn

`pnpm exec turbo run test` passed, but DB/API integration tests were skipped because `TEST_DATABASE_URL` was not configured in the shell and no local Postgres listener was present at port `55432`.

The committed Phase 4/5 TDD documents state those integration tests have passed previously with `TEST_DATABASE_URL`, but this refreshed audit did not reproduce them locally.

### 6.4 Root quality gate is not green today

Current verification found these blockers:

- `pnpm lint` fails on one unused import:

```text
apps/web/src/features/simulation/components/HeroSubComponents.jsx
1:8  error  'React' is defined but never used
```

- `pnpm test` fails before package tests because `tests/workspaceStructure.test.js` expects no committed `package-lock.json`, but `package-lock.json` exists.
- `pnpm format:check` reports formatting drift in 44 files.
- CI runs `pnpm format:check`, `pnpm lint`, and `pnpm test`, so the current CI workflow is expected to fail unless these drifts are corrected.

---

## 7. What remains simulated or absent

| Capability | Current behavior |
|---|---|
| Agora voice | no Agora SDK/token/channel/STT/live call adapter; replay/demo only |
| AI/LLM extraction | deterministic string/rule extraction in API; `packages/ai` reserved only |
| Solana Pay/devnet | no real Solana payment request, wallet flow, RPC verification, memo/reference adapter, or key handling |
| Mock payment | server-side deterministic mock provider, not blockchain |
| Proof anchor | DB/server attestation with SHA-256 hash; no on-chain anchor |
| Auth/RBAC | absent; no ownership authorization for API reads/mutations |
| Consent enforcement | schema exists; runtime consent gates/jobs are not implemented |
| Retention jobs | absent |
| Redis queues/locks | absent; current event stream uses DB polling/audit rows |
| Object storage | object asset schema exists; MinIO/S3 integration absent |
| Production observability | minimal logs/health/ready only; no tracing/metrics/dashboard |
| End-to-end browser test | absent; no Playwright/Cypress/browser API-mode receipt recovery test |

---

## 8. Quality and verification status

Commands run during this audit:

| Command | Result |
|---|---|
| `pnpm install; pnpm rebuild esbuild` with `NODE_EXTRA_CA_CERTS=D:\tmp\windows-trusted-roots.pem` | **Pass** |
| `pnpm db:validate` | **Pass** |
| `pnpm typecheck` | **Pass** |
| `pnpm build` | **Pass** |
| `pnpm exec turbo run test` | **Pass**, package tests only; DB/API integration cases skipped without `TEST_DATABASE_URL` |
| `pnpm lint` | **Fail**, unused `React` import in `HeroSubComponents.jsx` |
| `pnpm test` | **Fail**, root workspace structure test rejects committed `package-lock.json` |
| `pnpm format:check` | **Fail**, 44 files with Prettier drift |
| `Get-NetTCPConnection -LocalPort 55432 -State Listen` | **No listener found**, so local Postgres integration was not run |

Package test result from `pnpm exec turbo run test`:

- config: 7 passed
- shared: 8 passed
- domain: 9 passed
- web: 25 passed
- db: 5 skipped because `TEST_DATABASE_URL` not configured
- api: 3 passed, 4 skipped because `TEST_DATABASE_URL` not configured
- ai/agora/solana: 0 tests each

Build result:

```text
10 successful build tasks
apps/web dist:
  index.html                 1.08 kB
  index-BeDV0Cha.css        45.95 kB
  index-CW58uNCY.js        322.28 kB
```

Note: the first pnpm verification attempts failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. The audit did not disable TLS verification; dependency restore succeeded only after using the existing Windows trusted roots bundle via `NODE_EXTRA_CA_CERTS`.

---

## 9. Current production-readiness view

Production audit: **62/100, risky/internal-demo only**.

Why the score is capped:

- no auth/RBAC on sensitive transaction APIs;
- no real payment provider verification;
- no real Agora/voice provider;
- no browser E2E proving API-mode happy path and refresh recovery;
- CI-quality gates are currently failing;
- DB integration tests were not rerun locally in this audit.

Strengths:

- core domain/payment-gate/proof logic has moved server-side;
- durable schema and API shape are credible;
- privacy-safe projections are explicitly tested in unit/integration code;
- provider adapters are still isolated rather than prematurely coupled to UI state.

---

## 10. Recommended next implementation slice

Do not start Solana devnet or Agora yet. The next smallest valuable slice is:

```text
Finish Phase 6/7 browser API-mode wiring
→ fix quality drift
→ rerun Postgres-backed integration
→ add one browser/API vertical-slice test
```

Ordered backlog:

| Priority | Work item | Why now |
|---:|---|---|
| P0 | Remove the accidental `package-lock.json` or update the workspace guard if intentionally kept | Root `pnpm test` currently fails before package tests |
| P0 | Remove unused `React` import in `HeroSubComponents.jsx` | Root `pnpm lint` currently fails |
| P0 | Run/fix `pnpm format:check` drift intentionally | CI currently expected to fail |
| P0 | Start local Postgres and rerun `db:migrate:deploy`, `db:seed`, DB/API integration with `TEST_DATABASE_URL` | Reproduce Phase 7 server claims in this checkout |
| P0 | Wire API-mode UI through `confirmBooking` before payment creation | Current web API mode cannot open the gate authoritatively |
| P0 | Store and use server mock payment intent `amount`, `recipient`, and `reference` in UI state | Current API-mode verify uses `reference: ""` and should fail closed |
| P0 | Hydrate booking/payment/receipt read models after REST/SSE updates | Needed for refresh/recovery and user-visible server authority |
| P1 | Add browser interaction/E2E test for API mode happy path and mismatch path | Proves Phase 7 product acceptance, not just backend capability |
| P1 | Add explicit API-mode fallback/error UI | Prevents silent fixture/API confusion |
| P1 | Add auth/RBAC design and first enforcement layer | Required before any production/staging exposure |
| P2 | Solana devnet adapter | Only after mock server-authoritative path is complete |
| P2 | Agora replay-to-live transcript adapter | Only after replay path is stable |

---

## 11. Updated acceptance status for the first vertical slice

| Acceptance target | Current status |
|---|---|
| deterministic transcript replay creates durable call/booking draft | **Implemented in API; integration not rerun locally** |
| required booking fields/provenance validated by shared/domain schemas | **Implemented** |
| risk scores calculated from facts, not fixture totals | **Implemented in API/domain** |
| missing pickup/policy/hold/confirmation keeps gate locked | **Implemented in domain/API tests** |
| explicit confirmation locks immutable agreement version and SHA-256 hash | **Implemented in API** |
| mock payment intent only from locked agreement/open gate | **Implemented in API** |
| repeated create/verify requests are idempotent | **Implemented in API tests; integration skipped locally this turn** |
| correct mock payment creates one proof and one Trust Receipt | **Implemented in API tests; integration skipped locally this turn** |
| changed agreement copy returns mismatch/manual review without mutating locked snapshot | **Implemented in API tests; integration skipped locally this turn** |
| existing mobile UI receives progression through REST/SSE | **Partially implemented; not complete** |
| no raw phone/transcript/agreement payload in proof/events/log projections | **Partially tested; needs broader snapshots** |
| CI passes unit, transition, contract, repository, and vertical-slice tests | **Not currently true** |

---

## 12. Change summary for this report

- **Documentation consulted:** `AGENTS.md`, `CLAUDE.md`, `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md`, `docs/contracts/API-CONTRACT.md`, `docs/contracts/EVENT-CONTRACT.md`, `docs/contracts/ERROR-CODES.md`, `docs/architecture/STATE-MACHINES.md`, `docs/architecture/DATA-MODEL.md`, `docs/architecture/DECISIONS.md`, `docs/architecture/PIPELINE.md`, `docs/product/BOOKING-CONTRACT.md`, `docs/product/RISK-SCORING.md`, `docs/operations/LOCAL-SETUP.md`, `docs/operations/DEPLOYMENT.md`, `docs/operations/INCIDENT-RUNBOOK.md`, `docs/operations/ECC-AGENT-WORKFLOW.md`, `docs/testing/phase-3-domain-kernel.tdd.md`, `docs/testing/phase-4-persistence.tdd.md`, `docs/testing/phase-5-replay-api.tdd.md`, previous `docs/report/CURRENT-STATE.md`, and ECC skill metadata listed in section 2.
- **Documentation updated:** `docs/report/CURRENT-STATE.md` only.
- **Files changed:** `docs/report/CURRENT-STATE.md`.
- **Contracts changed:** none in this report.
- **Database migration required:** no.
- **Environment variables added/changed:** none.
- **Tests run:** `pnpm install` with trusted CA, `pnpm db:validate`, `pnpm typecheck`, `pnpm build`, `pnpm exec turbo run test`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and a local Postgres port check.
- **Remaining TODOs or mocked integrations:** web API-mode completion, root quality drift, DB-backed integration rerun, auth/RBAC, Solana, Agora, optional LLM extraction, Redis, object storage, observability, retention jobs, deployment hardening, and browser E2E coverage.
