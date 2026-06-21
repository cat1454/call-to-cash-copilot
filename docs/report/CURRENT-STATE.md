# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-21 (Asia/Bangkok)
>
> **Branch / commit inspected:** `develop` / `cb4fce4` (`chore: close Phase 8 cleanup gaps`)
>
> **Purpose:** record the verified Phase 8 baseline and the gate for starting Phase 9.
>
> **Conclusion:** Phase 8 is functionally complete and the repository is ready to begin Phase 9. A green CI run for the current commit remains required before treating the Phase 8 closure as release-grade evidence.

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

Agora live voice/transcript is not implemented yet and is the next pipeline phase. Optional LLM extraction, Redis, object storage, and production hardening remain later phases.

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
|                9 — Agora live voice/transcript | **Not started**    | next safe implementation slice                                                                      |
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

### CI caveat

PR #9 merged as `84d7bf6`. Its CI run failed at `format:check` because two API files were not formatted. Commit `cb4fce4` corrected those files and the Windows line-ending configuration, and all local gates passed afterward.

The current GitHub workflow runs for pull requests and pushes to `main`, but not pushes to `develop`. Therefore `cb4fce4` currently has no GitHub status check. Add `develop` to the push trigger or run the current commit through a pull request before treating CI evidence as green.

---

## 5. Known gaps

These do not block beginning Phase 9, but they remain explicit engineering work:

1. Obtain one green GitHub CI run for `cb4fce4` or its descendant.
2. Add an automated browser E2E test for the payment drawer and recovery path. Phantom signing remains a manual smoke step.
3. Resolve the harmless checkout warning caused by the pinned `ECC` gitlink having no `.gitmodules` mapping, or retain the documented explicit-clone workflow.
4. Implement auth/RBAC before exposing sensitive booking/payment APIs beyond controlled demo environments.
5. Address the PostgreSQL client deprecation warning observed during integration tests before the relevant dependency upgrade becomes mandatory.

---

## 6. Next safe slice: Phase 9

Phase 9 should add Agora only as the media/transcript input adapter:

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

**Go for Phase 9 development:** yes.

**Phase 8 release-grade closure:** conditional on a green CI run for the current code. This is an evidence/automation gap, not a known Phase 8 functional defect.

---

## 8. Change summary for this snapshot

- **Documentation consulted:** `AGENTS.md`, `docs/architecture/PIPELINE.md`, `docs/architecture/DECISIONS.md`, `docs/contracts/API-CONTRACT.md`, `docs/contracts/EVENT-CONTRACT.md`, `docs/contracts/ERROR-CODES.md`, `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md`, `docs/operations/LOCAL-SETUP.md`, `docs/operations/SOLANA-DEVNET-SMOKE-TEST.md`, `docs/operations/ECC-AGENT-WORKFLOW.md`, and the previous current-state report.
- **Documentation updated:** this current-state snapshot and directly stale API README statements.
- **Contracts changed:** none.
- **Database migration required:** no.
- **Environment variables added/changed:** none.
- **Remaining mocked/later integrations:** Agora, optional LLM extraction, Redis, object storage, and Phantom signing automation.
