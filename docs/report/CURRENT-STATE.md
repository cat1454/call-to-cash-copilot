# Call-to-Cash Risk Copilot - Current State

> **Snapshot date:** 2026-06-20 (Asia/Saigon)  
> **Branch / baseline:** `step3` / `f27f894` plus the verified Phase 3 domain-kernel working tree
> **Purpose:** establish the implementation baseline and identify the next production slice.
> **Conclusion:** Phase 3 deterministic domain rules are complete. The frontend remains a presentation-ready simulation; the next implementation slice is durable server authority in Phase 4.

---

## 1. Executive summary

The repository now has three distinct maturity levels:

1. **A working React/Vite demo UI** for scripted calls, animated risk scores, simulated payment, simulated receipt, and tamper mismatch on mobile and desktop.
2. **An executable engineering foundation** with a pnpm/Turbo workspace, TypeScript package entrypoints, validated runtime configuration, Fastify health/readiness endpoints, a frozen lockfile, root quality commands, and CI.
3. **Executable shared contracts and deterministic domain rules** for public IDs, DTOs, state enums, risk/gate decisions, agreement canonicalization, and allowed transitions, backed by the detailed privacy, API, state, data, risk, payment, and operations documents.

The missing bridge is now narrower but still material. There is no database schema, business API route, SSE stream, durable state, authoritative payment/proof/receipt flow, authentication, or real provider adapter.

```text
Completed frontend simulation
+ normalized and executable shared contracts
+ deterministic domain rules and transition guards
+ executable workspace and API skeleton
- durable server authority
- provider integrations
= Phase 0-3 complete, not yet an end-to-end MVP
```

The correct next slice is **Phase 4 PostgreSQL, Prisma, inventory, and durable state**. Live Agora, Solana devnet, LLM, Redis, and object storage remain intentionally deferred.

---

## 2. Audit scope and evidence

This state report is based on:

- root package/workspace configuration, lockfile, environment template, CI, and git state;
- the complete `apps/web` demo source, fixtures, PWA configuration, and tests;
- the Fastify application skeleton and runtime configuration tests;
- every package manifest, TypeScript entrypoint, and boundary README;
- product, architecture, API/event/error, privacy, operations, and report documents;
- the local `ECC/` workflow catalog and repository-specific agent routing;
- successful frozen install, lint, typecheck, test, build, and local smoke verification.

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
| `apps/api` | Fastify/TypeScript server, `/health`, `/ready`, shared-envelope/error integration | **Implemented scaffold** |
| `packages/config` | validated host/port/demo/provider runtime configuration | **Implemented** |
| `packages/shared` | Zod contracts, state/error/event constants, replay DTOs, contract tests | **Implemented** |
| `packages/domain` | deterministic booking/risk/gate rules, canonical agreement serialization, transition tables, unit tests | **Implemented** |
| `packages/ai` | adapter boundary/build entrypoint | **Scaffold** |
| `packages/db` | repository boundary/build entrypoint; no Prisma client | **Scaffold** |
| `packages/agora` | adapter boundary/build entrypoint | **Scaffold** |
| `packages/solana` | adapter boundary/build entrypoint | **Scaffold** |
| `prisma/` | no schema or migrations | **Absent** |
| Local infrastructure | Phase 1 `.env.example`; no Compose/PostgreSQL/Redis/MinIO | **Partial by design** |
| CI | GitHub Actions install, format, lint, typecheck, test, build | **Implemented, remote run not observed here** |
| Documentation | canonical pipeline, states, contracts, privacy, operations | **Specified / normalized** |
| Automated tests | workspace, shared contracts, domain kernel, config, API skeleton, and browser simulation units | **Implemented** |

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

## 5. What Phase 0-2 implemented

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

### Executable shared contracts

- `packages/shared` owns the single Zod/TypeScript definition of public IDs, call/transcript/booking/risk/agreement/payment/proof/receipt DTOs, API envelopes, documented errors/reason codes, and the complete SSE event catalog;
- API health/error handling validates through the shared envelope and error schemas; the web test imports the same event/payment-gate constants;
- replay command schemas reject caller-supplied authority fields, and public proof contracts reject unapproved PII fields.

---

## 6. What remains simulated or absent

| Capability | Current behavior |
|---|---|
| Transcript/Agora | fixture replay; no SDK, token, channel, STT, webhook, recording, or reconnect |
| Extraction | fields copied from scenario fixtures |
| Risk scoring | domain kernel calculates scores from facts; browser scenario totals still do not call it |
| Payment gate | domain kernel evaluates the gate; browser fixture `gateUnlocked` is not yet wired to it |
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

`packages/shared` now encodes documented IDs, API envelopes, replay DTOs, domain entities, state enums, error/reason codes, and event names with Zod and inferred TypeScript types. The scripted UI still has simulation-specific status/fixture structures and is not yet server-authoritative.

### 7.2 Risk/payment gate

`packages/domain` now enforces:

```text
completeness >= 85
paymentReadiness >= 80
disputeRisk <= 35
explicit confirmation
active inventory hold
locked current agreement
no critical blocker
```

The browser fixture can still display an independent unlock because Phase 6 has not connected the UI to server/domain authority; it cannot become an authoritative payment path before that integration exists.

### 7.3 Agreement/proof/privacy

There is a versioned canonical agreement serializer that whitelists normalized commercial terms and excludes contact acknowledgement. Server-side SHA-256, immutable persistence, and proof anchoring remain unimplemented; the browser mock hash must never be promoted into backend or Solana authority. Phone masking also remains inconsistent across all demo views.

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
| Shared contract schemas | 7 |
| Domain kernel | 9 |
| Web simulation/config/source guards | 13 |
| Runtime config | 3 |
| Fastify API skeleton | 3 |
| **Total** | **41 passed, 0 failed** |

The workspace also successfully builds all nine app/package tasks. Provider package test commands currently pass with zero tests because their production logic has not started.

The local npm certificate issue was resolved by giving Node a valid Windows trusted-root PEM through `NODE_EXTRA_CA_CERTS`. TLS verification was not disabled.

Missing quality layers:

- Prisma/repository integration tests;
- business API, idempotency, SSE reconnect, and vertical-slice tests;
- rendered web interaction, accessibility, and visual regression tests;
- dependency/security scanning and an observed remote CI result.

---

## 9. Recommended next implementation

### Phase 4 - PostgreSQL, Prisma, inventory, and durable state

Introduce repositories and migrations only after preserving the pure-domain boundaries:

- model the documented call, booking, agreement, risk, inventory, payment, proof, receipt, and audit records;
- persist canonical payload/hash inputs without placing raw PII in proof-shaped fields;
- execute state changes and audit rows in one transaction;
- add repository/integration coverage for idempotency, expiry, and invalid transitions.

**Exit condition:** authoritative state survives refresh and supports the Phase 5 replay API without moving policy back into route handlers.

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

| Priority | Work item                                                  | Pipeline phase |
| -------: | ---------------------------------------------------------- | -------------: |
|       P0 | Add Prisma/PostgreSQL repositories, inventory, migrations  |              4 |
|       P1 | Implement replay REST commands, audit/outbox, and SSE      |              5 |
|       P1 | Replace fixture authority with web REST/SSE adapter        |              6 |
|       P1 | Complete durable mock payment/proof/receipt/mismatch slice |              7 |
|       P2 | Add Solana devnet verification                             |              8 |
|       P2 | Add Agora voice/transcript adapter                         |              9 |
|       P2 | Add optional validated LLM extraction                      |             10 |
|       P2 | Add Redis/MinIO only with queue/media consumers            |             11 |
|       P2 | Harden E2E, accessibility, observability, and deployment   |             12 |

---

## 12. Change summary

- **Documentation consulted:** root agent instructions; ECC workflow guidance; architecture, product, contract, privacy, operations, and current-state documents.
- **Documentation updated:** Phase 3 gate-blocker wording now distinguishes ordinary `LOCKED`/`READY_FOR_CONFIRMATION` conditions from manual-review integrity/payment exceptions; this report records Phase 3 completion.
- **Code/tooling implemented:** `packages/domain` now owns booking validation/extraction, material-change confirmation invalidation, deterministic score/gate rules, inventory-time checks, transition tables, and a privacy-safe canonical agreement serializer. `packages/shared` exposes the inferred risk-reason-code type used by the domain package.
- **Contracts changed:** shared executable definitions gain the exported `RiskReasonCode` inference. No API/event payload, business route, persistence model, provider adapter, or frontend transaction behavior was added.
- **Database migration required:** no.
- **Environment variables added:** `NODE_ENV`, `API_HOST`, `API_PORT`, `DEMO_MODE`, `PAYMENT_PROVIDER`, `VOICE_PROVIDER`, `AI_PROVIDER`, `VITE_DEMO_MODE`, `VITE_API_BASE_URL`.
- **Tests run:** 41 non-empty tests pass; frozen install, lint, typecheck, test, and build pass. The root format check still reports pre-existing formatting drift in unrelated files; Phase 3 code and manifests were formatted and checked independently.
- **Remaining mocked integrations:** UI-to-domain/API wiring, durable inventory/agreement/payment/proof/receipt state, SSE, auth, Agora, AI provider, Solana, Redis, object storage, and deployment remain unimplemented.
