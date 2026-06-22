# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-22 (Asia/Bangkok)
>
> **Branch inspected:** `testing` (Phase 9 closure worktree)
>
> **Purpose:** record the verified Phase 9 baseline and current closure status.
>
> **Conclusion:** Phase 9 is complete as the user-approved Agora media, safe transcript-ingress, customer-to-booking, and realtime-summary slice. It does not claim that the current live assistant-frame variant has been accepted as an `AGENT` turn.
>
> **Current Phase 9 stage (2026-06-22): COMPLETE.** Closure is an explicit user decision after realtime customer booking extraction, UI/SSE recovery, redacted relay diagnostics, and the full automated verification suite. The observed assistant-frame variant is recorded honestly as deferred text/AI UX work; it is not recorded as successful live `AGENT` evidence.
>
> **Phase 10 stage: NOT STARTED.** Text beautification or semantic rewriting is deferred; Phase 9 retains normalized, display-preserving transcript text only and introduces no LLM/provider/key work.

---

> **Phase 9.2 go decision (2026-06-21):** three independent live-browser smoke runs have passed and are preserved as redacted user-attested evidence in `docs/operations/AGORA-LIVE-SMOKE-TEST.md`. This supersedes the older `BLOCKED` wording below: Phase 9.2 static prompt implementation is now **GO**. `CTC-AGORA-VI-V1` is injected server-side through the Agora join request's `properties.llm.system_messages`, but remains **DRAFT**: its restarted-runtime join attempt was rejected by Agora before controlled live evaluation could begin.

## 1. Executive summary

The current server-authoritative flow is:

```text
deterministic transcript replay
→ durable booking and risk state
→ explicit agreement confirmation
→ payment gate
→ server-created Solana Pay Devnet request
→ automatic reference-based transaction discovery
→ server-side chain verification
→ proof record and Trust Receipt
→ REST/SSE recovery in the web UI
```

Phase 8 replaced mock-only payment confirmation with an opt-in Solana Devnet provider while preserving the same agreement, payment-gate, proof, receipt, privacy, and state-machine rules. Deterministic mock payment remains available for tests and fallback.

The Phase 9 Agora adapter is complete: the browser joins RTC directly, the API owns token/CAI orchestration and consent, and final provider turns reuse the existing transcript/domain path. Customer transcript extraction, scheduled-catalogue booking updates, and SSE/REST recovery are verified. The unaccepted live assistant-frame variant remains a deferred text/AI UX concern, not a claimed acceptance result. Optional LLM extraction, Redis, object storage, and production hardening remain later phases.

The Phase 9.2 integration commit additionally separates provider-event and Notifications secrets, accepts a fixed public reconciliation webhook, persists provider-turn and notice idempotency keys, and restores the authoritative transcript after refresh. The current relay slice adds a third API-to-relay control secret, an isolated headless-browser RTM subscriber, strict agent/call/channel/session/final-frame checks, and a signed handoff to the existing canonical transcript ingress. Before production activation, deploy the private relay runtime, configure CAI final-frame publishing, apply the existing Prisma migration, run the database-backed webhook suite, and collect fresh browser evidence; browser RTC remains audio-only.

---

## 2. Phase status

|                                 Pipeline phase | Current assessment                 | Evidence                                                                                                    |
| ---------------------------------------------: | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
|                        0 — Normalize contracts | **Implemented**                    | canonical product, architecture, API/event/error, and privacy contracts                                     |
|                       1 — Executable workspace | **Implemented**                    | pnpm/Turbo scripts, Node 20.20 deploy baseline, CI, Compose, validated env surface                          |
|                           2 — Shared contracts | **Implemented**                    | shared Zod DTOs, events, errors, enums, contract tests                                                      |
|                              3 — Domain kernel | **Implemented**                    | deterministic scoring, payment gate, agreement and transition guards                                        |
|                    4 — PostgreSQL/Prisma state | **Implemented**                    | schema, migration, seed, repositories, DB-backed tests                                                      |
|                         5 — Replay API and SSE | **Implemented**                    | Fastify orchestration, durable transcript/state/event flow                                                  |
|                       6 — Web REST/SSE adapter | **Implemented**                    | API-mode state, recovery, reconnect, privacy-safe projections                                               |
|                 7 — Mock payment/proof/receipt | **Implemented**                    | authoritative happy path, failure/tamper path, receipt recovery                                             |
|                              8 — Solana Devnet | **Implemented**                    | provider, Solana Pay URL/QR, discovery, verification, polling, proof/receipt linkage                        |
|                9 — Agora live voice/transcript | **IN PROGRESS**                    | automated relay/API/web/DB tests pass; new live AGENT transcript and realtime booking evidence are required |
|  9.2 — Agora conversation quality optimization | **GO; V1 draft, agent start pass** | RTC-first browser sequence reaches agent join; V1 live conversation evaluation is still required            |
|                   10 — Optional LLM extraction | **Not started**                    | `packages/ai` remains a boundary/placeholder                                                                |
| 11 — Redis, object storage, consent/media jobs | **Not started**                    | no active provider integration yet                                                                          |
|                      12 — Production hardening | **Partial**                        | health/readiness, CORS, rate limiting and runbooks exist; auth/RBAC and richer observability remain         |

---

## 3. Phase 8 acceptance evidence

| Phase 8 requirement                                             | Status           | Evidence                                                                                                                    |
| --------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Server creates the payment request                              | **Pass**         | provider-neutral payment API returns a Devnet-only Solana Pay URL and QR payload                                            |
| Reference and memo contain no PII                               | **Pass**         | random base58 32-byte reference and opaque versioned memo fragments                                                         |
| Frontend cannot authoritatively confirm payment                 | **Pass**         | browser submits only the payment-intent ID; verification remains server-side                                                |
| Automatic transaction discovery                                 | **Pass**         | provider discovers candidate signatures from the payment reference                                                          |
| Confirmation, execution, recipient, amount and reference checks | **Pass**         | Devnet RPC verifier fails closed on mismatches and failed/unconfirmed transactions                                          |
| One-time transaction consumption                                | **Pass**         | reused signature returns `409 PAYMENT_TRANSACTION_REUSED` and creates no second receipt                                     |
| Retry-safe RPC handling                                         | **Pass**         | not-found, unconfirmed, timeout and unavailable outcomes remain retryable/pending                                           |
| Durable transaction/proof/receipt linkage                       | **Pass**         | confirmed transaction creates one proof and one Trust Receipt atomically                                                    |
| Privacy-safe persistence and projections                        | **Pass**         | minimized chain metadata; no raw phone, transcript or full agreement on-chain/events                                        |
| Automatic browser polling                                       | **Pass**         | payment drawer polls verification and cancels its timer when the effect is cleaned up                                       |
| Real Devnet smoke path                                          | **Pass, manual** | an actual Devnet transaction was finalized and confirmed during Phase 8 validation; this is not an automated CI wallet test |

The implementation follows the Phase 8 boundary in `docs/architecture/PIPELINE.md`: `packages/solana` observes and verifies provider facts but does not decide booking risk, agreement validity, payment-gate state, or receipt policy.

No Phase 8 database migration was required. Existing payment-intent, payment-transaction, proof, and receipt entities carry the provider data.

---

## 4. Verification status

The cleanup commit `cb4fce4` was verified locally with PostgreSQL-backed tests:

| Gate                                        | Result   |
| ------------------------------------------- | -------- |
| `pnpm format:check`                         | **Pass** |
| `pnpm db:validate`                          | **Pass** |
| `pnpm lint`                                 | **Pass** |
| `pnpm typecheck`                            | **Pass** |
| `pnpm test` with isolated PostgreSQL schema | **Pass** |
| `pnpm build`                                | **Pass** |

The Phase 8 integration test covers pending verification, confirmed chain evidence, durable transaction fields, one proof, one receipt, and transaction-signature reuse rejection. The web regression suite covers provider-neutral verification payloads, privacy-safe state, refresh recovery, retryable failures, and polling timer behavior.

### CI trigger alignment

PR #9 merged as `84d7bf6`. Its CI run failed at `format:check` because two API files were not formatted. Commit `cb4fce4` corrected those files and the Windows line-ending configuration, and all local gates passed afterward.

The GitHub workflow has been updated to trigger on pushes to both `main` and `develop`, ensuring proper status checks are run on the active development branch before merge.

---

## 5. Known gaps

### Phase 9.2 activation gates (supersedes the earlier blocked gate wording)

1. Record three happy paths plus interruption, silence, and payment-verifying scenarios with audible agent audio, visible user/agent transcripts, and no unsupported authority claim.

`docs/agora/AGORA-VOICE-OPTIMIZATION.md` records Phase 9.2 as **GO** for draft implementation. The repository prompt source and safe pipeline mapping live in `packages/agora/prompts/`; the server maps `CTC-AGORA-VI-V1` to Agora `properties.llm.system_messages` for every new agent join. The legacy join attempt happened before browser readiness and failed without retained provider detail/reason. The corrected flow now issues browser RTC metadata first, verifies browser RTC connection plus microphone publish/UID readiness, and allows one agent start only afterward. No provider prompt-revision or provider rollback API is configured or inferred, and no controlled V1 live evaluation has been recorded.

### Historical Phase 9 and 9.2 blocker record (resolved)

1. Record three independent fresh-browser Agora runs with microphone permission, RTC join, audible agent audio, customer/agent final transcripts, final-turn persistence, SSE updates, refresh recovery, and Retry / Replay Demo / End Session evidence. Historical CAI join/leave probes do not satisfy this gate.
2. Map the actual provider join path from the versioned repository source before beginning Phase 9.2.

This historical entry is superseded by the GO decision and the versioned V1 prompt artifacts above. It is retained only to explain why the original smoke-evidence and deployment-mapping gates existed.

These do not block beginning Phase 9, but they remain explicit engineering work:

1. Obtain one green GitHub CI run for `cb4fce4` or its descendant.
2. Add an automated browser E2E test for the payment drawer and recovery path. Phantom signing remains a manual smoke step.
3. Resolve the harmless checkout warning caused by the pinned `ECC` gitlink having no `.gitmodules` mapping, or retain the documented explicit-clone workflow.
4. Implement auth/RBAC before exposing sensitive booking/payment APIs beyond controlled demo environments.
5. Address the PostgreSQL client deprecation warning observed during integration tests before the relevant dependency upgrade becomes mandatory.

---

## 6. Phase 9 closure slice

Phase 9 adds Agora only as the media/transcript input adapter:

```text
API creates call session
→ API issues scoped short-lived Agora token/channel metadata
→ browser joins Agora directly
→ transcript provider normalizes final turns
→ API persists turns through the existing replay/domain path
→ existing REST/SSE booking, risk, payment and receipt flow remains unchanged
```

Phase 9 must not move media through the Node API or give Agora authority over booking, payment, proof, or receipt state. Consent and accurate connection-state UX are acceptance requirements.

---

## 7. Current go/no-go decision

**Phase 9 implementation status:** COMPLETE — user-approved scope closure; relay, API, web, and database-backed tests pass.

**Go for Phase 9 closure:** Yes — the remaining assistant-frame observation is deferred without claiming a passing live `AGENT` transcript.

---

## 7.1 Phase 9.1 Agora live acceptance — 2026-06-21

**Status: historical baseline only; superseded for closure.** The server-to-CAI probe passed, and the voice mode configurations between the API (`apps/api/.env`) and web client (`apps/web/.env.local`) have been aligned to `agora` to support the live voice, transcript, and SSE pipeline. It does not prove current assistant transcript delivery.

PostgreSQL-backed verification did run successfully: 6 database tests and 10 API tests passed with no skips using `call_to_cash_test`. No migration was required. The provider-event adapter was hardened to require an HMAC, five-minute freshness window, matching call ID/channel/active agent session, and stable provider-turn deduplication before invoking the existing transcript command.

The historical browser/CAI probe verified connectivity only. It is not evidence of current
assistant final-turn persistence. This remains a documented deferred observation after the
user-approved Phase 9 closure, not a recorded acceptance pass.

### Phase 9.1 update — server-to-CAI connectivity

The probe received HTTP 200 with an agent ID, then completed a successful leave request. No
identifier or credential is recorded here. It does not prove browser microphone delivery, live
final-turn ingestion, or SSE acceptance for the current relay implementation.

---

## 8. Change summary for this snapshot

### Phase 9.2 draft implementation update

- **Documentation consulted:** Agora optimization, live smoke, runbook/failure, pipeline/decisions, booking/risk, API/event/error, and privacy contracts.
- **Documentation updated:** Phase 9.1 redacted smoke evidence, Phase 9.2 GO/draft status, actual server-side join-payload mapping, V1 live-evaluation ledger, local setup/runbook, and current-state status.
- **Files changed:** versioned prompt source, server-side Agora join-payload injection, evaluation matrix, constraint test, Agora package test command, preflight local-env precedence, and the listed operational/status docs.
- **Contracts changed:** none.
- **Database migration required:** no.
- **Environment variables added/changed:** none.
- **Tests run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, root `pnpm test`, and `pnpm build` passed. The root test run reported DB/API destructive integration cases **SKIPPED — `TEST_DATABASE_URL` not configured**. They were rerun against isolated `call_to_cash_test`: DB 6/6 **PASS** and API 10/10 **PASS**. Prompt constraints plus existing Agora tests passed 9/9, including the server join-payload injection assertion.
- **Remaining TODOs or mocked integrations:** resolve the non-retryable Agora V1 join rejection, then run the six controlled V1 live evaluations before activation. Phase 9.3 directives and Phase 10 LLM extraction remain out of scope.

### Historical Phase 9.2 gate assessment update

- **Documentation consulted:** `docs/agora/AGORA-VOICE-OPTIMIZATION.md`, `docs/operations/AGORA-LIVE-SMOKE-TEST.md`, `docs/operations/LIVE-DEMO-RUNBOOK.md`, `docs/operations/DEMO-FAILURE-MATRIX.md`, `docs/architecture/PIPELINE.md`, `docs/architecture/DECISIONS.md`, `docs/product/BOOKING-CONTRACT.md`, `docs/product/RISK_SCORING.md`, `docs/contracts/API-CONTRACT.md`, `docs/contracts/EVENT-CONTRACT.md`, `docs/contracts/ERROR-CODES.md`, and `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md`.
- **Documentation updated:** `docs/agora/AGORA-VOICE-OPTIMIZATION.md` and this report recorded the original Phase 9.2 prerequisite and prompt-deployment boundary.
- **Contracts changed:** none.
- **Database migration required:** no.
- **Environment variables added/changed:** none.
- **Tests run:** superseded by the Phase 9.2 draft implementation verification above.
- **Remaining TODOs or mocked integrations:** superseded by the V1 activation gates above. Phase 9.3 runtime directives and Phase 10 LLM extraction remain out of scope.

- **Documentation consulted:** `AGENTS.md`, `docs/architecture/PIPELINE.md`, `docs/architecture/DECISIONS.md`, `docs/contracts/API-CONTRACT.md`, `docs/contracts/EVENT-CONTRACT.md`, `docs/contracts/ERROR-CODES.md`, `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md`, `docs/operations/LOCAL-SETUP.md`, `docs/operations/SOLANA-DEVNET-SMOKE-TEST.md`, `docs/operations/ECC-AGENT-WORKFLOW.md`, and the previous current-state report.
- **Documentation updated:** this current-state snapshot and directly stale API README statements.
- **Contracts changed:** none.
- **Database migration required:** no.
- **Environment variables added/changed:** Aligned `VOICE_PROVIDER=agora` inside `apps/api/.env` to resolve the mismatch with `VITE_VOICE_PROVIDER=agora` on the web client.
- **Remaining mocked/later integrations:** Optional LLM extraction, Redis, object storage, and Phantom signing automation.
