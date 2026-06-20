# API modular refactor discovery notes

> Stage A discovery snapshot for the behavior-preserving modular refactor. This file intentionally documents the current monolithic implementation before code is moved.

## Current responsibilities found in `phase5-service.ts`

- Defines public service result shapes, local booking/risk helper types, and local constants such as mock recipient and refund-policy summary.
- Owns technical helpers: opaque ID generation, ISO timestamp formatting, SHA-256 hashing, short signatures, JSON coercion, phone masking, redaction, Vietnamese-ish replay text normalization, deterministic fact extraction, booking-status transition chaining, and event action naming.
- Owns durable event append through `appendEvent`, using `audit_logs` rows with `aggregate_type = CALL_STREAM`, stable event IDs, per-call sequence allocation, and shared `EventEnvelopeSchema` validation.
- Owns call-session use cases: create call, get call, end call, append transcript turn, deterministic replay fact extraction, call activation, and risk/event recomputation after final transcript.
- Owns booking use cases: upsert booking from replay facts, create/refresh inventory hold, load booking risk context, derive risk, get risk, get booking, confirm booking, canonical agreement creation, agreement SHA-256 hash persistence, and agreement event append.
- Owns payment use cases: create mock payment intent, enforce payment-gate eligibility, verify mock payment, idempotency replay/conflict checks, expiry checks, wrong amount/recipient/reference failure, payment transaction creation, inventory hold consumption, proof creation, Trust Receipt creation, and payment/receipt events.
- Owns receipt use cases: payment status read, receipt read model, receipt verify read model, demo-only candidate deposit tamper comparison, mismatch/manual-review transition, and receipt verification event append.
- Owns event replay query: read committed `CALL_STREAM` audit rows, validate them as shared event envelopes, sort by sequence, and apply `Last-Event-ID`.

## Original route to service/use-case mapping before extraction

| Route                                     | Current owner in `app.ts`              | Current service call                                             |
| ----------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `GET /health`                             | inline route                           | no service; returns process liveness envelope                    |
| `GET /ready`                              | inline route                           | direct `databaseClient.$queryRaw(SELECT 1)`                      |
| `POST /v1/calls`                          | inline route                           | `Phase5ReplayService.createCall`                                 |
| `GET /v1/calls/:callId`                   | inline route                           | `Phase5ReplayService.getCall`                                    |
| `POST /v1/calls/:callId/end`              | inline route                           | `Phase5ReplayService.endCall`                                    |
| `POST /v1/calls/:callId/transcript-turns` | inline route                           | `Phase5ReplayService.submitTranscriptTurn`                       |
| `GET /v1/calls/:callId/events`            | inline route                           | `Phase5ReplayService.getEvents` plus inline SSE writer/poll loop |
| `GET /v1/calls/:callId/risk`              | inline route                           | `Phase5ReplayService.getRisk`                                    |
| `GET /v1/bookings/:bookingId`             | inline route                           | `Phase5ReplayService.getBooking`                                 |
| `POST /v1/bookings/:bookingId/confirm`    | inline route                           | `Phase5ReplayService.confirmBooking`                             |
| `POST /v1/payments/mock/create`           | inline route                           | `Phase5ReplayService.createMockPaymentIntent`                    |
| `POST /v1/payments/mock/verify`           | inline route                           | `Phase5ReplayService.verifyMockPayment`                          |
| `POST /v1/payments/mock/simulate-failure` | inline route with demo guard           | `Phase5ReplayService.simulatePaymentFailure`                     |
| `GET /v1/payments/:bookingId/status`      | inline route                           | `Phase5ReplayService.getPaymentStatus`                           |
| `GET /v1/receipts/:receiptId`             | inline route                           | `Phase5ReplayService.getReceipt`                                 |
| `GET /v1/receipts/:receiptId/verify`      | inline route with candidate/demo guard | `Phase5ReplayService.verifyReceipt`                              |

## Current database transaction boundaries

- `createCall`: wraps call creation, `CALL_CREATED` audit row, and `call.created` committed event in one transaction.
- `endCall`: wraps call status transition and `call.ended` event append in one transaction.
- `submitTranscriptTurn`: wraps duplicate-turn check, call activation, turn persistence, booking upsert, extraction row, risk assessment, booking/risk events, and call-session booking pointer update in one transaction.
- `upsertBookingFromFacts`: called inside the transcript transaction; mutates or creates booking and may call inventory reservation helper.
- `ensureInventoryHold`: currently uses `InventoryRepository.reserve`, which owns its own serializable transaction outside the caller transaction.
- `recomputeRiskAndEvents`: mutates booking status, writes `risk_assessments`, and appends transcript/booking/risk/gate events inside the caller transaction.
- `confirmBooking`: wraps idempotency replay/conflict, booking/risk/hold validation, agreement creation, booking transition, confirmation audit row, `agreement.locked` event append, and post-lock risk/gate event append in one transaction.
- `createMockPaymentIntent`: wraps idempotency replay/conflict, booking/gate/hold/agreement eligibility, payment intent creation, booking `PAYMENT_PENDING` transition, audit row, and `payment.intent.created` event append in one transaction.
- `verifyMockPayment`: wraps idempotency replay/conflict, expiry check, payment pending/confirmed/rejected transitions, payment transaction creation, hold consumption, proof/receipt creation, manual-review or receipt-issued booking transition, audit row, and payment/receipt events in one transaction.
- `verifyReceipt`: wraps receipt/proof lookup, candidate comparison, proof/receipt mismatch mutation, booking manual-review transition, and `receipt.verified` mismatch event append in one transaction.
- `simulatePaymentFailure`: for `EXPIRED`, mutates only payment intent expiry without event append; for wrong values, delegates to `verifyMockPayment`.
- `getEvents`, `getCall`, `getRisk`, `getBooking`, `getPaymentStatus`, and `getReceipt` are read-only.

## Current audit/SSE append path

- `appendEvent(transaction, input)` counts existing `CALL_STREAM` audit rows for the call, builds `evt_*`, validates with `EventEnvelopeSchema`, and writes an `audit_logs` row.
- Event rows use:
  - `aggregateType: "CALL_STREAM"`
  - `aggregateId: callId`
  - `action: EVENT_<EVENT_NAME>`
  - `eventId: envelope.eventId`
  - `afterState: envelope`
  - `metadata: { event: input.event }`
- `GET /v1/calls/:callId/events?snapshot=true` returns a finite SSE payload generated from committed events.
- Normal `GET /v1/calls/:callId/events` hijacks the Fastify response, writes committed events, polls `getEvents` every 100ms, emits heartbeat comments every 15 seconds, and honors `Last-Event-ID` by replaying later committed events only.

## Existing tests that protect critical behavior

- `apps/api/src/app.test.ts`
  - `/health` success envelope.
  - replay call/transcript/booking/risk persistence and recoverable SSE event order.
  - live SSE connection receives events committed after subscription.
  - booking confirmation idempotency and conflict behavior.
  - mock payment creation idempotency and conflict behavior.
  - mock payment verify idempotency, missing-key rejection, and safe receipt projection.
  - payment mismatch failure, persisted manual review, failed event evidence, and tamper immutability.
  - `/ready` demo providers and safe missing-route envelope.
- `packages/domain/src/domain.test.ts`
  - booking field validation, required confirmation/hold blockers, deterministic scores, critical blockers, payment gate eligibility, material-change invalidation, state-transition table, and PII-safe canonical agreement serialization.
- `packages/db/src/db.test.ts`
  - inventory oversell prevention, inventory idempotency conflicts, expiry audit, privacy-safe receipt trace, locked-agreement/audit immutability constraints.
- `packages/shared/src/contracts.test.ts`
  - public IDs, DTO authority-field rejection, API envelopes, canonical event names, proof privacy, and response status schemas.
- `tests/workspaceStructure.test.js`
  - workspace shape, command surface, pnpm-only lock policy, Phase 1/4 artifacts, and normalization guard.

## Direct imports that must be migrated

Current direct source importers after Stage C call-session extraction:

```text
apps/api/src/bootstrap/create-dependencies.ts imports Phase5ReplayService from ../phase5-service.js
apps/api/src/bootstrap/types.ts imports Phase5ReplayService type from ../phase5-service.js
apps/api/src/bootstrap/register-routes.ts uses dependencies.phase5Service for booking/payment/receipt/call-events routes only
apps/api/src/phase5-service.ts imports ApiCommandError from ./platform/http/api-command-error.js
```

Search command used:

```text
rg -n "phase5-service|Phase5ReplayService|phase5Service" apps packages tests
```

## Contract/documentation drift found

- The current implementation name `Phase5ReplayService` now also contains Phase 7 mock payment/proof/receipt behavior, so the name is stale.
- `docs/report/CURRENT-STATE.md` now documents that Phase 7 backend capability is mostly present, while the browser API-mode product path is incomplete.
- The app-level API mode wiring gap is outside this backend refactor and must remain a separate Phase 6/7 web task.

## Stage B extraction performed in this slice

- Moved database/client/service composition to `bootstrap/create-dependencies.ts`.
- Moved CORS, rate-limit, and owned Prisma lifecycle registration to `bootstrap/register-plugins.ts`.
- Moved unchanged route/error-handler registration to `bootstrap/register-routes.ts`.
- Added shared bootstrap types in `bootstrap/types.ts`.
- Moved `/health` and `/ready` route ownership to `modules/health`.
- Moved `ApiCommandError` to `platform/http/api-command-error.ts`.
- Moved success/error envelope builders to `platform/http/api-response.ts`.
- Moved request schema parsing to `platform/http/validation.ts`.
- Moved `Idempotency-Key` extraction to `platform/http/idempotency.ts`.
- Moved SSE frame serialization to `platform/events/sse-writer.ts`.
- Reduced `app.ts` to Fastify creation plus dependency/plugin/route composition.
- Kept every REST route, public DTO, error code, status behavior, and `Phase5ReplayService` method call unchanged.

## Stage C extraction performed in this slice

Moved call-session route ownership to `apps/api/src/modules/call-session`:

- `POST /v1/calls`
- `GET /v1/calls/:callId`
- `POST /v1/calls/:callId/end`
- `POST /v1/calls/:callId/transcript-turns`
- `GET /v1/calls/:callId/risk`

Extracted active call-session behavior out of `Phase5ReplayService`:

- `createCall` -> `modules/call-session/commands/create-call-session.ts`
- `getCall` -> `modules/call-session/queries/get-call-session.ts`
- `endCall` -> `modules/call-session/commands/end-call-session.ts`
- `submitTranscriptTurn` -> `modules/call-session/commands/append-transcript-turn.ts`
- `getRisk` -> `modules/call-session/queries/get-call-risk.ts`

Added call-session adapter/presentation boundaries:

- `call-session.routes.ts` owns Fastify route declarations and shared-schema parsing for the five call-session routes.
- `call-session.handlers.ts` owns HTTP-to-use-case adaptation and database availability guard.
- `call-session.presenter.ts` owns call/risk projections and phone redaction/masking helpers.
- `replay/replay-normalizer.ts` and `replay/replay-extractor.ts` own deterministic replay-only transcript normalization and fact extraction.
- `platform/events/event-log.ts` owns the committed event append helper used by the extracted call-session path.

Remaining active methods in `Phase5ReplayService`:

- `getBooking`
- `confirmBooking`
- `createMockPaymentIntent`
- `verifyMockPayment`
- `getPaymentStatus`
- `getReceipt`
- `verifyReceipt`
- `simulatePaymentFailure`
- `getEvents`

`Phase5ReplayService` intentionally remains as the strangler facade for the yet-unextracted booking, payment, receipt, and call-events responsibilities. The five call-session routes no longer call it.

### Stage C transaction-boundary finding

`InventoryRepository.reserve` opens its own root serializable transaction through `inSerializableTransaction(this.client, ...)`. It does not accept or participate in the caller's transcript transaction. Stage C preserved this existing behavior instead of redesigning transaction ownership.

Regression-test plan for Stage D:

- add an integration test that proves transcript persistence, inventory hold creation, booking status update, risk assessment persistence, and event append stay recoverable when inventory reservation succeeds;
- add a failure-path test for inventory reservation errors to document whether a persisted transcript/booking draft without hold is expected or should be compensated;
- consider moving inventory reservation into a booking module transaction-aware boundary during Stage D without weakening oversell prevention.

### Stage C test evidence

- `pnpm --filter @call-to-cash/api typecheck` passed.
- `pnpm --filter @call-to-cash/api lint` passed.
- `pnpm --filter @call-to-cash/api test` passed with 3 tests executed and 4 DB-backed integration tests skipped because `TEST_DATABASE_URL` was not configured.

Exact next extraction target: Stage D, booking + agreement + inventory orchestration.

## Stage D extraction performed in this slice

- Registered `GET /v1/bookings/:bookingId` and `POST /v1/bookings/:bookingId/confirm` from `modules/booking`; neither route calls `Phase5ReplayService`.
- Moved active booking read, confirmation, agreement lock, inventory-hold orchestration, and booking/risk/gate event ownership to `modules/booking`.
- Added the `BookingDraftWriter` application port so call-session can request a draft update without owning booking policy.
- Changed transcript processing to one caller-owned serializable transaction: transcript, draft, inventory hold, extraction, risk assessment, and committed events now commit or roll back together.
- `InventoryRepository.reserveInTransaction` and `reserveInventory` keep the row lock/capacity/idempotency logic inside an existing transaction; `reserve()` remains the serializable top-level convenience method.
- Added a database integration regression proving a later parent-command failure rolls back both the hold and its inventory audit row. It requires `TEST_DATABASE_URL` to execute.

Remaining active `Phase5ReplayService` methods:

- `createMockPaymentIntent`
- `verifyMockPayment`
- `simulatePaymentFailure`
- `getPaymentStatus`
- `getReceipt`
- `verifyReceipt`
- `getEvents`

The facade intentionally remains for the next stage: **payment + proof extraction**. Its retired Stage D source block is non-executable and retained temporarily only as a source-reference bridge for that extraction.

## Pre-existing baseline failures before this refactor

Commands run before adding refactor notes/README skeletons:

| Command             | Baseline result                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm db:validate`  | Pass                                                                                               |
| `pnpm lint`         | Fail: unused `React` import in `apps/web/src/features/simulation/components/HeroSubComponents.jsx` |
| `pnpm typecheck`    | Pass                                                                                               |
| `pnpm test`         | Fail: `tests/workspaceStructure.test.js` rejects committed `package-lock.json`                     |
| `pnpm build`        | Pass                                                                                               |
| `pnpm format:check` | Fail: 44 files with Prettier drift                                                                 |

These failures are pre-existing repository hygiene/format issues and are intentionally not fixed in Stage A of the modular backend refactor.

## Stage E extraction performed in this slice

- Registered all four payment routes from `modules/payment`; they now use payment handlers and do not call `Phase5ReplayService`.
- Extracted `createMockPaymentIntent`, `verifyMockPayment`, `simulatePaymentFailure`, and `getPaymentStatus` into payment commands/queries.
- Moved API-safe payment projections into `payment.presenter.ts`, deterministic mock expectation/validation into `platform/providers/mock-payment-provider.ts`, and successful verification proof/Trust Receipt writes into `modules/payment/proof`.
- Preserved durable payment-create and payment-verify idempotency behavior, existing response envelopes/statuses/error codes, and committed event names.
- Preserved the existing demo expiry behavior: it only backdates the payment intent expiry and emits no event. This remains a Phase F/UI recovery concern; no expiry event was added because the current contract does not require one.

### Stage E transaction boundaries

- Intent creation remains one transaction: durable idempotency lookup/create, eligibility checks, payment intent, booking transition, and `payment.intent.created` append.
- Successful verification remains one transaction: durable idempotency replay/conflict check, transaction observation, hold consumption, proof, Trust Receipt, booking/payment transitions, and `payment.confirmed`/receipt committed events.
- Rejected verification remains one transaction: rejected evidence, payment/booking transitions, durable idempotency evidence, and `payment.failed` append.
- Proof and Trust Receipt creation are payment-owned success side effects. Receipt read and tamper verification remain outside the payment module.

### Remaining `Phase5ReplayService` facade surface

- `getReceipt`
- `verifyReceipt`
- `getEvents`

`phase5-service.ts` is intentionally retained as the small receipt/call-events facade until **Stage F: Receipt and Call Events extraction**. Its direct source importers are limited to bootstrap dependency composition/types and the receipt/call-events routes in `bootstrap/register-routes.ts`.
