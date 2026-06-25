# Call-to-Cash Risk Copilot — Data Model

> **Status:** MVP technical contract v1  
> **Owner:** Backend Lead + Data/Privacy Owner  
> **Primary implementation:** `prisma/schema.prisma` and `packages/db`  
> **Related docs:** [Pipeline](./PIPELINE.md), [State Machines](./STATE-MACHINES.md), [Booking Contract](../product/BOOKING-CONTRACT.md), [API Contract](../contracts/API-CONTRACT.md), [Privacy & On-chain Policy](../security/DATA-PRIVACY-ONCHAIN-POLICY.md)

This document maps the Call-to-Cash domain into durable data. It is the contract to follow **before** generating Prisma models or repository code. PostgreSQL is the source of truth for all business state. Redis is not a source of truth; Solana is not a customer-data store.

---

## 1. Data principles

1. **One durable owner per fact.** Booking truth, payment truth, and receipt truth are persisted in PostgreSQL.
2. **Append evidence; do not overwrite history.** Transcript turns, assessments, payment attempts, proof records, and audit logs are append-only.
3. **Version immutable commercial terms.** An accepted agreement is never silently edited; a changed term creates a new agreement version.
4. **Keep raw media outside the relational database.** Audio and recordings are stored in S3/MinIO; PostgreSQL stores object metadata and authorization state only.
5. **Keep PII off-chain.** Solana may contain a payment reference, transaction signature, and proof hash only.
6. **Every automated decision must be reproducible.** Persist inputs, deterministic reason codes, policy/model version, and evidence links.
7. **Use UUIDs internally and opaque public IDs externally.** Never use a phone number, wallet address, or incremental DB id as a public identity.

---

## 2. Storage boundary

| Store      | What belongs there                                                                                                            | What must not be treated as truth                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| PostgreSQL | call lifecycle, transcript metadata/text, booking, agreement, risk assessments, payment status, receipts, consent, audit logs | raw audio blobs, temporary audio buffers                                  |
| Redis      | active call buffers, delivery queues, idempotency/retry locks, short-lived realtime projections                               | final booking/payment/receipt state                                       |
| S3 / MinIO | optional recording, audio evidence, export files, redacted transcript artifacts                                               | public-facing direct URLs, long-lived client credentials                  |
| Solana     | transaction signature, amount/recipient validation facts, payment reference, proof hash / memo reference                      | transcript, audio, customer identity, phone, address, full agreement JSON |

---

## 3. Domain relationship map

```text
User / Operator / Provider
        │
        ├── CallSession
        │      ├── ConsentRecord[]
        │      ├── TranscriptTurn[]
        │      ├── BookingExtraction[]
        │      ├── RiskAssessment[]
        │      └── ObjectAsset[] (optional recording)
        │
        └── Booking ── TripDeparture
               ├── InventoryHold[]          # expiring/consumed capacity
               ├── Agreement[]               # immutable versions
               ├── PaymentIntent[]
               │      └── PaymentTransaction[]
               ├── ProofRecord[]
               └── TrustReceipt[]

Any aggregate may emit AuditLog[] entries.
```

### Aggregate ownership

| Aggregate | Root record       | Owned child records                                                       | Owner service                                                      |
| --------- | ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Call      | `call_sessions`   | consent, transcript turns, extraction runs, assessments, recording assets | Call / Transcript service in `apps/api`                            |
| Inventory | `trip_departures` | inventory holds                                                           | Inventory repository in `packages/db`; orchestration in `apps/api` |
| Booking   | `bookings`        | agreements, payment intents, proof records, receipts                      | Booking service in `apps/api`                                      |
| Payment   | `payment_intents` | payment transactions, verification attempts                               | Payment service in `apps/api` + `packages/solana`                  |
| Audit     | `audit_logs`      | n/a                                                                       | all server-side modules via `packages/db`                          |

---

## 4. Global conventions

### 4.1 IDs, timestamps, money, and time

| Concern               | Rule                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| Internal primary keys | UUID v7 or UUID v4; choose one convention and keep it consistent                |
| Public ids            | opaque prefixed strings, for example `call_...`, `bk_...`, `pi_...`, `rcpt_...` |
| Timestamps            | UTC ISO-8601 in API; `timestamptz` in PostgreSQL                                |
| Local travel time     | store original IANA timezone and normalized UTC time when schedule is confirmed |
| Money                 | integer minor units, e.g. `300000` VND, never floating point                    |
| Currency              | ISO code, MVP supports `VND` only                                               |
| Hashes                | lowercase hex SHA-256 unless a field says otherwise                             |
| JSON                  | `jsonb`, with Zod schema validation before persistence                          |

### 4.2 PII classes

| Class                  | Examples                                                  | Default handling                                          |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Public / non-sensitive | route code, booking state, amount, timestamp              | may appear in receipt after authorization                 |
| Internal               | score totals, reason codes, model version, event metadata | internal only                                             |
| Confidential PII       | customer name, phone, pickup point, operator notes        | encrypted/masked at rest and redacted from logs           |
| Restricted media       | raw audio, recording, identity documents                  | private object storage, short retention, explicit consent |

---

## 5. MVP entity catalog

The following tables are the minimum production-shaped schema. A hackathon may initially omit provider inventory tables, but it must not omit the audit/payment/proof relationships.

### 5.1 `users`

**Purpose:** Stores authenticated human or system identities that participate in calls, booking, operations, or provider workflows.

| Field                      | Type / example                                     | Notes                                               |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `id`                       | UUID PK                                            | internal identity                                   |
| `public_id`                | `usr_...` unique                                   | API-safe identifier                                 |
| `role`                     | `CUSTOMER`, `OPERATOR`, `PROVIDER_ADMIN`, `SYSTEM` | authorization input                                 |
| `display_name`             | encrypted nullable text                            | PII                                                 |
| `phone_e164_encrypted`     | encrypted nullable text                            | PII; do not index raw value                         |
| `phone_masked`             | `0912***678` nullable                              | safe for customer/support UI                        |
| `wallet_address`           | nullable text                                      | not an identity authority; normalize before storage |
| `created_at`, `updated_at` | timestamptz                                        | required                                            |

**Important indexes / constraints**

- unique `public_id`;
- optional unique normalized `wallet_address` only when business rules require one account per wallet;
- never expose `phone_e164_encrypted` in ordinary API responses.

**Retention:** retain operational account records under product policy; pseudonymize after verified deletion request where legally/operationally possible.

---

### 5.2 `call_sessions`

**Purpose:** One customer interaction initiated before Agora join or transcript replay. It is the root for voice/transcript evidence.

| Field                      | Type / example                            | Notes                           |
| -------------------------- | ----------------------------------------- | ------------------------------- |
| `id`                       | UUID PK                                   | internal                        |
| `public_id`                | `call_...` unique                         | API/event identifier            |
| `customer_id`              | FK `users.id` nullable                    | may be anonymous before sign-in |
| `operator_id`              | FK `users.id` nullable                    | optional human owner            |
| `booking_id`               | FK `bookings.id` nullable                 | populated once booking exists   |
| `status`                   | Call status enum                          | see State Machines              |
| `channel_name`             | unique text                               | Agora channel, not a secret     |
| `purpose`                  | `BOOKING`                                 | future-proof enum               |
| `started_at`, `ended_at`   | timestamptz nullable                      | lifecycle                       |
| `audio_recording_enabled`  | boolean                                   | must correspond to consent      |
| `analysis_enabled`         | boolean                                   | must correspond to consent      |
| `source_mode`              | `LIVE_AGORA`, `TRANSCRIPT_REPLAY`, `DEMO` | enables deterministic demo mode |
| `created_at`, `updated_at` | timestamptz                               | required                        |

**Indexes**

- unique `public_id`;
- unique `channel_name`;
- `(customer_id, created_at DESC)`;
- `(booking_id)`;
- `(status, created_at DESC)` for operations dashboard.

**Sensitive fields:** none by itself, but linkage to customer is confidential.

**Retention:** session metadata 180–365 days; transcript/media follow their own retention rules.

---

### 5.3 `consent_records`

**Purpose:** Stores granular consent and revocation history. Consent is append-only; a revocation creates a new record/state, not an in-place rewrite of history.

| Field              | Type / example                                | Notes                              |
| ------------------ | --------------------------------------------- | ---------------------------------- |
| `id`               | UUID PK                                       |                                    |
| `call_session_id`  | FK `call_sessions.id`                         | required                           |
| `user_id`          | FK `users.id` nullable                        | nullable for anonymous participant |
| `consent_type`     | `RECORDING`, `ANALYSIS`, `TRAINING`           | separate permissions               |
| `status`           | `GRANTED`, `REVOKED`, `DECLINED`              | latest state derived by type       |
| `policy_version`   | `privacy-v1`                                  | must be retained                   |
| `captured_via`     | `WEB_MODAL`, `VOICE_CONFIRMATION`, `OPERATOR` | evidence source                    |
| `evidence_turn_id` | FK `transcript_turns.id` nullable             | for spoken consent                 |
| `created_at`       | timestamptz                                   | required                           |

**Constraint:** audio recording may not begin unless a current `RECORDING = GRANTED` exists. Data may not enter training candidates unless a current `TRAINING = GRANTED` exists.

---

### 5.4 `transcript_turns`

**Purpose:** Stores ordered speech turns after STT. It is append-only; corrections create a new revision or `superseded_by_id`, never a silent overwrite.

| Field                          | Type / example                            | Notes                                                                                     |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `id`                           | UUID PK                                   |                                                                                           |
| `call_session_id`              | FK `call_sessions.id`                     | required                                                                                  |
| `sequence_no`                  | integer                                   | monotonically increasing per call                                                         |
| `speaker`                      | `CUSTOMER`, `AGENT`, `OPERATOR`, `SYSTEM` | no inferred demographic labels                                                            |
| `content_redacted`             | text                                      | primary analysis text                                                                     |
| `content_encrypted`            | encrypted nullable text                   | optional original transcript; stricter access                                             |
| `language`                     | `vi-VN`                                   | explicit                                                                                  |
| `is_final`                     | boolean                                   | interim turns should not make durable decision changes                                    |
| `stt_confidence`               | decimal nullable                          | only a quality signal                                                                     |
| `started_at`, `ended_at`       | timestamptz nullable                      | audio timing                                                                              |
| `source`                       | `AGORA`, `REPLAY`, `MANUAL`               | provenance                                                                                |
| `provider`, `provider_turn_id` | nullable text                             | trusted-provider identity; final Agora turns are unique as `(provider, provider_turn_id)` |
| `supersedes_turn_id`           | self FK nullable                          | correction lineage                                                                        |
| `created_at`                   | timestamptz                               | required                                                                                  |

**Indexes / constraints**

- unique `(call_session_id, sequence_no)`;
- unique `(provider, provider_turn_id)` for provider-originated final turns;
- `(call_session_id, created_at)`;
- full-text search only on `content_redacted`, not encrypted original;
  - no payment gate can be opened from `is_final = false` content.

`provider_webhook_notices` stores only provider name, opaque notice ID, call foreign key, and received timestamp. Its unique `(provider, notice_id)` constraint makes notification delivery idempotent; it stores no transcript payload or PII.

**Retention:** redacted transcript 90–180 days; encrypted original only as long as necessary for dispute/quality policy.

---

### 5.5 `booking_extractions`

**Purpose:** Captures what AI/rules extracted from one transcript window, including uncertainty and contradiction detection.

| Field                                | Type / example                                   | Notes                                                |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| `id`                                 | UUID PK                                          |                                                      |
| `call_session_id`                    | FK                                               | required                                             |
| `source_turn_from`, `source_turn_to` | integer                                          | evidence range                                       |
| `extraction_version`                 | `extractor-v1.2`                                 | prompt/model/rule version                            |
| `payload`                            | JSONB                                            | schema-validated extracted fields only               |
| `field_confidence`                   | JSONB                                            | per-field confidence, never a payment decision alone |
| `missing_fields`                     | text[] or JSONB                                  | canonical field names                                |
| `contradictions`                     | JSONB                                            | must point to evidence turns                         |
| `status`                             | `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED` | backend owns acceptance                              |
| `created_at`                         | timestamptz                                      | required                                             |

**PII:** the payload may contain phone/pickup values. Store values encrypted or redacted where appropriate; do not log raw payloads.

---

### 5.6 `risk_assessments`

**Purpose:** Stores a reproducible risk/gate evaluation for a given booking/call state.

| Field                     | Type / example         | Notes                                    |
| ------------------------- | ---------------------- | ---------------------------------------- |
| `id`                      | UUID PK                |                                          |
| `call_session_id`         | FK nullable            | call-scoped evaluation                   |
| `booking_id`              | FK nullable            | booking-scoped once created              |
| `assessment_version`      | integer                | sequence per aggregate                   |
| `policy_version`          | `risk-v1`              | mandatory                                |
| `completeness_score`      | integer 0–100          | deterministic formula v1                 |
| `dispute_risk_score`      | integer 0–100          | deterministic reasons                    |
| `payment_readiness_score` | integer 0–100          | requires evidence                        |
| `agent_quality_score`     | integer 0–100 nullable | analytics only                           |
| `gate_decision`           | gate enum              | `LOCKED`, `READY_FOR_CONFIRMATION`, etc. |
| `next_action`             | action enum            | ask, hold, open, handoff                 |
| `reason_codes`            | JSONB                  | stable codes from `RISK-SCORING.md`      |
| `evidence`                | JSONB                  | transcript turn references / rule facts  |
| `created_at`              | timestamptz            | required                                 |

**Constraint:** a gate decision must have at least one reason/evidence entry when not `UNLOCKED`.

**Retention:** 180–365 days for audit and model evaluation.

---

### 5.7 `trip_departures`

**Purpose:** Authoritative scheduled inventory and pricing source for one route departure.

| Field                      | Type / example                                   | Notes                           |
| -------------------------- | ------------------------------------------------ | ------------------------------- |
| `id`                       | UUID PK                                          | internal                        |
| `public_id`                | `dep_...` unique                                 | API/operator-safe identifier    |
| `route_code`               | `HN-SAPA-20260620-2230`                          | stable operational code         |
| `route_from`, `route_to`   | controlled text/code                             | normalized route                |
| `departure_at_utc`         | timestamptz                                      | authoritative scheduled instant |
| `departure_timezone`       | IANA timezone                                    | display/operations context      |
| `capacity`                 | positive integer                                 | total sellable seats            |
| `operational_status`       | `SCHEDULED`, `BOARDING`, `DEPARTED`, `CANCELLED` | holds require `SCHEDULED`       |
| `currency`                 | `VND`                                            | MVP fixed                       |
| `fare_per_seat_minor`      | non-negative integer                             | authoritative unit fare         |
| `deposit_amount_minor`     | positive integer                                 | authoritative deposit           |
| `price_policy_version`     | `BUS-PRICE-V1`                                   | required                        |
| `refund_policy_version`    | `BUS-V1/1.0`                                     | required                        |
| `version`                  | integer                                          | optimistic concurrency input    |
| `created_at`, `updated_at` | timestamptz                                      | required                        |

**Constraints:** unique `(route_code, departure_at_utc)`; positive capacity; non-negative fare; positive deposit. Availability is derived under a row lock from active, unexpired and consumed holds; browser counters are never authoritative.

**Demo schedule input:** Phase 10.5 keeps the database model unchanged and imports the
Excel-editable CSV fixture `prisma/fixtures/trip-schedule-demo.csv` into `trip_departures` during
the idempotent seed. The CSV is catalogue input for route, local date/time, capacity, fare, deposit,
policy, and demo pickup policy. Runtime availability for Revenue Twin remains derived from
`trip_departures` plus `inventory_holds`; do not encode "available seats" directly in the schedule
CSV.

---

### 5.8 `inventory_holds`

**Purpose:** Time-bounded seat reservation tying a booking to one authoritative departure.

| Field                        | Type / example                              | Notes                        |
| ---------------------------- | ------------------------------------------- | ---------------------------- |
| `id`                         | UUID PK                                     | internal                     |
| `public_id`                  | `hold_...` unique                           | opaque external/reference id |
| `departure_id`               | FK `trip_departures.id`                     | required                     |
| `booking_id`                 | FK `bookings.id`                            | required                     |
| `quantity`                   | positive integer                            | seats held                   |
| `status`                     | `ACTIVE`, `RELEASED`, `EXPIRED`, `CONSUMED` | canonical shared enum        |
| `expires_at`                 | timestamptz                                 | checked using server time    |
| `idempotency_key`            | unique text                                 | replay safety                |
| `released_at`, `consumed_at` | timestamptz nullable                        | lifecycle evidence           |
| `version`                    | integer                                     | optimistic concurrency input |
| `created_at`, `updated_at`   | timestamptz                                 | required                     |

**Constraints / concurrency**

- only one `ACTIVE` hold per booking;
- reservation locks the departure row in a serializable transaction before calculating capacity;
- availability counts `ACTIVE` unexpired and `CONSUMED` quantities;
- expiry changes status and appends audit evidence in the same transaction;
- an idempotency-key replay returns the original hold only when the command payload matches.

---

### 5.9 `bookings`

**Purpose:** Current operational booking record. It may be mutable before agreement lock; material changes after lock require a new agreement version and often a new payment intent.

| Field                       | Type / example                   | Notes                                 |
| --------------------------- | -------------------------------- | ------------------------------------- |
| `id`                        | UUID PK                          |                                       |
| `public_id`                 | `bk_...` unique                  | customer-facing booking id            |
| `call_session_id`           | FK nullable                      | origin relationship                   |
| `customer_id`               | FK `users.id` nullable           | customer identity                     |
| `provider_id`               | FK `users.id` nullable           | MVP may seed provider                 |
| `trip_departure_id`         | FK `trip_departures.id` nullable | authoritative schedule/pricing source |
| `status`                    | booking status enum              | see State Machines                    |
| `route_from`, `route_to`    | controlled text/code             | avoid free-form after confirmation    |
| `departure_at_utc`          | timestamptz nullable             | required before agreement lock        |
| `departure_timezone`        | text                             | e.g. `Asia/Ho_Chi_Minh`               |
| `passenger_count`           | integer                          | >= 1                                  |
| `pickup_point_encrypted`    | encrypted nullable text          | PII / operational data                |
| `pickup_point_display`      | masked/limited text              | render-safe subset                    |
| `contact_phone_encrypted`   | encrypted nullable text          | PII                                   |
| `contact_phone_masked`      | text nullable                    | UI-safe                               |
| `currency`                  | `VND`                            | MVP fixed                             |
| `total_amount_minor`        | integer nullable                 | non-negative                          |
| `deposit_amount_minor`      | integer nullable                 | non-negative, <= total                |
| `refund_policy_version`     | text nullable                    | must be fixed at agreement lock       |
| `inventory_hold_expires_at` | timestamptz nullable             | guard payment intent                  |
| `created_at`, `updated_at`  | timestamptz                      | required                              |

**Indexes / constraints**

- unique `public_id`;
- `(customer_id, created_at DESC)`;
- `(status, departure_at_utc)`;
- `passenger_count > 0`;
- `deposit_amount_minor <= total_amount_minor` when both populated.

---

### 5.10 `agreements`

**Purpose:** Immutable, versioned snapshot of commercial terms read/displayed to the customer.

| Field                          | Type / example                                      | Notes                                                |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| `id`                           | UUID PK                                             |                                                      |
| `booking_id`                   | FK `bookings.id`                                    | required                                             |
| `inventory_hold_id`            | FK `inventory_holds.id`                             | exact hold confirmed by this version                 |
| `version`                      | integer                                             | unique per booking                                   |
| `status`                       | `DRAFT`, `READY`, `LOCKED`, `SUPERSEDED`, `EXPIRED` | see State Machines                                   |
| `canonical_payload`            | JSONB                                               | schema-validated, canonical key ordering before hash |
| `payload_hash_sha256`          | char(64)                                            | immutable proof input                                |
| `policy_version`               | text                                                | e.g. `refund-v1.0`                                   |
| `explicit_confirmation_method` | `VOICE`, `WEB`, `OPERATOR`                          | required on lock                                     |
| `confirmed_turn_id`            | FK `transcript_turns.id` nullable                   | spoken evidence                                      |
| `confirmed_at`                 | timestamptz nullable                                | required on lock                                     |
| `created_at`                   | timestamptz                                         | required                                             |

**Constraints**

- unique `(booking_id, version)`;
- only one active `LOCKED` agreement per booking;
- canonical payload cannot be modified after status is `LOCKED`;
- a changed price/time/count/policy creates a new version.

**On-chain:** only `payload_hash_sha256` or a derived proof reference is allowed; never `canonical_payload`.

---

### 5.11 `payment_intents`

**Purpose:** A time-bounded, idempotent request for exactly one deposit payment against one locked agreement.

| Field                      | Type / example         | Notes                                          |
| -------------------------- | ---------------------- | ---------------------------------------------- |
| `id`                       | UUID PK                |                                                |
| `public_id`                | `pi_...` unique        | customer/API id                                |
| `booking_id`               | FK                     | required                                       |
| `agreement_id`             | FK                     | required; must be `LOCKED`                     |
| `status`                   | payment intent enum    | see State Machines                             |
| `currency`                 | `VND`                  | MVP                                            |
| `amount_minor`             | integer                | immutable after create                         |
| `recipient_wallet`         | text                   | normalized; server-owned config                |
| `token_mint`               | nullable text          | explicit even if native SOL path is later used |
| `solana_reference`         | unique text            | one reference per intent                       |
| `memo_reference`           | safe pseudonymous text | no PII                                         |
| `expires_at`               | timestamptz            | required                                       |
| `idempotency_key`          | text unique            | request safety                                 |
| `created_at`, `updated_at` | timestamptz            | required                                       |

**Constraints**

- payment intent may be created only if gate is `UNLOCKED`, agreement is locked, and inventory hold is active;
- only one non-terminal intent per booking/agreement at a time;
- expiry cannot be extended by client state; create a new intent if necessary.

---

### 5.12 `payment_transactions`

**Purpose:** Append-only observations of blockchain payment transactions and verification outcomes.

| Field                         | Type / example                               | Notes                               |
| ----------------------------- | -------------------------------------------- | ----------------------------------- |
| `id`                          | UUID PK                                      |                                     |
| `payment_intent_id`           | FK                                           | required                            |
| `chain`                       | `SOLANA_DEVNET`, `SOLANA_MAINNET`            | explicit environment                |
| `tx_signature`                | unique text                                  | blockchain transaction id           |
| `slot`                        | bigint nullable                              | optional chain metadata             |
| `submitted_at`, `verified_at` | timestamptz nullable                         | lifecycle                           |
| `observed_amount_minor`       | integer nullable                             | server-observed                     |
| `observed_recipient_wallet`   | text nullable                                | server-observed                     |
| `observed_reference`          | text nullable                                | server-observed                     |
| `verification_status`         | `PENDING`, `CONFIRMED`, `REJECTED`, `FAILED` | verification outcome                |
| `rejection_reason_code`       | text nullable                                | stable error/reason code            |
| `raw_chain_metadata`          | JSONB                                        | redacted/minimized; no customer PII |
| `created_at`                  | timestamptz                                  | required                            |

**Constraints**

- unique `tx_signature` globally;
- a confirmed transaction can satisfy only one payment intent;
- frontend-provided status can never directly set `CONFIRMED`.

---

### 5.13 `proof_records`

**Purpose:** Links an agreement hash to a verified payment transaction and records verification results.

| Field                    | Type / example                                          | Notes                                           |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------- |
| `id`                     | UUID PK                                                 |                                                 |
| `booking_id`             | FK                                                      | required                                        |
| `agreement_id`           | FK                                                      | required                                        |
| `payment_transaction_id` | FK nullable                                             | set after verification                          |
| `proof_hash_sha256`      | char(64)                                                | normally agreement payload hash or derived hash |
| `anchor_type`            | `SOLANA_MEMO`, `SOLANA_REFERENCE`, `SERVER_ATTESTATION` | be explicit                                     |
| `anchor_value`           | text                                                    | tx/memo/reference pointer; no PII               |
| `verification_status`    | `PENDING`, `MATCH`, `MISMATCH`, `UNAVAILABLE`           | receipt uses this                               |
| `verified_at`            | timestamptz nullable                                    |                                                 |
| `created_at`             | timestamptz                                             | required                                        |

**On-chain allowlist:** proof hash, booking-safe reference, transaction link metadata. No raw payload.

---

### 5.14 `trust_receipts`

**Purpose:** Customer-facing durable summary generated after booking/payment/proof processing.

| Field                      | Type / example                                          | Notes                                        |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `id`                       | UUID PK                                                 |                                              |
| `public_id`                | `rcpt_...` unique                                       | shareable only through authorized link/token |
| `booking_id`               | FK                                                      | required                                     |
| `payment_intent_id`        | FK                                                      | required                                     |
| `proof_record_id`          | FK nullable                                             | required for verified status                 |
| `status`                   | `ISSUED`, `VERIFIED_MATCH`, `MISMATCH`, `MANUAL_REVIEW` | customer-safe state                          |
| `receipt_payload`          | JSONB                                                   | masked/minimized view model                  |
| `issued_at`, `verified_at` | timestamptz                                             | lifecycle                                    |
| `created_at`               | timestamptz                                             | required                                     |

**Rule:** receipt payload must never include full phone, raw transcript, wallet seed material, or hidden risk reasoning.

---

### 5.15 `object_assets`

**Purpose:** Metadata and retention for S3/MinIO objects such as optional recordings and redacted export artifacts.

| Field                        | Type / example                                                                | Notes                         |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| `id`                         | UUID PK                                                                       |                               |
| `call_session_id`            | FK nullable                                                                   | optional association          |
| `booking_id`                 | FK nullable                                                                   | optional association          |
| `kind`                       | `RAW_AUDIO`, `RECORDING`, `REDACTED_TRANSCRIPT_EXPORT`, `EVIDENCE_ATTACHMENT` | classification                |
| `storage_provider`           | `MINIO`, `S3`                                                                 |                               |
| `bucket`, `object_key`       | text                                                                          | private object location       |
| `checksum_sha256`            | char(64) nullable                                                             | integrity                     |
| `content_type`, `size_bytes` | metadata                                                                      |                               |
| `retention_until`            | timestamptz                                                                   | required for restricted media |
| `deleted_at`                 | timestamptz nullable                                                          | lifecycle                     |
| `created_at`                 | timestamptz                                                                   | required                      |

**Never store:** public object URL, AWS secret, presigned URL, audio bytes.

---

### 5.16 `audit_logs`

**Purpose:** Append-only record of material actor actions and state transitions.

| Field                            | Type / example                                | Notes                     |
| -------------------------------- | --------------------------------------------- | ------------------------- |
| `id`                             | UUID PK                                       |                           |
| `actor_type`                     | `USER`, `OPERATOR`, `SYSTEM`, `WEBHOOK`       |                           |
| `actor_id`                       | UUID/text nullable                            | actor identity when known |
| `action`                         | `BOOKING_CONFIRMED`, `PAYMENT_VERIFIED`, etc. | stable action enum        |
| `aggregate_type`, `aggregate_id` | e.g. `BOOKING`, `bk_...`                      | query target              |
| `request_id`, `event_id`         | nullable text                                 | correlation               |
| `before_state`, `after_state`    | JSONB nullable                                | redacted / minimized      |
| `metadata`                       | JSONB                                         | no raw PII or secrets     |
| `created_at`                     | timestamptz                                   | immutable                 |

**Rule:** write audit entries inside the same DB transaction as authoritative state changes where possible.

**Phase 5 durable event stream:** rows with `aggregate_type = CALL_STREAM`, a non-null stable `event_id`, and the canonical validated event envelope in `after_state` form the lightweight append-only SSE event log. `aggregate_id` is the public call id. Per-call sequence allocation is serialized with a PostgreSQL advisory transaction lock. This reuses the existing Phase 4 table and requires no Phase 5 schema migration.

---

## 6. Data invariants that code must enforce

```text
1. A payment intent always references exactly one LOCKED agreement version.
2. A payment transaction signature can confirm at most one payment intent.
3. A receipt cannot become VERIFIED_MATCH until payment is CONFIRMED and proof is MATCH.
4. A changed agreement term invalidates prior open payment intents.
5. No raw transcript/audio/phone is written to Solana metadata or app logs.
6. A risk assessment cannot open payment without deterministic policy checks.
7. An analysis created from interim STT cannot lock an agreement or open payment.
8. Every terminal payment/proof exception creates an audit log entry.
9. Capacity cannot be oversold: hold creation serializes on the departure and counts active/consumed quantities.
10. Agreement, payment, proof, and receipt foreign keys must remain within the same booking aggregate.
11. `revenue_twin_evaluations` persist only safe demand/snapshot provenance and aggregate impact; `revenue_twin_offers` persist server-calculated terms, expiry, decision state, and canonical hold linkage. They never persist raw transcript, phone, model trace, wallet, or provider secret.
12. An accepted Revenue Twin offer is unique per offer/idempotency key and competing open offers are superseded in the same transaction as its inventory hold.
13. `revenue_twin_waitlist_entries` are unique per call/evaluation, store only requested-departure and party-size operational data, and must not create, extend, revoke, or imply an inventory hold.
```

---

## 7. Recommended Prisma implementation order

1. Enums and `users`.
2. `trip_departures`, `call_sessions`, `consent_records`, `transcript_turns`.
3. `bookings`, `inventory_holds`, `agreements`.
4. `booking_extractions`, `risk_assessments`.
5. `payment_intents`, `payment_transactions`.
6. `proof_records`, `trust_receipts`, `audit_logs`, `object_assets`.
7. Seed one provider and one deterministic departure; scripted calls arrive with the replay API phase.

Do not begin with all optional objects. The first vertical slice needs only: `call_sessions`, `transcript_turns`, `risk_assessments`, `bookings`, `agreements`, `payment_intents`, `payment_transactions`, `proof_records`, and `trust_receipts`.

---

## 8. Timeline query contract

The customer/operator timeline should be reproducible from durable records in this order:

```text
CallSession
→ TranscriptTurn[]
→ BookingExtraction[]
→ RiskAssessment[]
→ Booking
→ TripDeparture / InventoryHold[]
→ Agreement[]
→ PaymentIntent[]
→ PaymentTransaction[]
→ ProofRecord[]
→ TrustReceipt[]
```

The API may return a denormalized timeline view, but it must derive it from the authoritative records above and include a correlation id for support/debugging.

---

## 9. Schema review checklist

Before merging a Prisma migration, verify:

- [ ] public IDs and internal IDs are both present where the record crosses API boundaries;
- [ ] status fields map to `STATE-MACHINES.md` exactly;
- [ ] all foreign keys have defined delete behavior;
- [ ] PII/encrypted fields are excluded from default repository selects;
- [ ] query indexes support current dashboard/timeline access;
- [ ] immutable records do not expose update repository methods;
- [ ] on-chain fields are allowlisted by the privacy policy;
- [ ] migration includes seed/rollback notes when it changes a stateful demo flow.
