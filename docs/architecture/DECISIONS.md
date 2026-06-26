# Call-to-Cash Risk Copilot — Architecture Decisions

> **Status:** Accepted for MVP / hackathon implementation  
> **Owner:** Tech Lead  
> **Last updated:** 2026-06-21
> **Related docs:** [Pipeline](./PIPELINE.md), [Booking Contract](../product/BOOKING-CONTRACT.md), [Risk Scoring](../product/RISK-SCORING.md), [Local Setup](../operations/LOCAL-SETUP.md), [Deployment](../operations/DEPLOYMENT.md), [Incident Runbook](../operations/INCIDENT-RUNBOOK.md)

This document records the decisions that keep Call-to-Cash coherent as the codebase grows. It is intentionally opinionated: every decision states what is allowed, what is prohibited, and what would justify revisiting the choice.

## 1. Current repository boundary

```text
call-to-cash-risk-copilot/
├── apps/
│   ├── web/                    # React/Vite customer experience + mentor console
│   └── api/                    # Fastify/TypeScript orchestration boundary
├── packages/
│   ├── shared/                 # Zod schemas, types, events, enums, constants
│   ├── domain/                 # Pure deterministic business rules and transitions
│   ├── db/                     # Prisma client, repositories, DB helpers
│   ├── agora/                  # Agora token, recording, webhook, transcript helpers
│   ├── solana/                 # Solana Pay, transaction verification, proof hash helpers
│   ├── ai/                     # Prompt contracts, extraction, redaction, risk adapters
│   └── config/                 # Environment schema, feature flags, lint/TS config
├── prisma/
│   └── schema.prisma
├── docs/
│   ├── architecture/
│   ├── product/
│   └── operations/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The architecture must remain a **modular monolith** for the MVP. Modules are separated by package boundaries and explicit contracts, not by premature network services.

---

## ADR-001 — Fastify/TypeScript API is the MVP orchestration authority

### Decision
`apps/api` is a Fastify/TypeScript application and the single backend authority for authentication, booking state transitions, payment intents, Agora orchestration, Solana verification, persistence, audit logging, REST commands, and SSE events.

### Why
The current monorepo is TypeScript-first. Keeping orchestration in Node.js gives the team one runtime, one shared type system, one deployment unit, and faster hackathon iteration.

### Rules

- `apps/api` owns all durable state transitions.
- No frontend client may write booking, payment, receipt, or proof state directly.
- No package may write to the database outside repository/service methods exposed by `packages/db`.
- A worker process may run from `apps/api`, but it uses the same domain rules and data contracts.

### Deferred option: FastAPI risk service
A separate FastAPI service is **not required for the MVP**. Introduce it only when at least one condition becomes true:

1. The risk pipeline needs Python-only ML or audio tooling that cannot reasonably run in Node.js.
2. AI/risk work needs independent scaling from API traffic.
3. A measurable latency or reliability problem cannot be solved with queues, caching, batching, or worker isolation in the Node stack.

When introduced, FastAPI becomes a stateless inference service. It still cannot own payment, booking, or database truth.

---

## ADR-002 — `packages/*` are domain boundaries, not dumping grounds

### Decision
The repository uses packages to isolate reusable responsibilities.

| Package | Owns | Must not own |
|---|---|---|
| `@call-to-cash/shared` | Zod schemas, DTOs, enums, domain event payloads, constants | SDK clients, secrets, database queries |
| `@call-to-cash/domain` | Pure state machines, risk/payment-gate rules, agreement and inventory guards | Fastify, Prisma, React, provider SDKs, environment reads, network I/O |
| `@call-to-cash/db` | Prisma client, migrations helpers, repositories, transactions | AI prompts, payment policy, UI logic |
| `@call-to-cash/agora` | Token creation, channel naming, webhook verification, recording helpers | Booking decisions, payment state |
| `@call-to-cash/solana` | Payment URL/QR creation, transaction lookup/verification, proof helper | PII, transcript storage, policy decisions |
| `@call-to-cash/ai` | Prompt templates, structured extraction adapters, redaction, signal proposals | Direct payment execution, direct DB writes |
| `@call-to-cash/config` | Runtime env parsing, feature flags, shared tooling config | Business state |

### Rule
A package can depend only on lower-level/shared primitives. `@call-to-cash/domain` may depend on `@call-to-cash/shared`; adapters and apps may depend on domain, but domain never depends on them. Avoid circular imports. `apps/*` compose packages; packages must not import from `apps/*`.

---

## ADR-003 — PostgreSQL is the business source of truth

### Decision
PostgreSQL stores durable product state and the audit trail.

### Stored in PostgreSQL

- user and service-provider records;
- booking drafts and booking lifecycle status;
- agreement snapshots and versions;
- transcript segment metadata and redacted text;
- risk assessments, reason codes, rule versions, and AI output references;
- payment intents, verification results, transaction signatures, and receipt metadata;
- consent records, retention metadata, manual-review records, and audit logs.

### Not stored in PostgreSQL

- raw audio blobs;
- long-lived realtime buffers;
- private keys or provider secrets;
- full unredacted content if a redacted/pseudonymous representation is sufficient.

### Rule
Every critical mutation must be wrapped in a database transaction where practical and leave an immutable audit event.

---

## ADR-004 — Redis is transient state, queue, lock, and retry infrastructure

### Decision
Redis may accelerate real-time work, but it is never the only record of a booking, payment, or proof result.

### Valid Redis responsibilities

```text
call:{callId}:transcript-buffer
call:{callId}:live-context
call:{callId}:latest-decision
payment:{paymentIntentId}:verification-lock
queue:transcription
queue:payment-verification
queue:retention
```

### Rules

- All keys must have a documented TTL.
- Redis failures must degrade safely: no payment unlock from stale cache alone.
- Payment verification uses a lock plus database idempotency constraints.
- Redis job retries must be idempotent and have a dead-letter/manual-review path.

---

## ADR-005 — Object storage holds audio and large artifacts

### Decision
Use MinIO locally and private AWS S3-compatible storage in deployed environments.

### Storage classes

| Artifact | Storage location | Typical retention | Notes |
|---|---|---:|---|
| Raw call audio | private object storage | 7–30 days, consent required | Optional by product setting |
| Redacted transcript artifact | object storage or DB | 90–180 days | Preferred training/evaluation artifact |
| Evidence attachment | private object storage | policy-driven | Virus scan before availability |
| Receipt/proof export | object storage | policy-driven | Do not expose bucket directly |

### Rules

- Buckets remain private; public bucket access is disabled.
- Browser uploads/downloads use short-lived presigned URLs generated by `apps/api`.
- Object keys use opaque IDs, not phone numbers or full customer names.
- The browser never receives permanent AWS/MinIO credentials.
- Lifecycle policies are mandatory before collecting real recordings.

---

## ADR-006 — Agora is the realtime voice and transcript layer

### Decision
Agora is used for realtime voice transport, optional cloud recording, live transcript integration, turn-taking signals, and call-quality telemetry.

### ADR-006a — Conversation AI Engine is an input adapter only (Phase 9)

The API starts/stops Agora Conversation AI Engine with server-only credentials and the browser joins RTC directly with a short-lived scoped token. Final provider transcript turns are normalized and passed to the existing transcript command; their source cannot set transaction fields or domain states. Interim turns are UI-only. Replay remains the deterministic fallback and there is no parallel booking/risk/payment pipeline.

### Agora does

- create/join authenticated call channels;
- stream voice in realtime;
- provide or integrate live transcript events;
- support recording when explicit consent permits it;
- expose performance signals such as call lifecycle and timing.

### Agora does not do

- determine payment readiness;
- persist final booking truth;
- verify Solana payments;
- store proof hashes as the audit authority.

### Rule
Call channel names must be derived from opaque `callSessionId` values. Do not place PII in channel names, metadata, or logs.

---

## ADR-007 — LLM output is advisory; deterministic rules make final decisions

### Decision
The AI layer may propose only bounded booking-field candidates with confidence/status and source-turn evidence. It cannot classify confirmation, propose risk signals, generate payment guidance, directly unlock payment, mutate a confirmed agreement, or write to Solana.

### Phase 10 provider decision

When `AI_PROVIDER=openai`, the backend uses `OPENAI_MODEL=gpt-5-mini` through a server-only
structured extraction request. This is independent of the GPT model configured in Agora Agent
Studio for conversational voice responses. `AI_EXTRACTION_MODE=hybrid` runs deterministic
extraction first and invokes OpenAI only for incomplete or ambiguous results; timeout, rate-limit,
unavailable, or invalid output falls back to deterministic extraction. No `OPENAI_*` or
`AI_EXTRACTION_*` variable may be exposed through `VITE_*`.

In hybrid mode, a valid high-confidence OpenAI candidate may supplement an absent deterministic
draft field only after server validation: route values must exactly match one scheduled catalogue
route, pickup values must normalize to a supported location, and passenger count remains schema
bounded. Contact details, price, inventory, payment, confirmation, risk, proof, and receipt facts
remain deterministic/server-owned; an LLM candidate cannot set them.

### Required AI output contract

```json
{
  "schemaVersion": "ctc.booking-extraction.v1",
  "fields": {
    "origin": { "value": "string|null", "confidence": 0.0, "status": "PRESENT|MISSING|AMBIGUOUS|INVALID", "evidenceRefs": [] },
    "destination": { "value": "string|null", "confidence": 0.0, "status": "PRESENT|MISSING|AMBIGUOUS|INVALID", "evidenceRefs": [] }
  },
  "warnings": []
}
```

### Backend decision path

```text
AI structured booking proposal
→ Zod validation
→ confidence / policy validation
→ domain rules
→ database transaction
→ persisted state transition
→ client event
```

### Rules

- Raw user text is never interpreted as executable instructions.
- Tool calls are allow-listed and parameter-validated.
- Unknown, ambiguous, low-confidence, or contradictory information stays unresolved and is surfaced to the user or an operator.

---

## ADR-008 — Payment Gate is deterministic and fail-safe

### Decision
The payment gate opens only when policy rules pass. A model score alone is insufficient.

### Minimum unlock condition

```text
Completeness ≥ configured threshold
AND Payment Readiness ≥ configured threshold
AND Dispute Risk ≤ configured threshold
AND explicit confirmation = true
AND no critical blocker
AND agreement snapshot is current and locked
```

### Rules

- A payment link/QR is generated only from a locked `agreement_snapshot_id`.
- Every payment attempt has a unique `payment_intent_id` and idempotency key.
- Any mismatch of amount, recipient, asset, reference, or snapshot version moves the flow to `MANUAL_REVIEW_REQUIRED`.
- A changed booking field invalidates the prior agreement and payment intent.

---

## ADR-009 — Solana is a payment/proof layer, never a PII store

### Decision
Solana is used for payment confirmation, transaction reference, and minimal tamper-evident proof anchoring.

### Allowed on-chain / transaction-linked data

- payment transaction signature;
- opaque payment reference;
- hash of canonical agreement snapshot;
- minimal version or environment marker where needed.

### Prohibited on-chain data

- raw audio;
- transcript text;
- name, phone number, email, address, ID document data;
- detailed risk scores or private dispute notes.

### Proof model

```text
canonical agreement JSON
→ SHA-256 hash
→ associate hash/reference with verified transaction
→ recompute from stored snapshot on receipt verification
→ MATCH / MISMATCH / MANUAL REVIEW
```

A proof match shows integrity of the stored snapshot against the anchored reference. It is not a legal ruling about who is at fault in a dispute.

### Phase 8 implementation decision

- `SolanaDevnetPaymentProvider` implements the same create/verify provider boundary as deterministic mock payment; it does not create a second business flow.
- The API exposes provider-neutral aliases while retaining `/v1/payments/mock/*` for deterministic tests and fallback.
- Solana Pay URLs are created server-side. References are random base58 encodings of 32 bytes; memos contain only versioned opaque reference/proof/amount fragments.
- Devnet verification uses JSON-RPC `getSignatureStatuses` plus parsed `getTransaction` data and checks confirmation, execution success, native SOL recipient/lamports, reference-account presence, expiry, and signature uniqueness.
- RPC calls execute outside the database transaction. The payment module re-loads state and commits transaction/proof/receipt/event records atomically only after a confirmed provider result.
- No Prisma migration is required: existing payment-intent recipient/reference/memo fields and minimized payment-transaction JSON metadata carry the Phase 8 provider facts.

---

## ADR-010 — Agreements are immutable snapshots with explicit versioning

### Decision
Confirmed commercial terms are stored as immutable agreement snapshots.

### Rules

- A material change creates a new agreement version.
- `agreement_v1` is never silently overwritten by `agreement_v2`.
- Payment intents bind to exactly one agreement snapshot.
- Receipts point to the agreement version actually paid for.
- Manual operators may correct data only through an auditable versioned action.

Material changes include route, time, passenger count, pickup point, price, deposit amount, cancellation policy, or customer confirmation status.

---

## ADR-011 — Observability and auditability ship with core flow

### Decision
The MVP must have an audit trail and operational visibility; these are not post-hackathon extras.

### Required audit events

```text
CALL_STARTED
TRANSCRIPT_SEGMENT_CAPTURED
FIELD_EXTRACTED
RISK_ASSESSED
GATE_EVALUATED
AGREEMENT_CREATED
AGREEMENT_CONFIRMED
PAYMENT_INTENT_CREATED
PAYMENT_VERIFIED
PROOF_ANCHORED
RECEIPT_ISSUED
MANUAL_REVIEW_OPENED
MANUAL_REVIEW_RESOLVED
```

### Minimum telemetry

- request and correlation IDs;
- call session ID, booking ID, agreement ID, payment intent ID as trace attributes;
- transcript-to-decision latency;
- payment-verification latency and retry count;
- queue lag;
- provider webhook failures;
- gate lock/unlock reason codes.

Sensitive content must be redacted from logs.

---

## ADR-012 — Consent, privacy, and retention are product features

### Decision
Recording, AI analysis, and training use are separate consents.

```text
recording_consent
analysis_consent
training_consent
```

### Rules

- Default to no long-term audio storage without recording consent.
- A user can participate in a call while declining training use.
- Training candidates require training consent, PII redaction, a verified outcome, and human/quality review.
- Deletion requests remove or pseudonymize off-chain user-linked data according to policy; immutable chain references are retained only as non-PII proofs.

---

## ADR-013 — Evaluation precedes model training

### Decision
Before training any model, the team builds an evaluation dataset and regression suite.

### Initial dataset

- 30–80 scripted scenarios;
- happy path, missing fields, ambiguity, policy questions, call drop, payment mismatch, tamper detection, and human handoff;
- expected structured extraction, expected gate state, expected reason codes, expected next action.

### Training candidate rule

```text
training_consent = true
AND redaction_complete = true
AND outcome_label is verified
AND reviewer approved = true
```

Never train directly on raw, unlabeled call recordings by default.

---

## ADR-014 — Environment promotion is controlled and observable

### Decision
Use four environments with strict separation of credentials and data.

| Environment | Purpose | Chain | Data |
|---|---|---|---|
| Local | developer loop | Solana devnet/mock | synthetic only |
| Preview | PR/demo verification | devnet/mock | synthetic only |
| Staging | integration rehearsal | devnet | controlled demo data |
| Production | live customers | approved network | consented real data |

### Rules

- No production credentials in preview/local environments.
- Migrations are reviewed and applied before application rollout.
- Feature flags control recording, automatic gate unlock, payment providers, and AI model versions.
- Production payment confirmation requires server-side verification, never frontend callback alone.

---

## Revisit triggers

Create a new ADR or amend this document when any of the following happens:

1. A new service boundary is introduced.
2. A package starts owning a second unrelated responsibility.
3. Payment policy or legal obligations materially change.
4. The model gains authority beyond extraction/proposal.
5. Audio retention or training policy changes.
6. The Solana/payment implementation changes from devnet/demo to production.

---

## ADR-015 — Fleet Revenue Twin remains a proposal layer

### Decision

Phase 11 introduces Fleet Revenue Twin as a server-authoritative recommendation boundary, not a new inventory, payment, or LLM authority. The Phase 11.0 contracts use phase-neutral `ctc.revenue-twin.*` schema identifiers.

### Rules

- Revenue Twin may rank safe alternatives and compute policy-bounded offer terms.
- Only the existing inventory authority may create a hold; a recommendation does not reserve a seat.
- Acceptance reloads server-owned offer state and revalidates current inventory and policy before entering the existing booking/agreement/payment flow.
- Potential recovery remains distinct from accepted and secured recovery.
- A future commitment assessment may use booking completeness, deposit readiness, explicit time constraint, group size, request timestamp, and hold expiry; it must never revoke a hold, displace an accepted customer, bypass inventory, or use protected/sensitive attributes.

### Consequences

No Prisma migration, API route, dashboard, worker, Redis, object store, partner settlement, dynamic pricing, optimization model, or provider integration is part of Phase 11.0.
