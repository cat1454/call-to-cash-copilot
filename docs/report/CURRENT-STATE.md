# Call-to-Cash Risk Copilot - Current State

> **Snapshot date:** 2026-06-20 (Asia/Saigon)  
> **Branch / baseline:** `main` / `b6f6e3e` plus the verified Phase 0-1 working tree
> **Purpose:** establish the implementation baseline and identify the next production slice.
> **Conclusion:** Phase 0 contract normalization and Phase 1 workspace/API scaffolding are complete. The frontend remains a presentation-ready simulation; the server-authoritative transaction flow begins in Phase 2.

---

## 1. Executive summary

The repository now has three distinct maturity levels:

1. **A working React/Vite demo UI** for scripted calls, animated risk scores, simulated payment, simulated receipt, and tamper mismatch on mobile and desktop.
2. **An executable engineering foundation** with a pnpm/Turbo workspace, TypeScript package entrypoints, validated runtime configuration, Fastify health/readiness endpoints, a frozen lockfile, root quality commands, and CI.
3. **Detailed production contracts** for privacy, APIs, SSE events, state machines, data, risk scoring, payment verification, and operations.

The missing bridge is now narrower but still material. There are no shared executable DTO/event/error schemas, deterministic domain evaluator, database schema, business API routes, SSE stream, durable state, authoritative payment/proof/receipt flow, authentication, or real provider adapters.

```text
Completed frontend simulation
+ normalized production contracts
+ executable workspace and API skeleton
- executable shared/domain rules
- durable server authority
- provider integrations
= Phase 0-1 complete, not yet an end-to-end MVP
```

The correct next slice is **Phase 2 shared contracts followed by Phase 3 deterministic domain logic**. Live Agora, Solana devnet, LLM, Redis, and object storage remain intentionally deferred.

---

## 2. Audit scope and evidence

This state report is based on:

- root package/workspace configuration, lockfile, environment template, CI, and git state;
- the complete `apps/web` demo source, fixtures, PWA configuration, and tests;
- the Fastify application skeleton and runtime configuration tests;
- every package manifest, TypeScript entrypoint, and boundary README;
- product, architecture, API/event/error, privacy, operations, and report documents;
- the local `ECC/` workflow catalog and repository-specific agent routing;
- successful install, format, lint, typecheck, test, build, and local smoke verification.

Status labels:

| Label | Meaning |
|---|---|
| **Implemented** | Executable source exists and has been locally verified. |
| **Simulated** | Behavior is visible, but facts/decisions/providers are browser fixtures or mock effects. |
| **Specified** | A canonical contract exists without its runtime implementation. |
| **Scaffold** | Package/runtime boundary builds, but owns no production business behavior yet. |
| **Absent** | The artifact or capability does not exist. |

### Repository operating context

- `ECC/` is a separately versioned clone of `affaan-m/ECC`, pinned at `34faa39`, and excluded from the pnpm workspace.
- Root instructions require a lightweight ECC scan and documentation-first implementation workflow.
- `.agents/` remains available for project-local runtime-discovered skills.
- The current canonical repository namespace is `@call-to-cash/*`.
- pnpm 11.1.1 is the only dependency manager/lock source; generated npm locks and local pnpm store data are excluded.

---

## 3. Repository map and implementation status

| Area | Current contents | Status |
|---|---|---|
| Root workspace | pnpm 11.1.1, Turbo, Node pin, frozen lockfile, root scripts | **Implemented** |
| Tooling | shared ESLint, Prettier, TypeScript base config | **Implemented** |
| `apps/web` | React 19/Vite 8 responsive scripted demo, PWA shell, tests | **Implemented / Simulated** |
| `apps/api` | Fastify/TypeScript server, `/health`, `/ready`, error envelope tests | **Implemented scaffold** |
| `packages/config` | validated host/port/demo/provider runtime configuration | **Implemented** |
| `packages/shared` | TypeScript package/build entrypoint; contracts not coded yet | **Scaffold** |
| `packages/domain` | pure-domain boundary/build entrypoint; no rules yet | **Scaffold** |
| `packages/ai` | adapter boundary/build entrypoint | **Scaffold** |
| `packages/db` | repository boundary/build entrypoint; no Prisma client | **Scaffold** |
| `packages/agora` | adapter boundary/build entrypoint | **Scaffold** |
| `packages/solana` | adapter boundary/build entrypoint | **Scaffold** |
| `prisma/` | no schema or migrations | **Absent** |
| Local infrastructure | Phase 1 `.env.example`; no Compose/PostgreSQL/Redis/MinIO | **Partial by design** |
| CI | GitHub Actions install, format, lint, typecheck, test, build | **Implemented, remote run not observed here** |
| Documentation | canonical pipeline, states, contracts, privacy, operations | **Specified / normalized** |
| Automated tests | workspace, config, API skeleton, and browser simulation units | **Implemented, pre-domain scope** |

---

## 4. What the frontend demo delivers

### 4.1 Product experience

`apps/web` provides:

- desktop mentor console and mobile Call/Dashboard/Receipt tabs;
- three deterministic Vietnamese booking scenarios;
- transcript replay, call status, booking extraction, risk telemetry, and timeline animation;
- simulated payment drawer, countdown, receipt, and tamper mismatch;
- responsive styling, service-worker registration, manifest, and icons;
- visible demo-mode disclosure and truthful replay/mock/deterministic provider labels;
- one canonical displayed refund policy: `BUS-V1` version `1.0`, 80% refund with at least 12 hours notice.

### 4.2 Current browser-side authority

```text
scenario fixture
  -> timeout-driven transcript replay
  -> fixture fields and score totals
  -> fixture gateUnlocked flag
  -> simulated payment drawer
  -> fake wallet/network timers
  -> browser-generated transaction/hash
  -> browser-only receipt
  -> optional browser-state tamper mismatch
```

The UI is now honest about this simulation, but it is still browser-authoritative. Refresh/reset loses the transaction state.

### 4.3 PWA status

The app has a manifest, icons, service-worker registration, app-shell caching, and same-origin stale-while-revalidate behavior. Manifest and SVG theme values now match the light/green V6 design.

Remaining PWA limitations:

- the QR image comes from external `api.qrserver.com` and is not available from the same-origin cache;
- production assets are runtime-cached rather than generated into an explicit precache manifest;
- offline/install behavior has no browser automation test.

---

## 5. What Phase 0-1 implemented

### Contract normalization

- canonical risk document: `docs/product/RISK-SCORING.md`;
- canonical package namespace: `@call-to-cash/*`;
- canonical MVP realtime transport: SSE;
- backend decision: Node.js + Fastify + TypeScript; PostgreSQL + Prisma starts in Phase 4;
- canonical refund policy: `BUS-V1` version `1.0`;
- explicit `DEMO_MODE`, payment, voice, and AI provider configuration;
- UI disclosure no longer claims a real Agora/Solana connection;
- stale editor paths/colors and PWA manifest colors normalized;
- trusted-CA workflow documented without disabling TLS.

### Executable foundation

- all apps/packages expose reproducible build/lint/typecheck/test commands;
- `packages/domain` exists as a pure business-rule boundary;
- Fastify starts independently and exposes standard-envelope health/readiness endpoints;
- invalid runtime booleans, ports, and provider selections fail at startup;
- CI performs a frozen install, format check, lint, typecheck, tests, and build;
- workspace tests guard package boundaries, namespace, refund policy, source entrypoints, one lockfile, and ignored caches.

---

## 6. What remains simulated or absent

| Capability | Current behavior |
|---|---|
| Transcript/Agora | fixture replay; no SDK, token, channel, STT, webhook, recording, or reconnect |
| Extraction | fields copied from scenario fixtures |
| Risk scoring | score totals hard-coded in scenario steps |
| Payment gate | fixture `gateUnlocked`; no centralized evaluator |
| Inventory | display-only prefetch text; no departure or hold |
| Agreement | mutable browser object; no version/lock/confirmation evidence |
| Hash/proof | non-cryptographic browser display hash |
| Payment | static QR and timed mock messages |
| Receipt | browser state only |
| Realtime | local React setters; no SSE endpoint/outbox/replay |
| Persistence | none; refresh loses state |
| Auth/security controls | no authentication, RBAC, consent, audit persistence, or retention jobs |
| Providers | no real Agora, Solana, AI, database, Redis, or object-storage adapter |

The Fastify skeleton is deliberately not a business API. Its health response must not be interpreted as database/provider readiness.

---

## 7. Critical contract-to-code gaps

### 7.1 Shared contracts and states

The documents define DTOs, envelopes, event names, errors, reason codes, and state machines, but `packages/shared` does not yet encode them in Zod/TypeScript. UI status strings and fixture structures remain ad hoc.

### 7.2 Risk/payment gate

No executable rule currently enforces:

```text
completeness >= 85
paymentReadiness >= 80
disputeRisk <= 35
explicit confirmation
active inventory hold
locked current agreement
no critical blocker
```

Consequently, a fixture can still unlock payment independently of production rules.

### 7.3 Agreement/proof/privacy

There is no versioned canonical agreement serializer or server-side SHA-256 implementation. The browser mock hash includes mutable display values and must never be promoted into backend or Solana authority. Phone masking also remains inconsistent across all demo views.

### 7.4 Persistence/payment/receipt

There is no Prisma schema, transaction boundary, idempotency store, payment intent, transaction uniqueness check, proof record, trust receipt, or audit lineage.

### 7.5 SSE and recovery

SSE is normalized in the contracts, but there is no event store/outbox, ordering, `Last-Event-ID` recovery, snapshot refetch path, or browser event reducer.

---

## 8. Current quality baseline

The following commands pass from the repository root:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Current non-empty test baseline:

| Scope | Tests |
|---|---:|
| Workspace/normalization | 6 |
| Web simulation/config/source guards | 12 |
| Runtime config | 3 |
| Fastify API skeleton | 3 |
| **Total** | **24 passed, 0 failed** |

The workspace also successfully builds all nine app/package tasks. Provider package test commands currently pass with zero tests because their production logic has not started.

The local npm certificate issue was resolved by giving Node a valid Windows trusted-root PEM through `NODE_EXTRA_CA_CERTS`. TLS verification was not disabled.

Missing quality layers:

- shared schema/contract tests;
- domain formula and transition tables;
- Prisma/repository integration tests;
- business API, idempotency, SSE reconnect, and vertical-slice tests;
- rendered web interaction, accessibility, and visual regression tests;
- dependency/security scanning and an observed remote CI result.

---

## 9. Recommended next implementation

### Phase 2 - shared contracts

Implement `packages/shared` as the single executable contract source:

- Zod schemas for IDs, transcript turns, booking facts/provenance, risk inputs/results, agreements, payments, receipts, envelopes, and events;
- state enums, event names, error codes, risk reason codes, and versioned thresholds;
- positive/negative schema tests and generated TypeScript inference.

**Exit condition:** web/API/domain packages can import one validated contract set; no DTO/status/event duplication remains.

### Phase 3 - deterministic domain kernel

Implement pure logic in `packages/domain`:

- booking validation and material-change confirmation invalidation;
- completeness, dispute risk, payment readiness, critical blockers, and gate decision;
- allowed state transitions and next-action policy;
- canonical agreement serialization and server-side SHA-256;
- table-driven invariant and failure tests.

**Exit condition:** no fixture or caller can obtain `UNLOCKED` unless the deterministic evaluator passes every guard.

Do not combine Phase 2-3 with database or provider integration. PostgreSQL/Prisma follows in Phase 4 after the pure contracts/rules are stable.

---

## 10. First server-authoritative acceptance target

The later replay-first vertical slice is complete only when:

1. Replay creates a durable call and booking draft.
2. Shared schemas validate facts and provenance.
3. Domain facts calculate scores and reason codes.
4. Missing pickup, policy confirmation, hold, or explicit confirmation locks the gate.
5. Confirmation locks an immutable agreement version and SHA-256 hash.
6. One idempotent mock payment intent refers to that version.
7. Verified payment creates one proof and one trust receipt.
8. Altered candidate data returns `MISMATCH` and manual review without mutating the snapshot.
9. REST/SSE drives the existing UI and refresh recovers server state.
10. Proof, events, and logs contain no raw phone, transcript, agreement payload, or secret.

---

## 11. Immediate backlog

| Priority | Work item | Pipeline phase |
|---:|---|---:|
| P0 | Implement shared Zod schemas/enums/errors/events | 2 |
| P0 | Implement deterministic risk/gate and transitions | 3 |
| P0 | Implement canonical agreement serialization + SHA-256 | 3 |
| P1 | Add Prisma/PostgreSQL repositories, inventory, migrations | 4 |
| P1 | Implement replay REST commands, audit/outbox, and SSE | 5 |
| P1 | Replace fixture authority with web REST/SSE adapter | 6 |
| P1 | Complete durable mock payment/proof/receipt/mismatch slice | 7 |
| P2 | Add Solana devnet verification | 8 |
| P2 | Add Agora voice/transcript adapter | 9 |
| P2 | Add optional validated LLM extraction | 10 |
| P2 | Add Redis/MinIO only with queue/media consumers | 11 |
| P2 | Harden E2E, accessibility, observability, and deployment | 12 |

---

## 12. Change summary

- **Documentation consulted:** root agent instructions; ECC workflow guidance; architecture, product, contract, privacy, operations, and current-state documents.
- **Documentation updated:** architecture/contract naming and decisions, product refund policy, operations setup, package READMEs, and this report.
- **Code/tooling implemented:** explicit demo disclosure/policy source, runtime validation, Fastify skeleton, package entrypoints, root configs/scripts, CI, and regression tests.
- **Contracts changed:** canonical namespace, SSE terminology, health/readiness endpoint documentation, and refund policy normalization. No Phase 2 business DTO was implemented.
- **Database migration required:** no.
- **Environment variables added:** `NODE_ENV`, `API_HOST`, `API_PORT`, `DEMO_MODE`, `PAYMENT_PROVIDER`, `VOICE_PROVIDER`, `AI_PROVIDER`, `VITE_DEMO_MODE`, `VITE_API_BASE_URL`.
- **Tests run:** 24 non-empty tests pass; frozen install, format, lint, typecheck, build, and local app smoke checks pass.
- **Remaining mocked integrations:** booking extraction, risk/gate, inventory, agreement, payment, proof, receipt, persistence, SSE, auth, Agora, AI provider, Solana, Redis, object storage, and deployment remain unimplemented.
