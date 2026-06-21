# Demo Readiness Audit

> Snapshot: 2026-06-21 (Asia/Saigon)  
> Branch / inspected commit: `develop` / `60d8fd6`  
> Scope: architecture freeze before demo and voice UX hardening.

## Phase 9 evidence update

- Package manager: pnpm `11.1.1`.
- All internal TypeScript packages were rebuilt; `tests/packageRuntimeExports.test.js` passed 7/7 runtime package checks after rebuild.
- `pnpm db:validate`, lint, typecheck, test, and build passed locally. The final root test run loaded the dedicated database environment and completed DB/API coverage with no skips; the focused DB and API suites also passed 6/6 plus 10/10.
- Safe preflight passed with aligned `agora / agora`, Devnet configuration, browser-secret scan, PostgreSQL reachability, and API readiness.
- `/health` returned `ok`; `/ready` returned database `ready`, voice `agora`, and payment `solana_devnet`.
- Manual microphone, audible agent response, novel user/agent transcript visibility, and three-run refresh flow are **NOT TESTED for this change**. The system is ready for that validation; it is not yet newly live-verified.

## Current provider modes

- API configuration selects `VOICE_PROVIDER=agora` and `PAYMENT_PROVIDER=solana_devnet` locally.
- Web configuration must select `VITE_VOICE_PROVIDER=agora` for the live path. Replay remains an explicit operator choice, never a hidden Agora fallback.
- Deterministic extraction remains active. LLM extraction is not part of this work.

Required names only:

```text
DATABASE_URL
DEMO_MODE
PAYMENT_PROVIDER
SOLANA_CLUSTER
SOLANA_RPC_URL
SOLANA_RECIPIENT_PUBLIC_KEY
SOLANA_DEMO_AMOUNT_LAMPORTS
VOICE_PROVIDER
AGORA_APP_ID
AGORA_APP_CERTIFICATE
AGORA_CUSTOMER_ID
AGORA_CUSTOMER_SECRET
AGORA_WEBHOOK_SECRET
AGORA_CAI_PROPERTIES_JSON
VITE_API_BASE_URL
VITE_VOICE_PROVIDER
VITE_DEMO_MODE
```

## Confirmed live flow

```text
browser microphone → Agora RTC directly
→ API-issued scoped session metadata
→ signed/fresh provider final-turn event
→ shared append-transcript command
→ deterministic domain evaluation + PostgreSQL
→ committed SSE + Last-Event-ID / REST recovery
→ locked agreement
→ server-created Solana Devnet request
→ server-side transaction discovery and verification
→ proof + Trust Receipt
```

The browser submits only the payment-intent identifier for Solana verification. It does not submit authoritative recipient, amount, reference, payment status, proof, or receipt state.

## Replay fallback

Replay uses the same API transcript command, domain rules, persistence, events, agreement, payment, proof, and receipt pipeline. The UI labels replay explicitly and offers it only as an operator-visible choice after live voice failure.

## Documentation drift found

- Root `README.md` and early sections of `PIPELINE.md` still describe backend/provider packages as future scaffolds.
- `apps/api/src/REFACTOR-NOTES.md` intentionally retains historical references to the deleted monolith; no live source import remains.
- The previous Agora smoke record is historical evidence. This audit does not claim a new microphone + Phantom end-to-end run.
- Root `.env` is loaded by the API, while Vite reads `apps/web/.env`; duplicating browser values only in root `.env` does not configure the web app.

## Existing coverage

- Agora normalization and provider-turn deduplication tests.
- API tests for readiness, signed provider events, durable final turns, Solana pending/success/reuse, and receipt creation.
- SSE parser, reconnect, Last-Event-ID, event deduplication, gap recovery, and refresh read-model recovery tests.
- Domain/shared/database tests for gate, agreement, payment, privacy, idempotency, and receipt lineage.

## Risks before hardening

- Real microphone, CAI audio, Phantom signing, and Devnet confirmation still require manual smoke evidence with valid credentials.
- A live provider outage cannot be fully reproduced by unit tests.
- Browser unload can stop local media immediately, but a network request to stop the server session remains best-effort; server/provider expiry is the final cleanup guard.
- Current worktree contained pre-existing dependency/lockfile changes before this hardening task. The package-runtime fix extends those files and is identified separately in the final report.
