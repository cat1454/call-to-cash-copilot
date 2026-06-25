# Call-to-Cash Risk Copilot — Realtime Event Contract

> **Status:** MVP technical contract v1  
> **Owner:** Backend Lead + Frontend Lead  
> **MVP transport:** SSE from API to browser; event shapes are transport-agnostic  
> **Related docs:** [API Contract](./API-CONTRACT.md), [State Machines](../architecture/STATE-MACHINES.md), [Error Codes](./ERROR-CODES.md)

Voice and payment experiences need realtime updates, but the frontend must not derive business truth from local assumptions. The API emits events only **after** durable state has committed. REST remains the recovery/source-of-truth path.

---

## 1. Delivery guarantees

| Property        | MVP rule                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------- |
| Transport       | SSE `GET /v1/calls/:callId/events`                                                       |
| Direction       | server → browser only; commands remain REST                                              |
| Delivery        | at-least-once; consumers must deduplicate by `eventId`                                   |
| Ordering        | guaranteed per `callId`/aggregate stream by `sequence`; not globally                     |
| Recovery        | client reconnects with `Last-Event-ID`, then calls REST summary endpoints if gap remains |
| Source of truth | PostgreSQL-backed REST APIs, never event cache alone                                     |
| Publication     | durable transactional event log; SSE reads only committed rows                           |
| Sensitive data  | redacted/minimized; no raw phone, token, secret, raw audio URL, or full hidden reasoning |

---

## 2. Canonical envelope

Every event uses one envelope over SSE. A future transport may reuse the envelope only through an explicit contract revision.

```json
{
  "eventId": "evt_01J...",
  "event": "risk.score.updated",
  "version": 1,
  "occurredAt": "2026-06-20T10:34:00.000Z",
  "correlationId": "req_01J...",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "sequence": 18,
  "data": {}
}
```

### Field rules

| Field           | Rule                                                                |
| --------------- | ------------------------------------------------------------------- |
| `eventId`       | immutable unique id; use to deduplicate                             |
| `event`         | stable dotted event name                                            |
| `version`       | payload schema version; increment only for breaking payload changes |
| `occurredAt`    | server timestamp, UTC                                               |
| `correlationId` | request/job trace id where available                                |
| `callId`        | required for call-stream events                                     |
| `bookingId`     | nullable before booking materialization                             |
| `sequence`      | monotonic within one call stream                                    |
| `data`          | event-specific, JSON schema/Zod validated                           |

### SSE encoding

```text
event: risk.score.updated
id: evt_01J...
data: {"eventId":"evt_01J...","event":"risk.score.updated",...}

```

---

## 3. Event catalog

### 3.1 Call lifecycle

#### `call.created`

**When:** a `CallSession` is created.

```json
{
  "event": "call.created",
  "callId": "call_01J...",
  "data": {
    "status": "CREATED",
    "channelName": "ctc_call_01J...",
    "sourceMode": "LIVE_AGORA"
  }
}
```

#### `call.joined`

**When:** a participant join is server-verified.

```json
{
  "event": "call.joined",
  "callId": "call_01J...",
  "data": {
    "status": "ACTIVE",
    "participantRole": "CUSTOMER",
    "startedAt": "2026-06-20T10:31:00.000Z"
  }
}
```

#### `call.ended`

**When:** normal end/cancel is persisted.

```json
{
  "event": "call.ended",
  "callId": "call_01J...",
  "data": {
    "status": "ENDED",
    "reason": "CUSTOMER_ENDED",
    "endedAt": "2026-06-20T10:45:00.000Z"
  }
}
```

#### `call.failed`

**When:** channel/setup/provider failure ends the session.

```json
{
  "event": "call.failed",
  "callId": "call_01J...",
  "data": {
    "status": "FAILED",
    "errorCode": "AGORA_CHANNEL_UNAVAILABLE",
    "retryable": true,
    "customerMessage": "Kết nối cuộc gọi bị gián đoạn. Bạn có thể thử lại."
  }
}
```

---

### 3.2 Transcript and analysis

#### `transcript.turn.created`

**When:** a final/redacted transcript turn is persisted. `content` is a privacy-safe display projection: it preserves meaning while normalizing Unicode, spacing, capitalization, and terminal punctuation. The retained redacted source remains the audit/analysis value.

```json
{
  "event": "transcript.turn.created",
  "callId": "call_01J...",
  "data": {
    "turnId": "turn_01J...",
    "sequenceNo": 7,
    "speaker": "CUSTOMER",
    "content": "Tôi muốn đặt 3 vé đi Sa Pa tối nay.",
    "isFinal": true,
    "timestamp": "2026-06-20T10:33:17.000Z"
  }
}
```

**Rule:** event carries redacted content only. Interim transcript text may be shown locally in the UI but must not mutate durable booking/payment state. A signed post-session provider history may emit this event after `call.ended` for the same normally ended call. The client keeps that call's SSE/recovery surface available for a bounded sync window; it must not reopen the call or infer a new lifecycle state.

#### `transcript.analysis.updated`

**When:** extraction/reconciliation completes for a transcript window.

```json
{
  "event": "transcript.analysis.updated",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "extractionId": "ext_01J...",
    "understood": {
      "routeFrom": "Ha Noi",
      "routeTo": "Sa Pa",
      "passengerCount": 3
    },
    "missingFields": ["departureAt", "refundPolicyConfirmation"],
    "contradictions": [],
    "nextQuestion": "Anh/chị muốn đi chuyến mấy giờ ạ?"
  }
}
```

---

### 3.3 Risk and payment gate

#### `risk.score.updated`

**When:** a new risk assessment is persisted.

```json
{
  "event": "risk.score.updated",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "assessmentId": "risk_01J...",
    "completenessScore": 82,
    "disputeRisk": 20,
    "paymentReadiness": 65,
    "paymentGate": "LOCKED",
    "nextAction": "ASK_CLARIFICATION",
    "missingFields": ["departureAt"],
    "reasonCodes": ["MISSING_DEPARTURE_TIME"],
    "customerMessage": "Cần xác nhận giờ khởi hành trước khi cọc."
  }
}
```

#### `risk.payment_gate.updated`

**When:** gate decision changes or must be explicitly surfaced after recomputation.

```json
{
  "event": "risk.payment_gate.updated",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "previousDecision": "READY_FOR_CONFIRMATION",
    "paymentGate": "UNLOCKED",
    "nextAction": "OPEN",
    "reasonCodes": [],
    "agreementVersion": 1
  }
}
```

**UI rule:** never show “Pay now” based only on this event if REST fetch shows a different state. REST current state wins on reconnect/race.

---

### 3.4 Booking and agreement

#### `booking.created`

```json
{
  "event": "booking.created",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "status": "DRAFT",
    "bookingId": "bk_01J..."
  }
}
```

#### `booking.updated`

```json
{
  "event": "booking.updated",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "status": "AGREEMENT_READY",
    "changedFields": ["passengerCount", "pickupPoint"],
    "agreementInvalidated": true,
    "nextAction": "RENDER_UPDATED_AGREEMENT"
  }
}
```

#### `agreement.locked`

**Meaning:** agreement is locked, not necessarily payment confirmed.

```json
{
  "event": "agreement.locked",
  "callId": "call_01J...",
  "bookingId": "bk_01J...",
  "data": {
    "status": "AGREEMENT_LOCKED",
    "agreementId": "agr_01J...",
    "agreementVersion": 1,
    "paymentGate": "UNLOCKED"
  }
}
```

---

### 3.5 Payment

#### `payment.intent.created`

```json
{
  "event": "payment.intent.created",
  "bookingId": "bk_01J...",
  "data": {
    "paymentIntentId": "pi_01J...",
    "status": "CREATED",
    "amount": { "currency": "VND", "minor": 300000 },
    "reference": "ref_01J...",
    "expiresAt": "2026-06-20T11:00:00.000Z"
  }
}
```

Do not broadcast private wallet configuration that does not need to be shown. The customer retrieves the payment URL in the REST response that created the intent.

#### `payment.pending`

```json
{
  "event": "payment.pending",
  "bookingId": "bk_01J...",
  "data": {
    "paymentIntentId": "pi_01J...",
    "status": "PENDING"
  }
}
```

`transactionSignatureShort` is optional. It is absent while automatic reference discovery has not found a candidate transaction yet.

#### `payment.confirmed`

```json
{
  "event": "payment.confirmed",
  "bookingId": "bk_01J...",
  "data": {
    "paymentIntentId": "pi_01J...",
    "status": "CONFIRMED",
    "transactionSignatureShort": "5x9a...q2Lp",
    "verifiedAt": "2026-06-20T10:55:00.000Z",
    "nextAction": "ISSUE_RECEIPT"
  }
}
```

#### `payment.failed`

```json
{
  "event": "payment.failed",
  "bookingId": "bk_01J...",
  "data": {
    "paymentIntentId": "pi_01J...",
    "status": "REJECTED",
    "errorCode": "PAYMENT_REFERENCE_MISMATCH",
    "retryable": false,
    "customerMessage": "Không thể xác nhận khoản cọc này. Vui lòng liên hệ hỗ trợ."
  }
}
```

---

### 3.6 Receipt and verification

#### `receipt.created`

```json
{
  "event": "receipt.created",
  "bookingId": "bk_01J...",
  "data": {
    "receiptId": "rcpt_01J...",
    "status": "ISSUED",
    "verification": "PENDING"
  }
}
```

#### `receipt.verified`

```json
{
  "event": "receipt.verified",
  "bookingId": "bk_01J...",
  "data": {
    "receiptId": "rcpt_01J...",
    "status": "VERIFIED_MATCH",
    "verification": "MATCH",
    "agreementVersion": 1,
    "verifiedAt": "2026-06-20T10:56:00.000Z"
  }
}
```

When proof does not match, use the same event name with `status: "MISMATCH"`, a safe support message, and `nextAction: "MANUAL_REVIEW"`. Never include the raw competing agreement values in the event.

---

## 4. Client consumption rules

```text
1. Subscribe after call creation.
2. Store latest eventId/sequence per call.
3. Ignore duplicate eventId.
4. Apply events in sequence; if a gap appears, fetch REST summary.
5. Never infer irreversible payment/booking success from a local action.
6. On reconnect, send Last-Event-ID and fetch GET call/risk/payment/receipt state.
```

### Recommended UI reducers

| UI area            | Event source                            | Recovery endpoint                    |
| ------------------ | --------------------------------------- | ------------------------------------ |
| call indicator     | `call.*`                                | `GET /v1/calls/:callId`              |
| transcript         | `transcript.turn.created`               | `GET /v1/calls/:callId/transcript`   |
| decision panel     | `transcript.analysis.updated`, `risk.*` | `GET /v1/calls/:callId/risk`         |
| booking agreement  | `booking.*`                             | booking read endpoint / call summary |
| payment CTA/status | `payment.*`                             | `GET /v1/payments/:bookingId/status` |
| receipt view       | `receipt.*`                             | `GET /v1/receipts/:receiptId`        |

---

## 5. Event versioning and deprecation

- Add optional fields without changing `version`.
- Breaking rename/type change requires a new event version or new event name.
- Keep old payload support for one deployment window at minimum.
- Event consumers must ignore unknown optional fields.
- Event producers must not remove `eventId`, `event`, `occurredAt`, `callId`, or `sequence`.

---

## 6. Durable event-log requirement

To avoid “database updated but no UI event” failure:

```text
DB transaction:
  1. write aggregate state
  2. write audit log
  3. write canonical event-envelope row

Phase 5 API:
  4. replay rows after Last-Event-ID
  5. keep the SSE connection open
  6. poll committed rows and deliver in per-call sequence
```

Phase 5 uses append-only `audit_logs` rows with `aggregate_type = CALL_STREAM`, a stable `event_id`, and the validated canonical envelope in `after_state` as the lightweight transactional event log. PostgreSQL advisory locks serialize per-call sequence allocation. A dedicated delivery outbox/worker is required later when external consumers or retryable background dispatch exist. Do not publish browser events before DB commit.

---

## 7. Event contract acceptance tests

- [ ] duplicate delivery does not duplicate transcript/payment UI state;
- [ ] reconnect after `Last-Event-ID` restores ordered events or falls back to REST;
- [ ] event payload never includes full phone, raw audio URL, secret, or full agreement payload;
- [ ] `payment.confirmed` only follows server-side verification;
- [ ] failed/expired payment events lead to safe UI, not success receipt;
- [ ] event schema is generated/validated from `@call-to-cash/shared` Zod schemas.

---

## 8. Phase 11.0 Revenue Twin events

Phase 11 emits these version-1 safe event schemas from committed Revenue Twin transactions.

| Event                                | Safe payload purpose                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `revenue_twin.evaluated`             | evaluation ID, status, requested departure ID, offer count, potential net amount, safe reason codes, timestamp |
| `revenue_twin.offer.accepted`        | evaluation/offer IDs, selected departure ID, existing hold ID, final fare, discount, timestamp                 |
| `revenue_twin.offer.declined`        | evaluation/offer IDs, safe reason codes, timestamp                                                             |
| `revenue_twin.offer.expired`         | evaluation/offer IDs, safe reason codes, timestamp                                                             |
| `revenue_twin.reevaluation.required` | evaluation/offer IDs, safe reason codes, timestamp                                                             |
| `revenue_twin.waitlist.joined`       | evaluation/waitlist/requested-departure IDs, party size, timestamp; never creates a hold                       |

No Revenue Twin event may contain a raw transcript, phone number, wallet address, payment signature, risk-score internals, model prompt/response, or chain-of-thought.
