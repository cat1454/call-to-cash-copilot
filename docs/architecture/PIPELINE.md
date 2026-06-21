# Call-to-Cash Risk Copilot — Final Implementation Pipeline

> **Status:** Canonical execution plan  
> **Audience:** engineering team, implementation agents, technical leads, reviewers  
> **Scope:** turn the existing presentation-ready React demo into a server-authoritative MVP without rewriting the finished UX shell.  
> **Current baseline:** `apps/web` is a functional scripted simulation. `apps/api` and the domain packages are scaffolds. The first goal is not live voice; it is a durable, deterministic transaction core.

---

## 0. Product invariant

Call-to-Cash is **not** a voicebot that happens to show a payment screen. It is a controlled transaction system where voice/transcript data is converted into a booking, risk decision, immutable agreement, payment intent, privacy-safe proof, and recoverable Trust Receipt.

```text
Transcript / voice input
  → extracted facts
  → deterministic validation + risk gate
  → active inventory hold
  → immutable agreement snapshot
  → payment intent
  → payment verification
  → proof record
  → Trust Receipt
```

The following are non-negotiable:

1. The browser is never authoritative for payment, proof, risk, or state transitions.
2. The LLM/AI may suggest extracted facts; deterministic domain logic decides payment eligibility.
3. A payment cannot be created without an active inventory hold, locked agreement, explicit confirmation, and open payment gate.
4. Full audio, full transcript, raw PII, and raw AI reasoning never go on-chain.
5. Every material change invalidates confirmation and creates a new agreement version.
6. All integration providers are adapters around the same domain commands and state machines.
7. Demo mode must be explicit; no UI may claim a live Agora or Solana connection when it is simulated.

---

## 1. Fixed architecture decisions

### 1.1 Runtime and package boundaries

```text
apps/
  web/                 React/Vite presentation and API client
  api/                 Fastify server; authoritative application boundary

packages/
  shared/              Zod schemas, DTOs, enums, API/event/error contracts
  domain/              Pure business rules and state transitions
  db/                  Prisma client, schema, repositories, transactions
  ai/                  Extraction providers/adapters; never payment authority
  agora/               Agora token, transcript, webhook, recording adapters
  solana/              Payment intent, verification, proof adapters
  config/              Environment validation, TS/ESLint/shared config
```

`packages/domain` is required even if it does not exist yet. Do not place business rules in React components, Fastify route handlers, or `packages/ai`.

### 1.2 Technology decisions

| Concern                  | Decision                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| New code                 | TypeScript                                                                     |
| API                      | Fastify                                                                        |
| Validation               | Zod                                                                            |
| Persistence              | PostgreSQL + Prisma                                                            |
| API realtime transport   | Server-Sent Events (SSE) for MVP                                               |
| Cache/queue              | Redis only when a concrete worker/retry/buffer consumer exists                 |
| Local object storage     | MinIO, only when recording/media flow starts                                   |
| Staging/production media | private AWS S3, only when cloud recording is enabled                           |
| Payment proof            | server-side canonical JSON + SHA-256, linked to Solana payment/reference later |
| Initial voice input      | deterministic transcript replay                                                |
| Initial payment provider | deterministic mock provider                                                    |
| Live chain target        | Solana devnet before any mainnet decision                                      |

### 1.3 Naming decisions

- Workspace namespace: `@call-to-cash/*`.
- Realtime transport term: `SSE` for the MVP browser stream.
- Canonical risk document name: `RISK-SCORING.md`.
- The canonical commercial policy must have an ID and version. Never use unversioned hard-coded refund copy in UI or business logic.

---

## 2. Final phase map

The pipeline intentionally has **14 implementation phases: Phase 0 through Phase 13**. Do not skip phase exit criteria. A later phase may begin only when its dependency phase has a passing test baseline and a reviewable change set.

```text
P0  Normalize contracts and freeze the demo baseline
P1  Make the workspace executable and reproducible
P2  Implement shared contracts in code
P3  Implement the deterministic domain kernel
P4  Add PostgreSQL, Prisma, inventory, and durable state
P5  Build the authoritative Fastify replay API and SSE stream
P6  Connect the existing UI to REST/SSE server authority
P7  Complete mock payment, proof, receipt, and tamper vertical slice
P8  Replace mock payment with Solana devnet verification
P9  Replace replay input with Agora voice/transcript integration
P10 Add optional LLM extraction behind deterministic guardrails
P11 Add Redis, MinIO/S3, consent, and media/recording workflow
P12 Harden quality, security, observability, CI, and deployment
P13 Collect evaluation data and prepare opt-in training workflow
```

---

# Phase 0 — Normalize contracts and freeze the baseline

## Role

Remove contradictions before they become code. This is a small, bounded cleanup phase, not an invitation to write more product documentation.

## Inputs

- Existing `docs/architecture`, `docs/contracts`, `docs/product`, `docs/security`, and `docs/operations` files.
- Existing UI copy and scenario fixtures.
- Current-state audit findings.

## Required work

1. Commit the existing documentation baseline; do not leave architecture/contracts as untracked work.
2. Normalize all references to `RISK-SCORING.md`.
3. Normalize package names to `@call-to-cash/*`.
4. Declare SSE as the canonical browser realtime transport for MVP; remove ambiguous WebSocket wording unless explicitly marked as future option.
5. Record Node + Fastify + TypeScript + Prisma as the implementation decision in the relevant ADR/README files.
6. Choose one canonical refund policy for the hackathon demo. Recommended example:

   ```text
   Policy ID: BUS-V1
   Version: 1.0
   Cancellation at least 12 hours before departure: 80% of the deposit refunded.
   Cancellation less than 12 hours before departure: deposit is non-refundable.
   ```

7. Update all UI strings, seed data, booking contracts, and demo scenario copy to that exact policy.
8. Add explicit `DEMO_MODE=true` configuration and a UI-visible, non-disruptive demo mode indicator.
9. Update stale editor rules and PWA colors/manifest values so they match the current design system.
10. Fix the local Node/pnpm certificate/toolchain issue correctly by trusting the valid organization/root CA where applicable. Do not disable TLS verification.

## Deliverables

- One normalization PR.
- `.env.example` with at least `DEMO_MODE`, `PAYMENT_PROVIDER`, `VOICE_PROVIDER`, and `AI_PROVIDER`.
- One canonical refund policy object/seed source.

## Exit criteria

```text
- No conflicting refund policy remains.
- Docs, package manifests, and source imports use one namespace.
- pnpm install, lint, typecheck, test, and build work in at least one standard developer/CI environment.
- UI has a truthful simulation/live indicator.
```

## Do not do

- Do not add Agora, Solana, Redis, S3, or LLM integrations.
- Do not rebuild the visual UI.

---

# Phase 1 — Make the workspace executable and reproducible

## Role

Establish a reliable repository foundation so every later change can be developed, tested, and run consistently.

## Required work

1. Validate `pnpm-workspace.yaml`, `turbo.json`, root scripts, and package dependency boundaries.
2. Keep the existing React/Vite app inside `apps/web`; do not rewrite it.
3. Create `apps/api/src` with only an application skeleton and health/readiness endpoints.
4. Create source entrypoints for all package boundaries, including `packages/domain`.
5. Establish shared TypeScript, ESLint, Prettier, and test configuration through `packages/config` or root configuration.
6. Ensure root scripts run workspace tasks:

   ```json
   {
     "dev": "turbo dev",
     "build": "turbo build",
     "lint": "turbo lint",
     "typecheck": "turbo typecheck",
     "test": "turbo test",
     "format": "prettier --write ."
   }
   ```

7. Add a minimal CI workflow that at least installs dependencies, lints, typechecks, tests, and builds.

## Deliverables

- `apps/api` starts independently.
- `GET /health` and `GET /ready` return a standard envelope.
- Every package has a build/typecheck/test entrypoint even if business logic is not yet implemented.

## Exit criteria

```text
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

run successfully from a clean checkout in CI.

## Do not do

- Do not create database tables yet.
- Do not move all frontend JavaScript to TypeScript as a prerequisite.

---

# Phase 2 — Implement shared contracts in code

## Role

Turn the written contracts into executable schemas, enums, DTOs, errors, and events that frontend and backend share.

## Ownership

`packages/shared` is the only source of truth for contracts that cross application boundaries.

## Required modules

```text
packages/shared/src/
  schemas/
  enums/
  api/
  events/
  errors/
  constants/
  index.ts
```

## Required types and schemas

- Public ID schemas: call, booking, agreement, payment intent, receipt, event, user.
- `CallSession`, `TranscriptTurn`, `BookingExtraction`, `RiskAssessment`, `PaymentGateDecision`, `Agreement`, `PaymentIntent`, `PaymentVerification`, `ProofRecord`, `TrustReceipt`.
- API success/error envelope schemas.
- Canonical event envelope schema.
- Request/response schemas for the first replay vertical slice.
- All state-machine enums.
- Stable reason-code and error-code constants.

## Required state enums

```text
CallStatus
BookingStatus
PaymentGateStatus
PaymentIntentStatus
PaymentTransactionStatus
ProofStatus
ReceiptStatus
InventoryHoldStatus
```

## Required rules

- No duplicated string status literals in `apps/web` or `apps/api`.
- No contract type is copied by hand between packages.
- Event names are constants, not arbitrary strings.

## Tests

- Zod schema acceptance/rejection tests.
- Serialization/round-trip tests for API envelopes and events.
- Package import boundary test.

## Exit criteria

```text
- apps/web and apps/api can import the same DTOs/enums.
- Invalid payloads are rejected by schemas, not guessed by route handlers.
- All documented statuses/events/errors have executable definitions.
```

---

# Phase 3 — Implement the deterministic domain kernel

## Role

Build the product’s differentiator: a pure, testable engine that decides whether a booking is complete, safe enough, confirmed, and eligible for payment.

## Ownership

`packages/domain` owns business decisions. It must not make network calls, access Prisma directly, read environment variables, or depend on React/Fastify/Agora/Solana/LLM SDKs.

## Required modules

```text
packages/domain/src/
  booking/
  inventory/
  risk/
  payment-gate/
  agreement/
  proof/
  state-machines/
  policies/
  index.ts
```

## Required functions

```text
validateBookingFields()
applyBookingExtraction()
calculateCompleteness()
calculateDisputeRisk()
calculatePaymentReadiness()
evaluatePaymentGate()
getRequiredNextAction()
applyMaterialChange()
invalidateConfirmationOnMaterialChange()
canCreatePaymentIntent()
transitionCall()
transitionBooking()
transitionPaymentIntent()
transitionReceipt()
serializeCanonicalAgreement()
```

## Business rules that must be enforced

A payment gate may open only when all conditions are true:

```text
completeness >= configured threshold
paymentReadiness >= configured threshold
disputeRisk <= configured threshold
explicitConfirmation === true
activeInventoryHold === true
currentAgreementVersion is locked
no critical blocker exists
```

The agreed initial thresholds remain configurable/versioned, but MVP defaults are:

```text
completeness >= 85
paymentReadiness >= 80
disputeRisk <= 35
```

## Required blocking conditions

The following ordinary conditions keep the gate `LOCKED` or `READY_FOR_CONFIRMATION`; they do not by themselves escalate the customer to manual review:

```text
MISSING_ROUTE
MISSING_DEPARTURE_TIME
MISSING_PASSENGER_COUNT
MISSING_PICKUP_POINT
MISSING_CONTACT
MISSING_PRICE / MISSING_DEPOSIT_AMOUNT
REFUND_POLICY_NOT_CONFIRMED
INVENTORY_UNAVAILABLE / INVENTORY_HOLD_EXPIRED
NO_EXPLICIT_CONFIRMATION
```

The domain maps the older descriptive labels `MISSING_PRICE_OR_DEPOSIT`, `MISSING_POLICY_CONFIRMATION`, and `NO_ACTIVE_INVENTORY_HOLD` to the executable shared reason codes above. Only material integrity/payment exceptions such as `AGREEMENT_VERSION_STALE`, payment mismatches, proof mismatch, or an already-finalized payment/receipt enter `MANUAL_REVIEW_REQUIRED`.

## Proof rules

- Canonical agreement serialization must be deterministic and versioned.
- The domain serializer returns canonical bytes/string; server cryptography performs SHA-256 later.
- Include agreement version, booking ID, policy ID/version, price/deposit, seats, route/time, and other agreed commercial fields.
- Never include raw phone, full transcript, raw audio, wallet private data, or raw AI reasoning.

## Tests — mandatory before persistence

```text
- Missing pickup point keeps gate locked.
- Missing policy acceptance keeps gate locked.
- Missing active inventory hold keeps gate locked.
- Explicit confirmation false keeps the gate non-payable (`READY_FOR_CONFIRMATION`).
- Material route/time/seat/deposit/policy change invalidates confirmation.
- Critical integrity/payment blocker forces `MANUAL_REVIEW_REQUIRED` with `BLOCK` regardless of aggregate scores.
- Valid complete booking with hold and confirmation opens the gate.
- State transition attempts outside allowed paths fail deterministically.
- Canonical serialization is stable across equivalent object key order.
```

## Exit criteria

The existing scenario fixture cannot cause a payment to open unless the same domain evaluator returns `OPEN`.

---

# Phase 4 — Add PostgreSQL, Prisma, inventory, and durable state

## Role

Make the server the source of truth for calls, transcripts, booking drafts, inventory holds, agreements, payments, proof records, receipts, and audit history.

## Required local stack

Start with PostgreSQL only. Add Redis/MinIO only in later phases when their first consumer exists.

```text
Docker Desktop / Compose
  └── PostgreSQL
```

## Ownership

- Prisma schema, client, migrations, and repositories: `packages/db`.
- Business rules: remain in `packages/domain`.
- Transaction orchestration: later in `apps/api` services.

## MVP relational model

```text
users
call_sessions
transcript_turns
trip_departures
inventory_holds
bookings
booking_extractions
risk_assessments
agreements
payment_intents
payment_transactions
proof_records
trust_receipts
audit_logs
```

## Key data constraints

1. `trip_departures` has capacity, operational status, route, departure time, and authoritative price source/version.
2. `inventory_holds` include quantity, expiry, active/released/expired/consumed status, and are tied to a booking/departure.
3. An agreement is append-only/versioned; never update a locked agreement in place.
4. `payment_intents` have unique opaque reference and idempotency key.
5. `payment_transactions.tx_signature` is unique when live chain support is added.
6. A receipt maps to exactly one finalized proof record and one booking snapshot.
7. Audit rows are created for every material command and state transition.
8. Raw PII is not copied to proof/on-chain-shape tables.

## Repository requirements

- Use explicit transactions for booking confirmation, inventory hold, agreement lock, payment intent creation, payment verification, proof creation, and receipt issuance.
- Use optimistic or row-level concurrency control around inventory capacity.
- Enforce expiry server-side, never from browser countdown alone.

## Seed data

Create a deterministic demo departure, for example:

```text
Departure: HN-SAPA-20260620-2230
Capacity: 36
Available seats: 36
Price policy: BUS-PRICE-V1
Refund policy: BUS-V1 / 1.0
Deposit: 300,000 VND
```

## Exit criteria

A Trust Receipt can be traced through:

```text
receipt
→ proof record
→ payment transaction
→ payment intent
→ locked agreement version
→ booking
→ inventory hold
→ risk assessment
→ transcript turns
→ call session
```

---

# Phase 5 — Build the authoritative Fastify replay API and SSE stream

## Role

Implement one complete server-authoritative workflow using deterministic transcript replay and deterministic mock payment. This is the first meaningful end-to-end MVP slice.

## API ownership

`apps/api` orchestrates commands, validates shared schemas, calls pure domain functions, writes through repositories, emits events, and applies authentication/authorization later. Route handlers stay thin.

## Required API endpoints for the first vertical slice

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

## Required server behavior

1. A transcript turn persists first.
2. The API derives or updates a deterministic booking extraction.
3. The API evaluates risk and gate from facts through `packages/domain`.
4. The API emits `transcript.turn.created`, `risk.score.updated`, and `risk.payment_gate.updated` after committed persistence.
5. Booking confirmation locks a new agreement version only if guards pass.
6. Mock payment intent creation is idempotent and only accepts a locked agreement with an open gate.
7. Mock verification validates amount/reference/recipient equivalent and is idempotent.
8. Payment confirmation creates a proof record and Trust Receipt once only.
9. A tampered agreement copy never mutates the locked snapshot; verification returns `MISMATCH` and `MANUAL_REVIEW_REQUIRED`.

## SSE requirements

- Use the canonical event envelope in `packages/shared`.
- Support a stable event ID and `Last-Event-ID`/recovery behavior or a documented refetch fallback.
- Emit events only after database commit.
- Add correlation IDs to command logs/events.
- Browser commands remain REST; SSE is server-to-browser state propagation.

## Initial event set

```text
call.created
transcript.turn.created
risk.score.updated
risk.payment_gate.updated
booking.updated
agreement.locked
payment.intent.created
payment.confirmed
payment.failed
receipt.created
receipt.verified
```

## Tests

- API contract tests for valid/invalid requests.
- Repository integration tests.
- Idempotency tests.
- Invalid state transition tests.
- SSE event order and recovery tests.
- End-to-end test for happy path and proof mismatch path.

## Exit criteria

The full replay flow completes with the browser disconnected or closed. State survives refresh because the server/database, not React state, owns the transaction.

---

# Phase 6 — Connect the existing UI to REST/SSE server authority

## Role

Preserve the finished presentation UI while replacing fixture authority and browser-only payment/proof simulation.

## Required frontend changes

1. Add a typed REST client using shared request/response schemas.
2. Add an SSE client/reducer with reconnect and refetch behavior.
3. Add server read-model hooks such as:

   ```text
   useCallSession()
   useCallEvents()
   useBookingReadModel()
   useReceiptVerification()
   ```

4. Keep visual transcript replay, animations, mobile/desktop layouts, timeline, receipt, and mentor console.
5. Convert scenario fixtures into replay input data sent to API, not direct UI score/payment control.
6. Render server-provided masked contact values by default.
7. Render `DEMO_MODE` truthfully.
8. Prevent service-worker caching for API, payment status, receipt verification, and event endpoints.

## Required behavioral change

```text
Before:
web fixture → React state → payment drawer → fake receipt

After:
web scenario/replay command → API/domain/DB → SSE + read APIs → React rendering
```

## Exit criteria

- Browser refresh recovers in-progress call/booking/payment state from API. In demo mode, a terminal receipt or manual-review session starts fresh on reload; durable server records remain unchanged.
- No component can create a receipt, confirm payment, or open the payment gate from local booleans.
- Existing UI remains presentation-ready.

---

# Phase 7 — Complete the mock payment, proof, receipt, and tamper vertical slice

## Role

Finish the deterministic transaction experience before any external provider integration.

## Required mock provider behavior

- Generate an opaque payment reference from server state.
- Use controlled demo recipient and amount.
- Verify expected reference, amount, recipient, asset/network marker, and expiry.
- Make create/verify commands idempotent.
- Simulate known outcomes: confirmed, failed, expired, wrong amount, wrong reference, duplicate verification.

## Required proof behavior

1. Lock agreement snapshot.
2. Serialize canonical agreement server-side.
3. Create real SHA-256 proof hash server-side using Node crypto.
4. Persist proof hash + canonicalization version + agreement version.
5. Associate proof record with payment/receipt.
6. Verify receipt by recomputing hash against immutable snapshot.
7. Never mutate historical agreement or proof record to make a mismatch disappear.

## Required UI behavior

- Receipt shows human-friendly booking/deposit/policy/status first.
- Technical proof is collapsed/secondary.
- Tamper demo must modify a comparison copy or request verification against altered candidate data; it must never overwrite the locked source record.
- Mismatch moves to manual review state.

## Exit criteria

The team can demo:

```text
Transcript replay
→ safe gate
→ active hold
→ immutable agreement
→ idempotent mock payment
→ server SHA-256 proof
→ durable Trust Receipt
→ intentional mismatch → manual review
```

---

# Phase 8 — Replace mock payment with Solana devnet verification

## Role

Integrate Solana as the payment/proof verification layer without changing the business core.

## Boundary

`packages/solana` implements a provider adapter. It must not decide booking completeness, risk, or gate state.

## Required work

1. Create a server-side Solana Pay transfer request or equivalent payment intent representation from a confirmed booking.
2. Generate unique reference/memo values that contain no PII.
3. Render payment URL/QR from server-provided data.
4. Verify server-side against the configured devnet RPC:

   ```text
   recipient
   amount
   asset/token mint
   reference
   transaction confirmation/finality
   one-time consumption of transaction signature
   ```

5. Store transaction signature, network, reference, verification time, and result.
6. Link existing proof hash/reference to payment record in the agreed privacy-safe way.
7. Treat RPC timeouts/failures as pending or manual review; never optimistically confirm from frontend wallet callback.

## Security requirements

- No mainnet by default.
- No private key in browser.
- No PII in memo/reference/on-chain data.
- No token issuance, trading, lending, prediction market, or token promotion.

## Exit criteria

A real devnet transaction can replace mock confirmation while the same agreement, gate, receipt, and state-machine rules remain unchanged.

---

# Phase 9 — Replace replay input with Agora voice/transcript integration

## Role

Add live voice as an input adapter after the transaction core is proven.

## Boundary

```text
Browser ↔ Agora: real-time media/audio
Browser ↔ API: REST commands + SSE state
API ↔ Agora: token issuance, webhook/recording configuration, metadata
```

Agora does not decide payment, create receipts, or persist business truth.

## Required work

1. API creates call session before user joins.
2. API issues scoped, short-lived Agora token and channel metadata.
3. Browser joins Agora channel directly and handles microphone permissions, mute, end call, and reconnect UX.
4. Transcript provider sends normalized transcript turns to API.
5. API persists transcript turns and routes them through the same extraction/domain evaluation path as replay.
6. API broadcasts canonical SSE events to web.
7. Display accurate connection state; only show “connected” after actual provider connection.
8. Add consent flow before optional recording/transcription where required by product policy.

## Voice UX rules

- Ask one missing field at a time.
- Confirm low-confidence/high-impact values such as time, passenger count, and contact number.
- Never auto-fill critical booking fields from ambiguous voice input.
- Provide human handoff/end-call path.
- Keep raw transcript concise in customer UI; detailed logs belong in controlled mentor/operator view.

## Exit criteria

Live transcript input creates exactly the same server-owned booking/risk/payment state as deterministic replay.

---

# Phase 10 — Add optional LLM extraction behind deterministic guardrails

## Role

Use AI to extract structured facts and recommend the next question while keeping all business authority in the domain layer.

## Boundary

```text
AI returns: extracted fields, confidence, missing fields, suggested next question, evidence references.
Domain returns: score, blockers, gate state, allowed next action.
API returns: persisted, validated, auditable state.
```

## Required implementation pattern

1. Keep deterministic extraction provider for demo and test mode.
2. Add LLM provider as an adapter in `packages/ai`.
3. Require strict Zod output validation.
4. Store provider/model/prompt version, confidence, and evidence segment references.
5. Treat invalid/partial/ambiguous output as missing data, never as confirmation.
6. Maintain a fallback path when LLM times out or fails.
7. Redact/mask PII before unnecessary model calls where feasible.

## Prohibited AI behavior

- AI cannot directly call payment create/verify endpoint.
- AI cannot override inventory availability.
- AI cannot mark user confirmation true based on sentiment alone.
- AI cannot infer risk from accent, gender, emotion, or perceived nervousness.

## Exit criteria

LLM can be disabled with `AI_PROVIDER=deterministic`, and all acceptance tests still pass with deterministic domain decisions.

---

# Phase 11 — Add Redis, MinIO/S3, consent, and media/recording workflow

## Role

Add infrastructure only after there is an actual worker/media requirement.

## Redis triggers

Add Redis when at least one of these exists:

- outbox/event dispatcher;
- retryable payment-verification worker;
- expiry worker for inventory holds/payment intents;
- real-time transcript buffering;
- rate limiting or distributed locks.

Redis is not the source of truth. PostgreSQL remains authoritative.

## MinIO/S3 triggers

Add MinIO locally and private S3 in staging/production only when audio/recording/evidence files exist.

## Consent requirements

Track separately:

```text
recording_consent
analysis_consent
training_consent
policy_version
consented_at
revoked_at
```

## Storage policy

- Raw audio: optional, consent-bound, private, short retention.
- Transcript: off-chain, masked for non-essential views.
- Derived training candidate: only after explicit training consent and outcome labeling.
- On-chain: only payment/proof metadata permitted by privacy policy.

## Required background jobs

- expire inventory holds;
- expire payment intents;
- retry pending verification;
- dispatch outbox events;
- enforce storage retention/deletion;
- detect unprocessed recording uploads if recording is enabled.

## Exit criteria

The project can run local audio-object workflows with MinIO and staging recording workflows with private S3 without exposing credentials to the browser.

---

# Phase 12 — Harden quality, security, observability, CI, and deployment

## Role

Make the working vertical slice reliable enough to demo, deploy, troubleshoot, and evolve safely.

## Required quality gates

- Unit tests: shared/domain functions and state transitions.
- Contract tests: API DTO/error/event schemas.
- Repository/integration tests: persistence, transaction, idempotency, concurrency-sensitive inventory behavior.
- API E2E tests: happy path, blockers, expiration, mismatch, duplicate payment, invalid transition.
- Web tests: key user interactions, responsive/mobile flow, accessibility basics.
- Visual regression or screenshot checks for the finished demo shell where practical.
- CI: install, lint, typecheck, unit, integration/E2E, build.

## Required observability

- structured logs with correlation IDs;
- request IDs and event IDs;
- error tracking;
- health/readiness checks;
- metrics for transcript-to-decision latency, gate denial reasons, payment verification results, receipt mismatch, inventory expiry, provider failures;
- no raw PII or secrets in logs.

## Required security

- environment validation at server startup;
- secret scanning in CI;
- least-privilege S3/IAM when storage begins;
- auth/RBAC before non-demo operator/admin capabilities;
- rate limiting for public endpoints;
- audit logs for material actions;
- data-retention jobs and deletion flow;
- no TLS bypasses.

## Required deployment behavior

- staging before production;
- migrations applied through controlled job/process;
- deploy rollback plan;
- feature flags/provider modes;
- safe mock mode for demos;
- no dependency on browser cache for critical financial state.

## Exit criteria

A clean environment can deploy the replay-first vertical slice, migrate safely, observe it, and roll back without losing transaction authority.

---

# Phase 13 — Collect evaluation data and prepare opt-in training workflow

## Role

Measure and improve the system only after the end-to-end system produces durable outcomes. Evaluation starts once the authoritative flow exists; model training waits for consented, labeled outcomes.

## Evaluation data begins after Phase 7

Persist, with appropriate masking and access controls:

```text
call session
transcript turns
booking extraction + provenance
risk assessment + reason codes
payment gate decisions
agreement version
payment outcome
receipt verification outcome
human correction / manual review outcome
```

## Training eligibility

A record becomes a training candidate only when all are true:

```text
training_consent = true
PII has been redacted or transformed according to policy
outcome is known or reviewed
label has a reviewer/provenance record
record passed quality checks
```

## Outcome labels

```text
completed_successfully
cancelled_by_customer
cancelled_by_operator
refund_issued
dispute_opened
dispute_confirmed
payment_anomaly
booking_confirmation_failure
inconclusive
```

## Data split rule

Split train/validation/test by user/provider/time where possible. Do not randomly split turns from the same booking/caller across train and test.

## Metrics

### Voice/input quality

- transcript-to-decision latency;
- field extraction accuracy;
- low-confidence confirmation rate;
- diarization/STT quality only if those features are enabled.

### Risk/gate quality

- false unlock rate;
- false lock rate;
- precision/recall against reviewed disputes/anomalies;
- reason-code coverage;
- score calibration.

### Product quality

- completed booking rate;
- average turns to complete;
- handoff rate;
- payment verification success;
- receipt verification success;
- dispute/refund trend.

## Exit criteria

The team can answer, with data rather than intuition:

```text
Did the gate open safely?
Which fields cause customer friction?
Which extraction failures create manual review?
Which confirmed bookings later become disputes?
Which records are eligible to improve the model?
```

---

## 3. First vertical-slice acceptance target

The first backend milestone is complete only when all statements below are true:

1. A scripted transcript replay creates a durable call session and booking draft.
2. Required booking fields and their provenance are validated by shared schemas.
3. Scores are calculated from facts, not fixture totals.
4. Missing pickup, policy acceptance, inventory hold, or explicit confirmation keeps the gate locked with reason codes.
5. Explicit confirmation locks one immutable agreement version.
6. The server computes a real SHA-256 hash from canonical agreement data.
7. A mock payment intent can be created only from a locked agreement and open gate.
8. Create/verify requests are idempotent.
9. A correct mock payment creates exactly one proof record and Trust Receipt.
10. Altering candidate agreement data produces `MISMATCH` and manual review without mutating the locked snapshot.
11. The existing mobile and desktop UI receive state progression through REST/SSE.
12. No raw phone, transcript, full agreement payload, secret, or raw AI reasoning appears in proof/on-chain-shaped fields or logs.
13. Unit, contract, repository, and vertical-slice integration tests run in CI.

---

## 4. Priority and dependency rules

### P0 — Must exist before provider integration

```text
Shared contracts
Domain rules/state machines
PostgreSQL persistence
Inventory hold
API/SSE
Mock payment/proof/receipt
UI server adapter
```

### P1 — Add after the core transaction is authoritative

```text
Solana devnet
Agora live voice
LLM extraction
Redis workers
MinIO/S3 recording
```

### P2 — Add after live flow proves the need

```text
Advanced fraud analytics
Model training/fine-tuning
Multi-agent workflows
Cloud recording at scale
Mainnet policy review
Expanded verticals
```

---

## 5. Anti-patterns explicitly prohibited

1. Building live Agora before replay-first transaction flow passes.
2. Letting `gateUnlocked` or any frontend flag authorize payment.
3. Letting an LLM decide payment/open gate directly.
4. Creating payment without an active inventory hold.
5. Updating a locked agreement instead of versioning it.
6. Confirming payment from a browser wallet callback without server verification.
7. Storing raw PII/audio/transcript on-chain or in memo/reference.
8. Using browser-generated mock hash as production proof.
9. Adding Redis, MinIO, S3, or queues without a current consumer.
10. Hiding mock integrations behind live-provider language.
11. Rewriting the polished frontend unnecessarily.
12. Disabling TLS verification to work around local package installation problems.

---

## 6. Definition of production-shaped readiness

Call-to-Cash is not “done” because voice works. It becomes production-shaped when it can demonstrate this reliably:

```text
Voice/transcript or replay input
→ fact extraction with provenance
→ deterministic safe gate
→ active inventory hold
→ immutable, versioned agreement
→ idempotent payment verification
→ privacy-safe proof
→ durable Trust Receipt
→ recover/replay/manual-review path
```
