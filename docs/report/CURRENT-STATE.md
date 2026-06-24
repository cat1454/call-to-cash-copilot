# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-23 (Asia/Bangkok)
> **Branch inspected:** `testing` (Phase 9 closure worktree)
> **Purpose:** state the current product maturity, the Phase 9 closure boundary, Phase 10 strict-schema extraction closure, and the active Phase 11 roadmap.
> **Status at this snapshot:** Phase 9 core scope and Phase 10 are **complete by user-approved closure**. Phase 11 — Fleet Revenue Twin is **MVP COMPLETE / automated verification passed** with the Scenario-Robust Revenue Rebalancing Optimizer; controlled Agora live-provider smoke remains an independent operational validation. Phase 9 transcript-quality hardening remains an independent quality workstream.

---

## 1. Executive summary

Call-to-Cash Risk Copilot converts a live booking conversation into a server-authoritative booking flow:

```text
Customer microphone
  → Agora RTC / Conversation AI
  → customer and agent transcript visible in the web UI
  → admitted final customer transcript
  → deterministic booking extraction and domain rules
  → durable booking / risk / payment-gate state
  → SSE and REST recovery in the web UI
  → agreement confirmation
  → server-created Solana Pay Devnet request
  → server-side transaction discovery and verification
  → proof record and Trust Receipt
  → refresh recovery
```

The project has completed the Phase 9 closure slice for user-approved scope:

- browser joins Agora RTC directly;
- API owns scoped token/session orchestration and transcript admission;
- customer final turns reuse the existing authoritative transcript/domain path;
- booking extraction, risk/gate recalculation, and SSE/REST recovery are in place;
- live voice, audible agent audio, and visible customer/agent transcript have been demonstrated in recorded live-browser smoke evidence;
- the web labels Live Agora and Replay Demo explicitly and does not silently present replay as live voice.

Transcript presentation hardening remains a Phase 9 quality task: some displayed text can contain spacing, punctuation, repeated-fragment, or chunk-boundary artifacts. It does not reopen the Phase 9 architecture and does not affect the approved Phase 10 closure.

Phase 9.2 may continue with static-prompt artifacts and controlled evaluation as its own workstream. Phase 10 is complete as optional LLM extraction behind strict schemas and deterministic domain guardrails; it is not an LLM-based transcript formatting repair.

The transcript hardening work has source-level implementation in place but is not yet a PASS/demo-ready claim. Its outstanding local verification debt (fresh live Agora proof, DB-backed coverage, lint, and format checks) remains documented and must not be described as green; it is not a condition blocking Phase 10 kickoff under this user-approved transition.

---

## 2. Canonical pipeline status

| Pipeline phase | Current assessment | Evidence / notes |
| --- | --- | --- |
| 0 — Contract normalization | **Implemented** | Canonical product, architecture, API/event/error, and privacy contracts exist. |
| 1 — Workspace, API scaffold, config, CI | **Implemented** | Workspace scripts, local environment conventions, CI, and Compose baseline exist. |
| 2 — Shared executable contracts | **Implemented** | Shared schemas, DTOs, events, errors, enums, and contract tests exist. |
| 3 — Deterministic domain kernel | **Implemented** | Deterministic scoring, payment gate, agreement guards, and transition guards exist. |
| 4 — PostgreSQL / Prisma / inventory / repositories | **Implemented** | Durable state, migrations, repositories, inventory behavior, and DB-backed tests exist. |
| 5 — Replay REST API, audit trail, outbox, SSE | **Implemented** | Fastify orchestration, durable event flow, replay path, and SSE recovery exist. |
| 6 — Replace browser fixture authority in web | **Implemented** | Web API-mode state, REST/SSE recovery, reconnect behavior, and privacy-safe projections exist. |
| 7 — Durable mock payment, proof, receipt | **Implemented** | Server-authoritative payment/proof/receipt happy and failure paths exist. |
| 8 — Solana Devnet payment verification | **Implemented** | Solana Pay URL/QR, reference discovery, server verification, proof/receipt linkage, and manual Devnet evidence exist. |
| 9 — Agora voice, transcript, token integration | **Complete — closure scope** | Live voice and transcript path are demonstrated; P0 transcript display-quality hardening remains open. |
| 9.2 — Agora conversation quality optimization | **GO — V1 draft only** | Versioned static prompt artifacts may be maintained; controlled live prompt evaluation and activation remain pending. |
| 9.3 — Server-to-agent runtime directives | **Not started** | Future Phase 9 follow-up; domain/API decides what the next step is, agent decides how to phrase it. |
| 10 — Strict-schema LLM extraction | **Complete** | Server-side strict-schema adapter, deterministic fallback, and deterministic-domain authority are the approved closure boundary. |
| 11 — Fleet Revenue Twin | **MVP complete — automated pass** | DB-backed snapshot, deterministic optimizer, bounded incentives, persisted acceptance, safe directive/dashboard projections, and deterministic simulation are implemented; controlled Agora live smoke is still pending. |
| 12 — E2E, observability, accessibility, deployment | **Partial / after Phase 11** | Health/readiness, CORS, rate limiting, runbooks, and local checks exist; broader hardening follows the Fleet Revenue Twin work. |
| 13 — Outcome labeling, evaluation, opt-in data | **Not started** | Later phase. |
| 14 — Redis, queue, object storage | **Deferred** | No active infrastructure provider integration is required for current demo closure. |

---

## 3. Authority model

The following boundaries are non-negotiable.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Browser / web app | microphone permission, direct RTC join, rendering, local recovery UX | booking confirmation, risk decision, payment verification, receipt issuance |
| Agora | real-time audio, agent interaction, transcript/provider facts | inventory, availability, risk, payment, proof, receipt, refund decisions |
| API | token/session orchestration, transcript admission, REST endpoints, SSE stream | arbitrary business authority delegated to provider or browser |
| Domain | booking validation, risk, inventory, agreement, payment gate, state transitions | voice phrasing or provider reasoning |
| PostgreSQL | durable truth, audit/event history, idempotency, recovery state | temporary browser-only UI state |
| Solana Devnet | payment evidence and transaction verification | customer PII, full transcript, product policy |
| Voice prompt | concise conversational phrasing | deciding booking/payment/receipt/availability state |

Rules:

- The browser never creates authoritative payment success.
- Only an admitted final customer transcript becomes durable business input.
- Interim transcript can be shown for UX but is not business authority.
- Agent display text is conversational UI output. It is not a source of booking, risk, payment, proof, or receipt authority.
- The agent must not claim availability, booking confirmation, payment verification, or receipt issuance unless the server-authoritative state explicitly supports the claim.
- No full transcript, raw phone number, seed phrase, private key, wallet secret, or raw agreement payload is written on-chain.

---

## 4. Phase 8 — Solana Devnet acceptance baseline

Phase 8 is implemented with a provider-neutral payment boundary.

| Requirement | Status | Recorded evidence |
| --- | --- | --- |
| Server creates payment request | **Pass** | Server returns Devnet-only Solana Pay URL and QR payload. |
| Reference and memo exclude PII | **Pass** | Random base58 reference and opaque/versioned memo structure. |
| Browser cannot authoritatively confirm payment | **Pass** | Browser submits only intent/verification request; server verifies facts. |
| Automatic transaction discovery | **Pass** | Server discovers candidate signatures from payment reference. |
| Recipient, amount, reference, execution, confirmation checks | **Pass** | Verifier fails closed for mismatch and failed/unconfirmed transactions. |
| One-time transaction consumption | **Pass** | Reused signature is rejected; no second receipt is created. |
| Retry-safe RPC handling | **Pass** | Pending/not-found/timeout/unavailable states remain retryable. |
| Durable proof and receipt linkage | **Pass** | Confirmed transaction creates one proof and one Trust Receipt atomically. |
| Privacy-safe persistence | **Pass** | No raw phone, transcript, or full agreement is stored on-chain or exposed in events. |
| Browser polling and refresh behavior | **Pass** | Payment drawer polls safely and terminal state recovers from server. |
| Real Devnet smoke | **Pass, manual** | Devnet transaction confirmation has been recorded; this remains distinct from commercial settlement. |

Solana verifies payment evidence only. It does not decide booking risk, agreement validity, payment-gate state, or receipt policy.

---

## 5. Phase 9 — current closure and open quality work

### 5.1 Closed Phase 9 scope

The closed Phase 9 scope is:

```text
API creates call session
  → API issues scoped, short-lived Agora RTC metadata
  → browser joins RTC directly
  → customer and agent conversation is audible in live browser sessions
  → provider transcript facts are normalized/admitted
  → final customer turn reuses canonical transcript/domain path
  → deterministic booking extraction and domain rules update state
  → SSE and REST recovery update the web UI
```

The recorded browser smoke baseline confirms live microphone usage, agent audio, and visible customer/agent transcript in the browser. The project must continue to label replay as replay and live Agora as live Agora.

### 5.2 Historical start failures

A historical or isolated `POST /v1/voice-sessions/:callId/start` response with `503 Service Unavailable` does not, by itself, invalidate the recorded live-browser evidence.

If a start failure recurs, it must be diagnosable with safe correlation data:

```text
callId
correlationId
channel
agent session state
browser RTC readiness state
provider HTTP status
redacted provider code/reason
retryable classification
```

Never log certificates, secrets, tokens, raw authorization headers, or unrestricted transcripts.

### 5.3 Current P0: transcript display-quality hardening

**Status:** IN PROGRESS — automated display/assembly hardening has been implemented; fresh live-browser Agora validation is still required before marking PASS.

Observed symptoms may include:

- missing spaces between fragments;
- repeated words or duplicated snapshots;
- punctuation attached to the wrong fragment;
- awkward line breaks or visually “stuck” Vietnamese text;
- final text differing from the last interim text unexpectedly.

This is treated as a Phase 9 quality issue, not as a justification to reopen Phase 9 architecture and not as a trigger to start Phase 10.

The required sequence is:

```text
raw provider frame
  → API-normalized transcript text
  → browser DOM textContent
  → visual rendering
```

The team must identify exactly which layer introduces the formatting problem before changing behavior.

### 5.4 Transcript hardening diagnostic note — 2026-06-22

Controlled local utterance:

```text
Dạ, em muốn đặt ba chỗ từ Đà Nẵng ra Hà Nội, chuyến bảy giờ tối.
```

Trace finding:

| Layer | Finding |
| --- | --- |
| Raw provider frame | The RTM/API boundary accepts final `user.transcription` / `assistant.transcription` frames and a custom `ctc.transcript.final/v1` frame. Provider text may contain repeated whitespace or punctuation-boundary artifacts. The current durable path does not persist interim frames. |
| API-normalized payload | `packages/agora` and the RTM relay now apply shared deterministic display normalization before provider text reaches the canonical final-turn admission path. Non-final provider frames remain non-durable. |
| Browser DOM textContent | Web SSE and REST recovery projections now run the same display normalization before rendering transcript bubbles. |
| Confirmed defect layer | Combination of missing deterministic display normalization at provider/API/web projection boundaries plus missing scoped transcript typography utilities. No booking/risk/payment/proof behavior changed. |

Added automated coverage:

- shared transcript assembly tests for snapshot replacement, delta joining, duplicate final frames, stale sequence frames, speaker/turn isolation, punctuation, whitespace, and time/money/phone-like preservation;
- Agora adapter tests for display-safe normalization and final/interim status preservation;
- RTM relay tests for provider-frame normalization before forwarding;
- API command test proving interim provider transcript frames do not enter durable admission;
- web projection tests for SSE and REST transcript display normalization;
- scoped typography source test for Vietnamese-safe transcript bubble wrapping.

No LLM extraction, semantic rewriting, prompt rewrite, risk change, payment change, proof change, or receipt change was introduced.

Current implementation facts:

- A shared deterministic transcript display helper exists.
- Snapshot replacement, delta boundary joining, duplicate-final suppression, stale-frame protection, and speaker/turn isolation are implemented at the helper/test level.
- Whitespace cleanup and punctuation-boundary cleanup are deterministic and non-semantic.
- The display normalizer does not perform LLM repair, semantic rewrite, automatic capitalization, or automatic terminal-punctuation insertion.
- Browser projection masks PII before display normalization.
- The normalizer no longer blindly inserts whitespace after `.` because that can corrupt email, URL, decimal, and abbreviation-like text.
- `TranscriptTurnCreated` SSE projection and `TRANSCRIPT_SYNCED` REST recovery projection use the same transcript display projection path.
- Transcript bubbles use scoped Vietnamese-safe typography.
- Regression coverage is intended for email, URL, time, money, PII masking, SSE display normalization, and REST recovery.
- The source-line guardrail refactor reduced `serverEventProjection.js` below 300 lines and moved transcript display tests into a focused test file.

Expected safe handling examples, pending complete verification:

```text
person@example.com must not become person@example. com
https://example.com/path must not be split
19:00 must remain readable
20h00 must not become 20h 00
300.000 đ must remain readable
```

Display-formatting boundary:

```text
Transcript display formatting preserves readable provider/ASR text.
It does not interpret or canonicalize a user's spoken time.
```

Booking extraction is separate final-turn/domain behavior. For supported input forms, booking extraction may normalize time to catalogue-compatible `HH:mm` values, for example `20h00` to `20:00` or `7h00` to `07:00`. Unsupported, ambiguous, or unavailable times must not be invented.

### 5.5 Current verification evidence — 2026-06-22

| Area | Status | Evidence / note |
| --- | --- | --- |
| `git diff --check` | **PASS** | Passed in the latest verification report. |
| Frozen install under temporary pnpm 11.1.1 | **PASS, historical/local** | Completed before the package-manager baseline correction. This is not a pnpm 11 migration claim. |
| Runtime package export regression | **PASS** | 7/7 package checks passed. |
| Prisma schema validation | **PASS** | Schema validation passed. |
| Typecheck | **PASS** | Turbo typecheck passed with 17/17 tasks. |
| API suite before display-expectation reconciliation | **PARTIAL PASS** | Reached 25/26 passing before the legacy display expectation was identified. |
| API suite after expectation reconciliation | **PASS, focused** | Confirmed the display-preserving contract; DB-backed cases may still depend on local test DB configuration. |
| API authority invariants | **PASS in focused coverage** | Interim provider frames do not enter durable transcript admission; only customer turns propose booking facts; final agent turns do not mutate customer booking; Solana payment verification coverage remained passing. |
| Source-line guardrail | **PASS** | Passed after extraction refactor. |

Not yet verified to completion after the latest PII/projection refactor:

- web test suite;
- Prettier/format gate;
- lint;
- root test suite after package-manager baseline correction;
- full build;
- API and web runtime smoke after a clean dependency restore;
- fresh real-browser Agora Live validation after transcript formatting changes.

### 5.6 Active local verification blocker

After restoring the repository package-manager baseline to `pnpm@10.34.4`, the current local dependency graph became incomplete or inconsistent during verification. The focused web test could not resolve workspace/runtime dependencies, including `@call-to-cash/shared` and `react`.

This is currently a local dependency-resolution/toolchain blocker, not evidence that the transcript source fix is incorrect.

Package-manager decision:

- The repository's canonical declared baseline is `pnpm@10.34.4`.
- This matches the existing root dependency pin and `tests/workspaceStructure.test.js`.
- A temporary, unreviewed `pnpm@11.1.1` `packageManager` value was reverted.
- This repository should not be described as having completed a pnpm 11 migration.

---

## 6. Current priority order

 1. **Keep Phase 9 closure scope intact.** Do not rewrite Agora/API/Solana architecture.
 2. **Treat transcript formatting as a Phase 9 hardening bug.** It is a display/frame-assembly concern.
 3. **Trace one controlled sentence through three layers:** raw provider frame → API normalized text → DOM textContent.
 4. **Correct fragment assembly:** distinguish snapshot, delta, and final frames.
 5. **Apply deterministic display normalization only:** whitespace, punctuation boundaries, duplicate suppression, and sequence handling.
 6. **Check CSS and typography:** confirm wrapping/word-break rules do not make correct text appear broken.
 7. **Add regression tests:** unit, integration, and browser coverage for the observed failure modes.
 8. **Record a fresh live proof:** readable customer/agent transcript, booking/risk update, and refresh recovery.
 9. **Continue Phase 9.2 V1 evaluation:** transcript presentation remains its independent acceptance requirement.
10. **Start Phase 10 behind strict guardrails:** add optional structured extraction in `packages/ai`, validate it deterministically, and retain the deterministic provider as the safe fallback.

---

## 7. Transcript-quality acceptance criteria

Transcript formatting hardening is complete only when all conditions below hold.

### Data and frame behavior

```text
[ ] Snapshot/interim frames replace the active bubble for the same turn.
[ ] Delta frames append only the new fragment with boundary-aware joining.
[ ] Duplicate frames and older sequence frames do not change visible text.
[ ] Final frames freeze exactly one final bubble.
[ ] A final customer turn is admitted to the canonical transcript command once.
[ ] Interim text does not create booking facts or durable business state.
```

### Deterministic display normalization

```text
[ ] Unicode is normalized consistently.
[ ] Leading/trailing whitespace is removed.
[ ] Repeated internal whitespace is collapsed safely.
[ ] Spaces before punctuation are removed.
[ ] Adjacent letter/number fragments are not joined without a needed boundary.
[ ] Times, currency, masked phone numbers, and valid identifiers are not damaged.
[ ] No semantic rewriting or LLM “beautification” is used.
```

### UI and recovery

```text
[ ] Customer and agent transcript are legible on desktop and mobile.
[ ] CSS does not use destructive word splitting for Vietnamese text.
[ ] Final transcript remains visible after refresh when the product policy persists it.
[ ] Booking/risk changes remain server-authoritative and recover through SSE/REST.
[ ] Live/Replay labels remain accurate throughout recovery and fallback.
```

### P0 PASS exit gate

Transcript display-quality hardening may move from `IN PROGRESS` to `PASS` only when all conditions below are met:

```text
[ ] A clean dependency restore using the declared pnpm@10.34.4 baseline passes.
[ ] Shared, Agora, RTM relay, API, and web focused test suites pass.
[ ] format:check, db:validate, lint, typecheck, root test, and build pass.
[ ] API /health, /ready, and demo:preflight pass in the intended local demo configuration.
[ ] A fresh real-browser Agora Live test confirms:
    - customer transcript is readable;
    - agent transcript is readable;
    - no accidental merged words;
    - no repeated snapshot text;
    - time, money, URL, and PII-like formatting remains safe;
    - booking/risk updates after the final customer turn;
    - Ctrl+R recovery restores authoritative transcript and booking state;
    - UI truthfully indicates Agora Live rather than Replay Demo.
[ ] No LLM semantic rewrite was introduced.
```

Standard browser sentence for live validation:

```text
Dạ, em muốn đặt 3 chỗ từ Đà Nẵng ra Hà Nội lúc 19:00 ngày 25 tháng 6, điểm đón ở bến xe trung tâm.
```

Additional format checks:

```text
- "em đi lúc 7h00"
- "em đi lúc 20h00"
- an email/phone masking scenario without using real personal data
```

---

## 8. Phase 9.2 — Conversation Quality Optimization

### Status

```text
GO for draft artifacts.
V1 remains DRAFT.
No V1 prompt is promoted or activated merely because it exists in source.
```

Phase 9.2 is not LLM extraction. It is a versioned static system prompt and evaluation workstream that makes the agent:

- speak concise, natural Vietnamese;
- ask one meaningful question at a time;
- handle ambiguity, silence, and interruptions gracefully;
- direct payment/verification users to server-rendered UI status;
- avoid unsupported business claims and sensitive-data requests.

### Precondition for controlled V1 evaluation

Before controlled V1 prompt evaluation, the team must record:

```text
[ ] transcript formatting quality pass;
[ ] one fresh live run proving readable transcript;
[ ] no silent replay fallback;
[ ] no unsupported authority claim;
[ ] clear live/replay UI label.
```

### Phase 9.3 remains separate

Future runtime directives follow this rule:

```text
Domain/API decides WHAT the next business step is.
Voice agent decides HOW to phrase it.
```

Phase 9.3 is not implemented in this snapshot.

---

## 9. Phase 10 — Strict-schema LLM Extraction

**Status:** COMPLETE by user-approved roadmap closure. The strict-schema adapter/fallback slice is implemented with the approved server-side OpenAI `gpt-5-mini` provider while deterministic domain authority remains unchanged.

Phase 10 is complete independently of the remaining Phase 9 transcript-quality verification debt. Follow-up provider or DB evidence may be added as quality evidence, but it is not an open Phase 10 exit condition under the agreed roadmap.

Current optional flow:

```text
final CUSTOMER transcript
  → deterministic-first/hybrid extraction orchestration
  → optional GPT-5 mini strict-schema candidate
  → shared schema validation
  → deterministic normalization and catalogue validation
  → domain rules
  → durable booking/risk state
  → SSE and REST recovery
```

Phase 10 is not speech-to-text, not transcript rendering, and not prompt wording.

The LLM must never decide:

```text
availability
inventory hold
risk score
booking confirmation
payment gate
payment verification
proof creation
Trust Receipt issuance
```

LLM must not be introduced to repair spacing, punctuation, chunk ordering, or CSS bugs.

The completed implementation preserves these rules:

1. keep `AI_PROVIDER=deterministic` as the default/fallback path;
2. add an optional provider adapter in `packages/ai` that returns strict shared-schema output with confidence and evidence references;
3. treat invalid, partial, ambiguous, or timed-out model output as missing data;
4. preserve deterministic domain authority and the existing API/event/state-machine contracts until a separately documented contract change is approved.

---

## 10. Phase 11 — Fleet Revenue Twin

**Status:** COMPLETE / automated verification passed. The Scenario-Robust Revenue Rebalancing Optimizer exposes Priority Allocation, Dynamic Incentive, and Overflow Routing. It protects scarce hot-departure capacity by offering a voluntary move only when the alternative retains policy-defined surplus; it never auto-reroutes a customer or revokes a hold. An explicit no-offer waitlist is durable but creates no hold. Isolated PostgreSQL migration, API lifecycle, idempotency, dashboard privacy, and inventory concurrency validation passed. Controlled live-provider smoke remains an operational follow-up and is not represented as completed.

```text
11.0 — Contract Normalization
11.1 — Fleet Demand & Departure Snapshot
11.2 — Overflow Recommendation Engine
11.3 — Incentive Policy Engine
11.4 — Offer Acceptance & Inventory Revalidation
11.5 — Voice Negotiation Runtime Directive
11.6 — Revenue Recovery Dashboard
11.7 — Multi-demand Simulation
```

This is a capability sequence, not authorization to add undocumented routes, events, states, entities, PII fields, payment behavior, or external infrastructure. Each lane starts with its governing contract/documentation update and must preserve PostgreSQL and centralized domain authority.

---

## 11. Verification and evidence standard

### Automated verification

The repository should continue to run the standard local gates defined by its workspace:

```text
format check
database validation
lint
typecheck
unit and integration tests
build
runtime package export regression checks
```

Database/API destructive integration tests must use an isolated test database. Any skipped integration test must be reported honestly.

### Live provider verification

Manual provider smoke evidence remains separate from automated tests.

A readable live transcript run must prove:

```text
[ ] explicit Agora Live label
[ ] microphone permission
[ ] real user sentence not present in fixtures
[ ] readable customer transcript
[ ] audible agent response
[ ] readable agent transcript
[ ] final customer turn affects booking/risk through authoritative state
[ ] refresh recovery
[ ] clear fallback state if live voice fails
```

### Judge evidence

Capture redacted evidence only:

```text
[ ] Agora Live state
[ ] customer/agent transcript
[ ] booking/risk update
[ ] agreement confirmation
[ ] Solana Devnet request
[ ] server-verified payment state
[ ] Trust Receipt
[ ] refresh recovery
[ ] optional retry/replay/end-state UX
```

Never capture secrets, seed phrases, private keys, unmasked phone numbers, raw webhook signatures, raw tokens, or unrestricted full transcripts.

---

## 12. Known open items

1. Complete transcript display-quality hardening verification and preserve regression tests.
2. Record a fresh live run that specifically proves readable transcript output after the fix.
3. Run controlled Phase 9.2 V1 evaluations: happy paths, interruption, silence, and payment-verifying state.
4. Obtain/retain a green CI run for the relevant committed branch/descendant.
5. Add browser E2E coverage for payment drawer and recovery where not already covered; Phantom signing remains a manual Devnet smoke step.
6. Implement authentication/RBAC before exposing booking/payment APIs outside controlled demo conditions.
7. Resolve the current local dependency-resolution/toolchain blocker through the canonical `pnpm@10.34.4` workspace setup, not through undocumented local workarounds.
8. Run the controlled live Agora Revenue Twin smoke before making a production-provider claim.
9. Redis, queues, and object storage remain deferred to Phase 14.

---

## 13. Go / no-go

**Phase 9 core closure:** **GO / complete by user-approved scope.**

**Transcript display-quality hardening:** **GO / P0 active work.**

**Phase 9.2 static prompt V1:** **GO for draft maintenance; not yet activated or fully evaluated.**

**Phase 10 strict-schema LLM extraction:** **GO / complete by user-approved roadmap closure.**

**Phase 11 Fleet Revenue Twin:** **MVP COMPLETE / automated verification passed; controlled live Agora smoke pending.**

The approved next progression is:

```text
run controlled Agora Revenue Twin smoke
  → preserve deterministic fallback and domain authority
  → continue Phase 9 transcript hardening and fresh live proof independently
  → evaluate Phase 9.2 V1 when its own acceptance criteria are met
  → sequence 11.1–11.7 only through documented contracts
```
