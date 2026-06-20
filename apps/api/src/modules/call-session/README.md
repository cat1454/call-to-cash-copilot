# Call-session module

## 1. Purpose

Own the server-authoritative call lifecycle, final transcript intake, deterministic replay extraction adapter, call/risk read models, and the transcript-driven booking/risk recomputation path.

## 2. Owned routes

- `POST /v1/calls`
- `GET /v1/calls/:callId`
- `POST /v1/calls/:callId/end`
- `POST /v1/calls/:callId/transcript-turns`
- `GET /v1/calls/:callId/risk`

## 3. Owned use cases

- Create a call session and append the committed `call.created` event.
- Read a call session and its linked booking summary.
- End or cancel a call session and append the committed `call.ended` event.
- Persist a final transcript turn.
- Normalize replay text and extract deterministic replay facts.
- Upsert the booking draft from replay facts.
- Reserve inventory through the existing repository path when facts are complete enough.
- Recompute risk/gate through `packages/domain`.
- Append committed transcript, booking, risk, and gate events.
- Read the latest authoritative risk assessment for a call.

## 4. Inputs and outputs

Inputs are shared call and transcript DTOs from `@call-to-cash/shared` plus route parameters validated by shared public ID schemas. Outputs preserve the existing API envelopes and call/risk projections.

## 5. Allowed dependencies

- `@call-to-cash/shared`
- `@call-to-cash/domain`
- `@call-to-cash/db`
- local `platform/http` helpers
- local `platform/events` committed event append helper

## 6. Forbidden dependencies

- React or web code
- Solana/provider payment verification
- receipt/proof creation
- direct SSE streaming transport ownership
- route-handler Prisma access
- ad-hoc status strings outside shared/domain state rules

## 7. Transaction and event rules

- A final transcript turn is durable before analysis result becomes authoritative.
- Events are appended only through the committed event path.
- Event append occurs in the same transaction as the state mutation it describes.
- Call creation and call end each own one transaction with their corresponding event.
- Transcript intake preserves the existing Phase 5/7 behavior: transcript/booking/extraction persistence, inventory reservation, and risk/event recomputation occur in the same sequence as before this extraction.

## 8. Privacy rules

- Public call/risk projections do not expose raw PII.
- Transcript events use redacted content.
- Phone masking is centralized in `call-session.presenter.ts`.
- Replay extraction may detect booking facts, but it must not expose raw phone values into public projections/events.

## 9. Invariants

- A final transcript turn is durable before analysis result becomes authoritative.
- Call-session routes never calculate risk directly.
- `packages/domain` remains the sole owner of risk/gate/state rule evaluation.
- Events are appended only through the committed event path.
- Event append occurs in the same transaction as the state mutation it describes.
- Public call/risk projections do not expose raw PII.
- Replay extraction is an input adapter, not business authority.
- Future Agora transcript ingestion must reuse `append-transcript-turn` rather than creating a competing transaction pipeline.

## 10. Tests

Protected by `apps/api/src/app.test.ts` coverage for call creation, transcript persistence, risk recomputation, booking draft update, recoverable SSE event ordering, live SSE delivery after subscription, safe error envelopes, and redacted transcript event payloads.

DB-backed assertions require `TEST_DATABASE_URL`; without it, those integration cases are intentionally skipped by the existing test harness.

## 11. Future extension points

- Feed Agora transcript turns into the same append-transcript command.
- Replace deterministic replay extraction with a validated AI extraction adapter without changing downstream booking/risk/payment authority.
- Move booking/agreement/inventory orchestration into the booking module in Stage D while preserving this module as transcript intake owner.

## 12. Non-goals

- No booking confirmation/agreement lock extraction in Stage C.
- No payment intent, verification, proof, or receipt ownership.
- No call-events/SSE transport extraction.
- No Agora, Solana, Redis, MinIO/S3, schema, migration, endpoint, DTO, state-machine, or risk-threshold changes.
