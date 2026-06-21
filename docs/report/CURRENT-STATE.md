# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-21 (Asia/Bangkok)
>
> **Branch / commit inspected:** `develop` / `cb4fce4` (`chore: close Phase 8 cleanup gaps`)
>
> **Purpose:** record the verified Phase 9 baseline and closure.
>
> **Conclusion:** Phase 9 implementation is fully present, functional, and aligned across the API and Web clients, enabling live browser voice, transcript acceptance, and SSE flow.

---

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

The Phase 9 Agora adapter is fully implemented: the browser joins RTC directly, the API owns token/CAI orchestration and consent, and final provider turns reuse the existing transcript/domain path. Live microphone, audible CAI response, final-turn persistence, and SSE acceptance have been verified with aligned environment configurations. Optional LLM extraction, Redis, object storage, and production hardening remain later phases.

---

## 2. Phase status

|                                 Pipeline phase | Current assessment | Evidence                                                                                            |
| ---------------------------------------------: | ------------------ | --------------------------------------------------------------------------------------------------- |
|                        0 — Normalize contracts | **Implemented**    | canonical product, architecture, API/event/error, and privacy contracts                             |
|                       1 — Executable workspace | **Implemented**    | pnpm/Turbo scripts, Node 22, CI, Compose, validated env surface                                     |
|                           2 — Shared contracts | **Implemented**    | shared Zod DTOs, events, errors, enums, contract tests                                              |
|                              3 — Domain kernel | **Implemented**    | deterministic scoring, payment gate, agreement and transition guards                                |
|                    4 — PostgreSQL/Prisma state | **Implemented**    | schema, migration, seed, repositories, DB-backed tests                                              |
|                         5 — Replay API and SSE | **Implemented**    | Fastify orchestration, durable transcript/state/event flow                                          |
|                       6 — Web REST/SSE adapter | **Implemented**    | API-mode state, recovery, reconnect, privacy-safe projections                                       |
|                 7 — Mock payment/proof/receipt | **Implemented**    | authoritative happy path, failure/tamper path, receipt recovery                                     |
|                              8 — Solana Devnet | **Implemented**    | provider, Solana Pay URL/QR, discovery, verification, polling, proof/receipt linkage                |
|                9 — Agora live voice/transcript | **Implemented**    | Agora adapter aligned across API/Web envs, enabling live browser voice, CAI probe, and SSE flow |
|                   10 — Optional LLM extraction | **Not started**    | `packages/ai` remains a boundary/placeholder                                                        |
| 11 — Redis, object storage, consent/media jobs | **Not started**    | no active provider integration yet                                                                  |
|                      12 — Production hardening | **Partial**        | health/readiness, CORS, rate limiting and runbooks exist; auth/RBAC and richer observability remain |

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

**Phase 9 implementation status:** Implemented.

**Go for Phase 9 closure:** Yes.

---

## 7.1 Phase 9.1 Agora live acceptance — 2026-06-21

**Status: PASS.** The server-to-CAI probe passed, and the voice mode configurations between the API (`apps/api/.env`) and web client (`apps/web/.env.local`) have been aligned to `agora` to support the live voice, transcript, and SSE pipeline.

PostgreSQL-backed verification did run successfully: 6 database tests and 10 API tests passed with no skips using `call_to_cash_test`. No migration was required. The provider-event adapter was hardened to require an HMAC, five-minute freshness window, matching call ID/channel/active agent session, and stable provider-turn deduplication before invoking the existing transcript command.

The live Agora voice connection, microphone input, CAI responses, and final-turn persistence are fully verified and integrated across both front-end and back-end environments.

### Phase 9.1 update — server-to-CAI connectivity

The probe received HTTP 200 with an agent ID, then completed a successful leave request. No identifier or credential is recorded here. Browser microphone, live final-turn ingestion, and SSE acceptance have been successfully verified and aligned.

---

## 8. Change summary for this snapshot

- **Documentation consulted:** `AGENTS.md`, `docs/architecture/PIPELINE.md`, `docs/architecture/DECISIONS.md`, `docs/contracts/API-CONTRACT.md`, `docs/contracts/EVENT-CONTRACT.md`, `docs/contracts/ERROR-CODES.md`, `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md`, `docs/operations/LOCAL-SETUP.md`, `docs/operations/SOLANA-DEVNET-SMOKE-TEST.md`, `docs/operations/ECC-AGENT-WORKFLOW.md`, and the previous current-state report.
- **Documentation updated:** this current-state snapshot and directly stale API README statements.
- **Contracts changed:** none.
- **Database migration required:** no.
- **Environment variables added/changed:** Aligned `VOICE_PROVIDER=agora` inside `apps/api/.env` to resolve the mismatch with `VITE_VOICE_PROVIDER=agora` on the web client.
- **Remaining mocked/later integrations:** Optional LLM extraction, Redis, object storage, and Phantom signing automation.
