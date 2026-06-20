# Call-to-Cash Risk Copilot — Current State

> **Snapshot date:** 2026-06-20 (Asia/Bangkok)
> **Baseline:** Phase 5 authoritative replay API
> **Conclusion:** Phases 0–5 are implemented. PostgreSQL now owns replay call, transcript, risk, booking, agreement, mock payment, proof, receipt, and durable event state. The existing web experience remains fixture-driven until Phase 6 connects it to REST/SSE.

## 1. Executive summary

The repository now contains:

1. a responsive React/Vite scripted demonstration;
2. executable shared Zod contracts and pure domain policy;
3. a Prisma/PostgreSQL durable model and inventory repository;
4. a Fastify replay API with server-owned commands and reads;
5. a durable per-call SSE event stream with reconnect recovery;
6. an idempotent deterministic mock payment-to-receipt vertical slice.

```text
replay transcript
  -> durable turn
  -> deterministic extraction and risk
  -> booking draft and inventory hold
  -> immutable agreement lock
  -> idempotent mock payment verification
  -> proof and Trust Receipt
  -> ordered committed SSE events
```

The API is authoritative for the Phase 5 flow. The browser demo is not yet wired to it, and no response or event should be interpreted as live Agora or Solana activity.

## 2. Implemented boundaries

| Area | Current status |
|---|---|
| Workspace/tooling | pnpm/Turbo, frozen lockfile, shared TypeScript/ESLint/Prettier, root quality commands |
| `packages/shared` | API DTOs, IDs, domain schemas, errors, and canonical event envelopes |
| `packages/domain` | state transitions, risk/gate policy, inventory guards, agreement canonicalization |
| `packages/db` / `prisma` | durable model, migration, deterministic seed, repositories and DB integration tests |
| `apps/api` | health/readiness, Phase 5 REST commands/reads, durable SSE, mock payment/proof/receipt |
| `apps/web` | polished fixture-driven simulation; Phase 6 server adapter not implemented |
| Provider packages | Agora, Solana, and AI adapter boundaries remain scaffolds |

## 3. Phase 5 API surface

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
GET  /v1/payments/:bookingId/status
GET  /v1/receipts/:receiptId
GET  /v1/receipts/:receiptId/verify
```

`/ready` succeeds only when PostgreSQL is reachable. Booking confirmation and both mock payment commands require `Idempotency-Key`.

## 4. Authoritative behavior and recovery

- Final transcript turns are persisted before deterministic analysis runs.
- Shared request schemas reject client-supplied authority fields.
- Risk, booking, inventory, agreement, payment, proof, and receipt decisions are server-owned.
- Agreement confirmation stores a canonical immutable payload and SHA-256 hash.
- Exact command replay returns the original result; reuse with changed input returns the documented idempotency conflict.
- Successful payment verification creates one transaction, proof, and receipt.
- Definitive mismatch persists rejected evidence, emits `payment.failed`, and moves the booking to manual review.
- Demo tamper verification changes only a comparison copy and never mutates the locked agreement.
- Events are written in the same transaction as state, using append-only `audit_logs` rows with `aggregate_type = CALL_STREAM`.
- PostgreSQL advisory transaction locks serialize per-call sequence allocation.
- The normal events endpoint is long-lived; `Last-Event-ID` replays only later committed events. `?snapshot=true` provides a finite recovery/testing view.

No Phase 5 database migration is required because the event stream reuses the Phase 4 audit table.

## 5. Privacy and security posture

- Phase 5 replay persists only a masked contact plus a demo placeholder in the encrypted column; it deliberately does not retain the raw phone before a production encryption/key-management design exists.
- Full transcripts, canonical agreement payloads, and score reasoning are not emitted through receipt or SSE projections.
- No audio, transcript, phone, PII, or full agreement payload is written on-chain.
- The Phase 5 payment provider is explicitly mock; Solana private keys and authoritative verification remain absent.
- The tamper query is allowed only with `DEMO_MODE=true`.
- Authentication, ownership authorization, RBAC, consent enforcement, retention jobs, rate limiting, and production secret-management integration remain later hardening work.

## 6. Verification status

Phase 5 has dedicated TDD evidence in [phase-5-replay-api.tdd.md](../testing/phase-5-replay-api.tdd.md). The implemented integration suite covers:

- durable transcript/risk/event ordering and reconnect;
- a live SSE subscription receiving a later committed event;
- agreement and payment idempotency;
- happy-path proof/receipt creation;
- persisted mismatch/manual review;
- locked-agreement immutability during tamper comparison;
- PostgreSQL readiness and structured errors.

The full repository gate is:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database and API integration suites use `TEST_DATABASE_URL` and should run sequentially because both reset synthetic test data. Coverage percentage is not claimed because the workspace has no configured coverage command or threshold.

Prisma validation, lint, typecheck, root tests, build, DB integration (5/5), and API integration (7/7) pass. The root `format:check` retains pre-existing drift in 25 untouched files; all Phase 5 TypeScript/JSON files pass a targeted Prettier check.

## 7. Remaining roadmap

| Priority | Work item | Pipeline phase |
|---:|---|---:|
| P0 | Replace fixture authority with a web REST/SSE adapter and refresh recovery | 6 |
| P1 | Complete UX/error/reconnect handling against the authoritative API | 6 |
| P1 | Add authentication, ownership authorization, and production hardening | cross-cutting |
| P2 | Add Solana devnet generation and server-side verification | 8 |
| P2 | Add Agora voice/transcript integration | 9 |
| P2 | Add optional validated LLM extraction | 10 |
| P2 | Add Redis/object storage only when a real consumer exists | 11 |
| P2 | Add E2E, accessibility, observability, deployment, and incident evidence | 12 |

## 8. Change summary

- **Documentation consulted:** privacy, API, event, state-machine, data-model, decisions, pipeline, booking, risk, error-code, local setup, deployment, ECC workflow, and prior Phase 4 TDD evidence.
- **Documentation updated:** API/event/data-model/local-setup contracts, API boundary README, Phase 5 TDD evidence, and this current-state snapshot.
- **Contracts changed:** Phase 5 mock payment/receipt DTOs and the canonical `agreement.locked` event replace the obsolete `booking.confirmed` name.
- **Database migration required:** no.
- **Environment variables added or changed:** none; existing `DATABASE_URL`, `TEST_DATABASE_URL`, and `DEMO_MODE` are used.
- **Tooling changed:** the package-local Turbo graph serializes Prisma generation before DB compiler/test tasks.
- **Remaining mocked integrations:** deterministic replay extraction, mock payment, browser fixture UI, Agora, Solana, optional LLM, Redis, and object storage.
