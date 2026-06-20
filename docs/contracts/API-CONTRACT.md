# Call-to-Cash Risk Copilot — API Contract

> **Status:** MVP technical contract v1  
> **Owner:** Backend Lead + Frontend Lead  
> **Base URL:** `/v1`  
> **Related docs:** [Data Model](../architecture/DATA-MODEL.md), [State Machines](../architecture/STATE-MACHINES.md), [Event Contract](./EVENT-CONTRACT.md), [Error Codes](./ERROR-CODES.md)

This contract defines the server authority for the first vertical slice. The browser owns voice/media transport with Agora and renders UI. `apps/api` owns durable state, risk decisions, booking transitions, payment intent creation, transaction verification, proof, and receipt issuance.

**Do not add undocumented endpoints or allow client-provided status transitions.** Update this contract and shared schemas first.

---

## 1. API conventions

### 1.1 Authentication and actor context

| Context | MVP rule |
|---|---|
| Customer browser | authenticated session or demo actor; server derives `customerId` from auth where available |
| Operator console | operator role required for manual actions |
| Agora webhook | signed/verified provider request; never trusted from browser |
| Solana verifier | server-only worker / endpoint; no wallet secret in client |

In `DEMO_MODE`, the API may use seeded actor ids, but it must still enforce state guards and idempotency.

### 1.2 Required headers

```http
Content-Type: application/json
X-Request-Id: <client-generated UUID, optional but recommended>
Idempotency-Key: <required for payment/booking confirmation commands>
Authorization: Bearer <token>   # production/staging
```

### 1.3 Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_01..."
  }
}
```

### 1.4 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATE_LOCKED",
    "message": "Payment cannot be created because confirmation is incomplete.",
    "details": {
      "missingFields": ["refundPolicyConfirmation"]
    },
    "requestId": "req_01...",
    "retryable": false
  }
}
```

The `code` is stable and machine-readable. The `message` is safe for the caller. Operator diagnostics belong in logs/audit records, not in public errors.

### 1.5 Command safety rules

- Mutating commands must validate Zod DTOs from `@call-to-cash/shared`.
- `POST /payments/solana/create`, booking confirmation, and receipt generation require an `Idempotency-Key`.
- A request body never contains authoritative `status`, risk score, `customerId` override, recipient wallet, or proof hash.
- API responses use public IDs (`call_`, `bk_`, `pi_`, `rcpt_`) unless an internal service boundary explicitly needs UUIDs.

---

### 1.6 Operational health endpoints

`GET /health` and `GET /ready` are unversioned operational endpoints. They use the standard success envelope but never expose secrets, raw dependency errors, or customer data.

- `/health` reports that the API process is alive.
- `/ready` reports current runtime mode and configured adapter names. Before durable dependencies exist, readiness covers the application process only.
- These endpoints are not customer authentication or transaction-state APIs.

---

## 2. Call Session APIs

### 2.1 `POST /v1/calls`

Create a call session before the customer joins Agora or before replay starts.

**Owner:** Call service in `apps/api`  
**State effect:** creates `CallSession(status=CREATED)`  
**Does not:** create Agora token, booking, payment, or receipt.

#### Request

```json
{
  "channelPurpose": "BOOKING",
  "sourceMode": "LIVE_AGORA",
  "customerId": "usr_customer_demo",
  "operatorId": "usr_operator_demo"
}
```

#### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "status": "CREATED",
    "channelName": "ctc_call_01J...",
    "sourceMode": "LIVE_AGORA",
    "createdAt": "2026-06-20T10:30:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- insert `call_sessions`;
- append audit action `CALL_CREATED`;
- emit `call.created`.

---

### 2.2 `GET /v1/calls/:callId`

Returns call lifecycle and linked booking summary, if one exists.

**Response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "status": "ACTIVE",
    "channelName": "ctc_call_01J...",
    "startedAt": "2026-06-20T10:31:00.000Z",
    "endedAt": null,
    "booking": {
      "bookingId": "bk_01J...",
      "status": "FIELDS_PARTIAL"
    }
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

### 2.3 `POST /v1/calls/:callId/end`

Ends an active call or cancels an unstarted call.

#### Request

```json
{
  "reason": "CUSTOMER_ENDED"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "status": "ENDED",
    "endedAt": "2026-06-20T10:45:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- changes call state per `STATE-MACHINES.md`;
- flushes final transcript/replay buffer;
- does **not** automatically cancel a valid existing booking or payment intent;
- emits `call.ended`.

---

## 3. Agora APIs

### 3.1 `POST /v1/agora/token`

Creates a short-lived Agora token for an already-created call session.

**Owner:** `packages/agora` invoked by `apps/api`  
**Security:** server-only Agora credentials; browser receives only time-bounded token and channel metadata.

#### Request

```json
{
  "callId": "call_01J...",
  "role": "PUBLISHER"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "channelName": "ctc_call_01J...",
    "uid": "customer_01J...",
    "token": "006...",
    "expiresAt": "2026-06-20T11:30:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- no booking/risk/payment change;
- audit token issuance with no token value in log;
- may transition call `CREATED → ACTIVE` only from verified join/webhook, not merely token creation.

---

## 4. Transcript APIs

### 4.1 `POST /v1/transcripts/turns`

Persists a final transcript turn and triggers extraction/risk recomputation. It may be called by a trusted transcript adapter, replay engine, or server-side Agora integration.

**Do not call this endpoint directly from an untrusted browser with arbitrary speaker identity in production.** Use a signed server/proxy path.

#### Request

```json
{
  "callId": "call_01J...",
  "turn": {
    "clientTurnId": "turn_client_0007",
    "sequenceNo": 7,
    "speaker": "CUSTOMER",
    "content": "Tôi muốn đặt 3 vé Hà Nội đi Sa Pa chuyến 22 giờ 30.",
    "language": "vi-VN",
    "isFinal": true,
    "startedAt": "2026-06-20T10:33:12.000Z",
    "endedAt": "2026-06-20T10:33:17.000Z",
    "sttConfidence": 0.94,
    "source": "AGORA"
  }
}
```

#### Response — `202 Accepted`

```json
{
  "success": true,
  "data": {
    "turnId": "turn_01J...",
    "callId": "call_01J...",
    "accepted": true,
    "analysisQueued": true
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- redacts/masks PII before default persistence and logs;
- inserts immutable transcript turn;
- emits `transcript.turn.created`;
- queues extraction/risk analysis for final turns only;
- eventually emits `transcript.analysis.updated`, `risk.score.updated`, and possibly `risk.payment_gate.updated`.

---

### 4.2 `GET /v1/calls/:callId/transcript`

Returns an authorized, redacted transcript projection.

**Query parameters**

```text
?afterSequenceNo=0&limit=100
```

#### Response

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "turns": [
      {
        "turnId": "turn_01J...",
        "sequenceNo": 7,
        "speaker": "CUSTOMER",
        "content": "Tôi muốn đặt 3 vé Hà Nội đi Sa Pa chuyến 22 giờ 30.",
        "isFinal": true,
        "createdAt": "2026-06-20T10:33:17.500Z"
      }
    ]
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

## 5. Risk APIs

### 5.1 `POST /v1/risk/analyze`

Explicitly queues/re-runs analysis for a call or booking. Intended for replay/demo, operator retry, and internal testing; normal live flow triggers analysis from final transcript turns.

#### Request

```json
{
  "callId": "call_01J...",
  "mode": "LATEST_FINAL_TURNS"
}
```

#### Response — `202 Accepted`

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "analysisJobId": "job_01J...",
    "status": "QUEUED"
  },
  "meta": { "requestId": "req_01J..." }
}
```

**Rule:** client cannot submit `riskScore`, `gateDecision`, or `reasonCodes`.

---

### 5.2 `GET /v1/calls/:callId/risk`

Returns the latest authoritative risk decision and customer-safe explanation.

#### Response

```json
{
  "success": true,
  "data": {
    "callId": "call_01J...",
    "assessmentId": "risk_01J...",
    "completenessScore": 82,
    "disputeRisk": 20,
    "paymentReadiness": 65,
    "paymentGate": "LOCKED",
    "nextAction": "ASK_CLARIFICATION",
    "missingFields": ["refundPolicyConfirmation"],
    "reasonCodes": ["REFUND_POLICY_NOT_CONFIRMED"],
    "customerMessage": "Cần xác nhận chính sách hoàn/hủy trước khi cọc.",
    "assessedAt": "2026-06-20T10:34:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

## 6. Booking and Agreement APIs

### 6.1 `POST /v1/bookings`

Creates or materializes a booking draft from a call extraction or explicit form/replay data.

#### Request

```json
{
  "callId": "call_01J...",
  "routeFrom": "Ha Noi",
  "routeTo": "Sa Pa",
  "departureAt": "2026-06-20T22:30:00+07:00",
  "passengerCount": 3,
  "pickupPoint": "My Dinh",
  "contactPhone": "0912345678"
}
```

#### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "status": "BOOKING_DRAFT_READY",
    "contactPhoneMasked": "0912***678"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- creates or updates the draft through service-layer validation;
- normalizes time, money, and phone fields;
- recalculates risk/gate; emits `booking.created` or `booking.updated`.

---

### 6.2 `PATCH /v1/bookings/:bookingId`

Updates mutable draft terms only. The API rejects any attempt to mutate a locked agreement through this endpoint.

#### Request

```json
{
  "passengerCount": 4,
  "pickupPoint": "Noi Bai"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "status": "AGREEMENT_READY",
    "agreementInvalidated": true,
    "nextAction": "RENDER_UPDATED_AGREEMENT"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- invalidates/supersedes prior agreement if terms were material;
- cancels active payment intent if affected;
- requires new agreement confirmation;
- audit + events emitted after commit.

---

### 6.3 `POST /v1/bookings/:bookingId/confirm`

Locks a specific agreement version after explicit customer confirmation.

#### Required header

```http
Idempotency-Key: confirm-bk_01J-v1-<uuid>
```

#### Request

```json
{
  "agreementVersion": 1,
  "confirmation": {
    "method": "VOICE",
    "confirmedTurnId": "turn_01J...",
    "text": "Tôi xác nhận"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "status": "AGREEMENT_LOCKED",
    "agreement": {
      "agreementId": "agr_01J...",
      "version": 1,
      "hash": "8df2...9ab1"
    },
    "paymentGate": "UNLOCKED"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Guards

- agreement version exists and is `READY`;
- final terms were rendered/read;
- explicit confirmation is unambiguous and evidence-backed;
- no critical risk blocker;
- inventory hold is active.

---

## 7. Solana Payment APIs

### 7.1 `POST /v1/payments/solana/create`

Creates a server-owned payment intent and a Solana Pay transfer request/QR URL.

#### Required header

```http
Idempotency-Key: pi-bk_01J-v1-<uuid>
```

#### Request

```json
{
  "bookingId": "bk_01J..."
}
```

#### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_01J...",
    "status": "CREATED",
    "amount": {
      "currency": "VND",
      "minor": 300000
    },
    "paymentUrl": "solana:<recipient>?amount=...",
    "qrPayload": "solana:<recipient>?amount=...",
    "reference": "ref_01J...",
    "expiresAt": "2026-06-20T11:00:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Guards

- booking is `AGREEMENT_LOCKED`;
- current risk gate is `UNLOCKED`;
- active inventory hold has not expired;
- no non-terminal payment intent exists for this booking/agreement.

**Security:** recipient wallet, amount, mint, reference, memo, and proof link are computed server-side. The browser cannot choose them.

---

### 7.2 `POST /v1/payments/solana/verify`

Submits or triggers verification of a candidate Solana transaction. This endpoint never accepts a client-provided `confirmed=true` field.

#### Request

```json
{
  "paymentIntentId": "pi_01J...",
  "transactionSignature": "5x9a...q2Lp"
}
```

#### Response — `202 Accepted` or `200 OK`

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_01J...",
    "verificationStatus": "PENDING",
    "transactionSignature": "5x9a...q2Lp"
  },
  "meta": { "requestId": "req_01J..." }
}
```

A subsequent poll/event returns `CONFIRMED`, `REJECTED`, `FAILED`, or `MANUAL_REVIEW_REQUIRED`.

#### Required backend predicates

```text
transaction exists on expected cluster
recipient wallet matches payment intent
amount matches payment intent exactly
token/native asset matches expected configuration
reference matches payment intent
transaction signature is not already consumed
agreement version/payment intent is still valid
```

---

### 7.3 `GET /v1/payments/:bookingId/status`

Returns current payment state for the active/latest payment intent of a booking.

#### Response

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "paymentIntentId": "pi_01J...",
    "status": "CONFIRMED",
    "transactionSignature": "5x9a...q2Lp",
    "verifiedAt": "2026-06-20T10:55:00.000Z",
    "nextAction": "ISSUE_RECEIPT"
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

## 8. Trust Receipt APIs

### 8.1 `POST /v1/receipts/create`

Issues/refreshes a receipt after payment confirmation. The server computes proof verification; the client cannot submit proof status.

#### Required header

```http
Idempotency-Key: receipt-bk_01J-pi_01J-<uuid>
```

#### Request

```json
{
  "bookingId": "bk_01J..."
}
```

#### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "receiptId": "rcpt_01J...",
    "bookingId": "bk_01J...",
    "status": "VERIFIED_MATCH",
    "verification": "MATCH",
    "issuedAt": "2026-06-20T10:56:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

### 8.2 `GET /v1/receipts/:bookingId`

Returns the customer-safe receipt. Authorization must ensure the caller owns the booking or has a short-lived receipt access token.

#### Response

```json
{
  "success": true,
  "data": {
    "receiptId": "rcpt_01J...",
    "status": "VERIFIED_MATCH",
    "booking": {
      "bookingId": "bk_01J...",
      "route": "Ha Noi → Sa Pa",
      "departureAt": "2026-06-20T22:30:00+07:00",
      "passengerCount": 3,
      "contactPhoneMasked": "0912***678"
    },
    "deposit": {
      "amount": { "currency": "VND", "minor": 300000 },
      "status": "CONFIRMED"
    },
    "verification": {
      "status": "MATCH",
      "agreementVersion": 1,
      "transactionSignatureShort": "5x9a...q2Lp"
    }
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

### 8.3 `GET /v1/receipts/:bookingId/verify`

Recomputes or retrieves current proof verification without exposing raw agreement payload.

#### Response

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "receiptId": "rcpt_01J...",
    "status": "MATCH",
    "agreementVersion": 1,
    "proofHash": "8df2...9ab1",
    "verifiedAt": "2026-06-20T10:57:00.000Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

When mismatch exists, return a safe `MISMATCH` status and route to manual review; do not reveal all internal evidence to an unauthorized user.

---

## 9. Realtime endpoint

### `GET /v1/calls/:callId/events`

**MVP transport:** Server-Sent Events (SSE), server → browser only. The browser sends commands through REST; Agora handles audio/media directly.

```http
Accept: text/event-stream
Cache-Control: no-cache
Last-Event-ID: evt_01J...   # optional reconnect cursor
```

Event payloads and delivery semantics are defined in [EVENT-CONTRACT.md](./EVENT-CONTRACT.md). SSE is the only MVP browser update transport; adopting another transport requires an explicit contract revision.

---

## 10. Endpoint ownership matrix

| Endpoint group | Main code owner | Shared dependencies |
|---|---|---|
| Calls / transcript | `apps/api` | `@call-to-cash/db`, `@call-to-cash/shared`, `@call-to-cash/agora`, `@call-to-cash/ai` |
| Agora token | `apps/api` | `@call-to-cash/agora`, `@call-to-cash/config` |
| Risk | `apps/api` | `@call-to-cash/ai`, `@call-to-cash/db`, `@call-to-cash/shared` |
| Booking/agreement | `apps/api` | `@call-to-cash/db`, `@call-to-cash/shared` |
| Payment/proof | `apps/api` | `@call-to-cash/solana`, `@call-to-cash/db`, `@call-to-cash/shared` |
| Receipt | `apps/api` | `@call-to-cash/db`, `@call-to-cash/solana`, `@call-to-cash/shared` |

---

## 11. Minimum acceptance tests

- [ ] invalid body returns structured `VALIDATION_ERROR` without a 500;
- [ ] duplicated idempotent payment creation returns original payment intent;
- [ ] client cannot set booking/payment/receipt status directly;
- [ ] transcript final turn creates durable turn and realtime event;
- [ ] gate remains locked when a required field or confirmation is missing;
- [ ] old payment intent is rejected/cancelled after material agreement change;
- [ ] only server-side verification can confirm payment;
- [ ] receipt does not return raw PII, full transcript, or raw agreement JSON.
