# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-20 (Asia/Saigon)  
> **Branch / commit inspected:** `main` / `7651e7a` (`refactor: move app into pnpm monorepo`)  
> **Purpose:** establish an evidence-based baseline for choosing the first production implementation slice.  
> **Conclusion:** the mobile/desktop frontend demo is functional and presentable; the production transaction system behind it has not been implemented.

---

## 1. Executive summary

The repository currently contains two very different levels of maturity:

1. **A working React/Vite demo UI** that can replay scripted calls, animate risk scores, open a simulated payment drawer, issue a simulated receipt, and demonstrate a tamper mismatch on mobile and desktop.
2. **A detailed production-shaped specification** for privacy, APIs, realtime events, state machines, data, risk scoring, payment verification, and operations.

There is not yet an implemented bridge between those two levels. `apps/api` and every domain package under `packages/*` are placeholders with no source exports or runtime dependencies. There is no database schema, migration, API route, SSE stream, Agora adapter, AI extraction/scoring package, Solana verifier, server-side proof, authentication, or deployment stack.

Therefore, the correct description of the product today is:

```text
Completed frontend simulation
+ comprehensive target contracts
- server authority
- durable state
- real provider integrations
= presentation-ready demo, not yet an end-to-end MVP
```

The next implementation should **not** begin with more UI work, live Agora, or real Solana. It should begin by normalizing the contracts and implementing the shared deterministic domain kernel used by both demo mode and future live mode.

---

## 2. Audit scope and evidence

This report was produced by inspecting:

- root workspace configuration, lockfile, repository instructions, and git state;
- the complete `apps/web` source tree, PWA assets, fixtures, and tests;
- manifests and READMEs for `apps/api` and all `packages/*` boundaries;
- product, architecture, API/event/error, security, operations, design, maintainability, and roadmap documents;
- the V6 hackathon proposal DOCX at the repository root;
- available test commands and local toolchain behavior.

Status labels used below:

| Label | Meaning |
|---|---|
| **Implemented** | Source exists and the behavior can be exercised locally without inventing missing components. |
| **Simulated** | UI behavior exists, but values/decisions/providers are fixtures or browser-side effects. |
| **Specified** | A contract/document exists, but no corresponding runtime implementation exists. |
| **Placeholder** | Package/directory boundary exists with only manifest/README content. |
| **Absent** | Required artifact or capability does not exist in the repository. |

### Repository operating context

- `ECC/` is now a local, separately versioned clone of `https://github.com/affaan-m/ECC` at commit `34faa39`. It supplies an upstream catalog of skills, commands, agents, rules, and docs. It is excluded from the pnpm workspace; the parent repository tracks only its pinned gitlink, not ECC file contents.
- Root agent instructions route tasks to ECC by scanning skill metadata first and reading only selected `SKILL.md` files. The nested ECC catalog is not assumed to be auto-loaded by every agent runtime.
- `.agents/` remains reserved for project-level runtime-discovered skills. `.codex/AGENTS.md` and `.gemini/GEMINI.md` contain tool-specific instructions.
- The working tree was already dirty during this audit: `AGENTS.md` and `CLAUDE.md` were modified, while the architecture/contracts/operations/product/report/security document trees were untracked.
- The current documentation set should therefore be treated as a strong local design baseline, but not yet as a committed repository baseline.

---

## 3. Repository map and implementation status

| Area | Current contents | Status |
|---|---|---|
| Root workspace | pnpm workspace, Turbo tasks, lockfile, root commands | **Implemented** |
| `apps/web` | React 19 + Vite 8 JavaScript app, responsive UI, fixtures, PWA assets, tests | **Implemented / Simulated** |
| `apps/api` | `package.json` and README only; no `src/`, scripts, framework, or dependencies | **Placeholder** |
| `packages/shared` | manifest and README only | **Placeholder** |
| `packages/ai` | manifest and README only | **Placeholder** |
| `packages/db` | manifest and README only | **Placeholder** |
| `packages/agora` | manifest and README only | **Placeholder** |
| `packages/solana` | manifest and README only | **Placeholder** |
| `packages/config` | manifest and README only | **Placeholder** |
| `prisma/` | no schema or migrations | **Absent** |
| Local infrastructure | no Compose file, `.env.example`, bootstrap, or health checks | **Absent** |
| CI/CD | no `.github/workflows` | **Absent** |
| Documentation | extensive target architecture and contracts | **Specified** |
| `ECC/` agent tooling | local upstream clone plus project-specific routing guide | **Configured, separate repository** |
| Automated tests | workspace shape and browser-simulation helper/model tests | **Implemented, narrow scope** |

No `node_modules` directory was present at the repository root or in `apps/web` at audit time.

---

## 4. What the frontend demo already delivers

### 4.1 Product experience

`apps/web` provides a coherent hackathon presentation flow:

- desktop mentor console with a customer phone mockup, transcript replay, risk telemetry, decision panel, timeline, and ledger panel;
- mobile-native layout at `<= 768px` with Call, Dashboard, and Receipt tabs;
- three deterministic scripted booking scenarios;
- animated transcript turns and call status;
- booking extraction display for route, time, passenger count, phone, price, and deposit;
- completeness, dispute-risk, and payment-readiness score animations;
- simulated payment drawer and reservation countdown;
- simulated receipt issuance;
- tamper action that changes route/seats and displays a proof mismatch;
- reset, scenario selection, responsive styling, and source-file maintainability guardrails.

The styling mostly follows the current light/green V6 design tokens. Source files are modularized below the enforced 300-line test cap.

### 4.2 Current browser-side flow

```text
scenario fixture
  → setTimeout-driven transcript replay
  → fixture-provided entities/scores/timeline
  → fixture gateUnlocked flag
  → simulated payment drawer
  → timed fake wallet/network messages
  → browser-generated mock transaction/hash
  → receipt UI
  → optional browser-state tamper → mismatch UI
```

Shared demo state lives in `useCallSimulation` and is passed into the mobile and desktop views through `App.jsx`. Timeout and interval cleanup helpers are present.

### 4.3 PWA support

The frontend includes:

- a web app manifest;
- 192px/512px icons;
- service-worker registration;
- app-shell caching and same-origin stale-while-revalidate behavior.

This is a useful PWA scaffold, but offline behavior is not fully verified. The payment QR is fetched from the external `api.qrserver.com` service and is not available through the same-origin service-worker cache. Production build assets are runtime-cached rather than explicitly precached from a generated asset manifest.

### 4.4 Frontend test coverage

Current tests verify:

- expected monorepo/package boundaries;
- Vite app location and root command surface;
- stable behavior of the mock hash and tamper mismatch;
- mobile dashboard gate presentation and phone masking;
- source files remain under 300 lines;
- source text has no known mojibake signatures.

The tests do not cover rendered React interactions, accessibility, viewport screenshots, service-worker behavior, API contracts, state transitions, risk formulas, idempotency, persistence, or real payment/proof verification.

---

## 5. What is simulated rather than implemented

The current UI must not be mistaken for a connected system.

| Capability shown in UI | Actual current behavior |
|---|---|
| Agora network “active” | Static status badge; no Agora SDK, token, channel, microphone, STT, webhook, or reconnect logic |
| AI extraction | Booking fields are copied from scenario fixtures |
| Risk scoring | Scores are hard-coded per scenario step; documented formulas are not executed |
| Payment gate | Opens from fixture property `gateUnlocked`; no centralized guard evaluator |
| Inventory | Prefetch text is simulated; no inventory source or hold record |
| Price/policy | Hard-coded display strings; no authoritative pricing/policy service |
| Solana Pay QR | Static externally generated QR with fixed `solana:pubkey?amount=0.05...` data |
| Wallet/payment | Button starts timed messages; no wallet connection, transaction, RPC, webhook, or reconciliation |
| Transaction signature | Random browser string |
| Agreement proof | Non-cryptographic browser hash labeled as a Solana proof |
| Receipt | Browser state only; no durable receipt ID or authorization |
| Tamper detection | Changes the same browser object and compares mock hashes |
| Realtime events | Local React setters only; no SSE/WebSocket transport |
| Persistence | Refresh/reset loses all state |

There is also no explicit `DEMO_MODE=true` configuration. The UI currently displays provider-connected language without a runtime-visible distinction between simulation and production, which conflicts with the documented Demo Mode Policy.

---

## 6. Contract-to-code alignment gaps

### 6.1 Payment gate and booking agreement — critical

The product contract requires route, departure, passengers, pickup point, contact, server pricing, deposit, refund policy, active inventory hold, and explicit confirmation against the current agreement version.

The browser booking object currently contains only:

```text
bookingId, route, time, seats, phone, price, deposit
```

It has no pickup point, inventory reservation/expiry, refund policy version/confirmation, provenance, normalized values, agreement version, or explicit-confirmation evidence. Nevertheless, scenario fixtures can set completeness to `100` and open payment.

The UI threshold display is not an authority check: payment opens because a scripted step says `gateUnlocked: true`. The mobile dashboard also treats an already-open payment drawer as evidence that the gate is open, creating a circular presentation rule.

### 6.2 Risk scoring — critical

The documented deterministic formulas, reason-code catalog, critical blockers, evidence references, policy version, and `agent_quality` score are absent. No tests currently prove:

- completeness weighting;
- dispute signal accumulation;
- payment-readiness evidence;
- fail-safe behavior for critical blockers;
- explicit-confirmation invalidation after material changes;
- zero false unlocks in scripted critical cases.

### 6.3 Agreement hash and privacy — critical

`generateMockHash` is a small JavaScript integer hash, not SHA-256. It hashes a display string that includes the raw phone number and mutable formatted values. It has no canonicalization version, stable JSON contract, domain separator, server-controlled salt strategy, agreement version, or immutable storage.

This is acceptable only as a clearly labeled visual mock. It must not be moved unchanged into `packages/solana` or backend code.

Raw seeded phone numbers are also rendered directly in the call view and desktop decision panel. The dashboard model and telemetry panel contain masking helpers, but masking is inconsistent across views.

### 6.4 Payment and receipt — critical

There is no server-created payment intent, opaque reference, recipient/amount/asset verification, expiry worker, replay protection, idempotency key, transaction-signature uniqueness, proof record, or durable trust receipt.

The payment drawer copy says the deposit is refunded **100% when cancelled at least two hours before departure**. The Booking Contract sample says **80% when cancelled at least twelve hours before departure under policy v1.0**. This commercial-policy conflict must be resolved before any payable flow is implemented.

### 6.5 State machines and realtime contracts — major

The documented call, booking, gate, payment, proof, and receipt states do not exist as shared enums or centralized transitions. UI status strings are free-form Vietnamese labels.

No outbox, event envelope, event ordering, replay cursor, correlation ID, or SSE recovery path exists. The canonical API/Event contracts choose SSE for MVP, while some architecture/operations text still says WebSocket or WebSocket/SSE.

### 6.6 Data, operations, and security — major

The following specified foundations are absent:

- PostgreSQL/Prisma schema and repositories;
- Redis queues, locks, replay cursors, and TTL state;
- MinIO/S3 object metadata and retention jobs;
- consent records and recording/training separation;
- authentication/RBAC and audit logs;
- secret/environment validation;
- health/readiness endpoints;
- deployment, migration, rollback, and incident automation.

The operations documents describe a target stack that cannot currently be started from this repository because the referenced Compose, env, Prisma, API, and database scripts do not exist.

---

## 7. Documentation quality and normalization work

The documentation is unusually complete for the implementation stage and provides a strong basis for backend work. It defines:

- privacy/on-chain allowlists and retention expectations;
- 17 REST endpoints plus an SSE endpoint;
- canonical realtime events and error codes;
- call, booking, gate, payment, proof, and receipt state machines;
- a production-shaped relational data model;
- deterministic risk formulas and reason codes;
- an explicit replay-first build strategy;
- deployment and incident-response targets.

Before implementation, the following drift should be normalized in the higher-precedence documents and package manifests:

1. **Broken risk-doc links:** several documents link to `RISK-SCORING.md`; the real canonical file is `RISK-SCORING.md`.
2. **Package namespace mismatch:** contracts refer to `@call-to-cash/*` (and architecture examples use `@call-to-cash/*`), while actual package names are `@call-to-cash/*`.
3. **Realtime terminology:** API/Event contracts select SSE for MVP; some operations/architecture sections still describe WebSocket.
4. **Backend decision ambiguity:** architecture accepts Node as authority and repeatedly references Prisma, while `apps/api/README.md`, `packages/db/README.md`, and the root README say runtime/framework/ORM are undecided.
5. **UI policy mismatch:** refund terms in the payment drawer conflict with the Booking Contract.
6. **Demo transparency:** static UI labels claim Agora/Solana are connected without an explicit demo-mode indicator.
7. **Stale editor rules:** `.cursorrules` uses an older blue palette and obsolete `h:/solona/...` paths, while current docs/code use the green V6 palette and monorepo paths.
8. **PWA manifest drift:** manifest `background_color` and `theme_color` still use the old dark/purple theme.

Because contract documents are currently untracked, they should be reviewed, normalized, and committed before implementation branches depend on them.

---

## 8. Current quality baseline

### Tests successfully run

```text
node --test tests/workspaceStructure.test.js
  4 passed, 0 failed

node --test src/features/simulation/dashboardModel.test.js \
  src/features/simulation/simulationHelpers.test.js \
  src/sourceLineCount.test.js
  11 passed, 0 failed
```

Total directly executed: **15 passed, 0 failed**.

### Checks not completed

Full `pnpm test`, `pnpm lint`, and `pnpm build` were not executed because dependencies are not installed and pnpm/Corepack could not fetch pnpm 11.1.1 from npm. Both sandboxed and approved external attempts failed with:

```text
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

This is a local certificate/toolchain bootstrap issue, not a source-test failure. TLS verification was not disabled to bypass it.

### Missing quality gates

- no API/domain/database tests;
- no contract-schema tests;
- no invalid-transition or idempotency tests;
- no integration/E2E suite;
- no browser accessibility or visual regression checks;
- no CI pipeline;
- no dependency/security scanning.

---

## 9. Recommended implementation starting point

### Decision

Start with a **replay-first, server-authoritative vertical slice**. Preserve the finished UI, but replace its fixture authority one boundary at a time.

Do not start with live Agora, a real LLM, mainnet/devnet payment, cloud recording, or deployment automation. Those integrations amplify uncertainty before the transaction rules are executable.

### Phase 0 — Normalize and freeze the MVP contracts

1. Resolve the eight documentation drifts listed above.
2. Confirm actual package namespace: recommended `@call-to-cash/*`, matching the workspace.
3. Confirm SSE as the MVP API-to-browser transport.
4. Confirm the API implementation stack and language. Node is already the accepted authority; the framework and TypeScript/JavaScript choice still need one recorded decision.
5. Resolve the refund-policy text and choose one canonical version.
6. Commit the documentation baseline.

**Exit condition:** links, package names, states, events, DTOs, error codes, and policy copy have one canonical spelling/source.

### Phase 1 — Implement the shared deterministic domain kernel

Implement `packages/shared` first:

- Zod schemas for public IDs, transcript turns, booking fields, risk inputs/results, agreements, payments, receipts, API envelopes, events, and errors;
- canonical enums for all state machines;
- event names and envelope schemas;
- error-code constants;
- versioned risk thresholds and reason codes;
- transition input/output types.

Then implement pure, heavily tested logic in `packages/ai` and the shared domain layer:

- booking-field validation and confirmation invalidation;
- completeness, dispute-risk, payment-readiness, and gate evaluation;
- critical-blocker and next-action policy;
- canonical agreement serialization and real SHA-256 utility at the correct server/domain boundary;
- state-transition guards.

**Exit condition:** fixtures cannot open payment unless the same deterministic evaluator used by production returns `UNLOCKED`.

### Phase 2 — Add durable local authority

Implement the first Prisma/PostgreSQL slice and repository layer:

```text
call_sessions
transcript_turns
bookings
risk_assessments
agreements
payment_intents
payment_transactions
proof_records
trust_receipts
audit_logs
```

Add `.env.example`, local Compose for PostgreSQL (then Redis/MinIO when their first use appears), migrations, seed data, health checks, and demo actor configuration.

**Exit condition:** a receipt can be traced back to payment, locked agreement version, gate decision, transcript evidence, and call session.

### Phase 3 — Build the deterministic replay API and SSE stream

Implement only the endpoint subset needed for one complete vertical slice:

```text
create/end call
append final replay transcript turn
read risk/booking state
confirm current agreement
create mock payment intent
verify deterministic mock payment
read/verify receipt
consume call SSE events
```

Every mutation must validate shared schemas, enforce state guards, write audit data, and be idempotent. Use an outbox-backed event path once persistence is active.

**Exit condition:** the happy path and mismatch path complete through API/SSE with the frontend closed or disconnected, proving that browser state is not authoritative.

### Phase 4 — Adapt the existing frontend

Keep `apps/web` presentation components and introduce a thin client boundary:

- REST command client;
- SSE event reducer;
- explicit demo/live mode badge;
- server-provided masked booking/read models;
- fixture adapter that feeds the same API/domain path rather than directly setting scores;
- removal of browser-side payment/proof authority.

**Exit condition:** the current visual demo behaves the same, but refresh/reconnect recovers state from the API and no UI flag can unlock payment.

### Phase 5 — Integrate external providers last

Recommended order:

1. server-side mock adapters under `DEMO_MODE=true`;
2. Solana devnet payment creation and verification;
3. Agora token/channel/transcript adapter;
4. optional real AI extraction behind strict Zod validation;
5. object storage/recording only after consent and retention controls exist.

Provider adapters must feed the same domain commands and state machines already proven by replay mode.

---

## 10. First vertical-slice acceptance target

The first meaningful backend milestone is complete when all of the following are true:

1. A deterministic transcript replay creates a durable call and booking draft.
2. Required booking fields and provenance are validated by shared schemas.
3. Risk scores are calculated from facts, not fixture totals.
4. Missing pickup, policy acceptance, inventory hold, or explicit confirmation keeps the gate locked with reason codes.
5. Explicit confirmation locks one immutable agreement version and real SHA-256 hash.
6. A mock payment intent can be created only from the locked agreement and an open gate.
7. Repeated create/verify requests are idempotent.
8. A correct mock payment produces one proof record and one trust receipt.
9. A changed agreement copy produces `MISMATCH` and manual review without mutating the locked snapshot.
10. The existing mobile UI receives the entire progression through REST/SSE.
11. No raw phone, transcript, agreement payload, or secret appears in proof/on-chain-shaped fields or logs.
12. Unit, transition, contract, repository, and vertical-slice integration tests pass in CI.

This milestone demonstrates the actual Call-to-Cash differentiator:

```text
Transcript replay
→ deterministic safe gate
→ immutable agreement
→ verified/idempotent payment
→ privacy-safe proof
→ recoverable Trust Receipt
```

Only after this works should the team spend integration time on live voice and real chain providers.

---

## 11. Immediate backlog, ordered

| Priority | Work item | Why now |
|---:|---|---|
| P0 | Normalize links, namespaces, SSE terminology, refund policy, and backend stack decision | Prevent contract duplication and incompatible package/API work |
| P0 | Implement `packages/shared` schemas/enums/errors/events | Every backend and frontend adapter depends on this source of truth |
| P0 | Implement deterministic risk/gate and transition tests | Payment safety is the core differentiator |
| P0 | Implement canonical agreement + SHA-256 tests | Current browser mock is not secure or portable |
| P1 | Add Prisma schema, repositories, migrations, seed, and local PostgreSQL | Establish durable server authority |
| P1 | Implement replay endpoints, idempotency, audit, outbox, and SSE | Produce the first end-to-end vertical slice |
| P1 | Replace direct fixture setters with a web API/SSE adapter | Reuse the finished UI without preserving browser authority |
| P1 | Add explicit `DEMO_MODE` and mock-provider disclosure | Meet demo policy and prevent misleading provider claims |
| P2 | Add Solana devnet adapter and server verification | Replace mock payment after domain flow is proven |
| P2 | Add Agora token/transcript integration | Replace replay input without changing downstream contracts |
| P2 | Add Redis/MinIO when queue/media use cases are implemented | Avoid infrastructure with no current consumer |
| P2 | Add CI, E2E, accessibility, observability, retention, and incident automation | Harden the complete flow |

---

## 12. Change summary for this report

- **Documentation consulted:** all repository product, architecture, contract, security, operations, design, maintainability, roadmap, root instruction, README, and V6 proposal materials.
- **Documentation updated:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/operations/ECC-AGENT-WORKFLOW.md`, and `docs/report/CURRENT-STATE.md`.
- **Files changed:** agent workflow documentation/configuration only; no product source code changed.
- **Contracts changed:** none; inconsistencies are identified for a separate normalization change.
- **Database migration required:** no for this report. The recommended backend foundation will require an initial schema/migration.
- **Environment variables added/changed:** none.
- **Tests run:** 15 Node tests passed; full pnpm test/lint/build blocked by local npm TLS certificate failure and missing dependencies.
- **Remaining TODOs or mocked integrations:** all backend, database, Agora, AI provider, Solana, persistence, SSE, auth, infra, and deployment integrations remain unimplemented; the current FE payment/proof flow remains explicitly simulated.
