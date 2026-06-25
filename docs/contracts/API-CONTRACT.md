# Call-to-Cash Risk Copilot — API Contract

> **Status:** MVP technical contract v1 — updated for Phase 8
> **Owner:** Backend Lead + Frontend Lead  
> **Base URL:** `/v1`  
> **Related docs:** [Data Model](../architecture/DATA-MODEL.md), [State Machines](../architecture/STATE-MACHINES.md), [Event Contract](./EVENT-CONTRACT.md), [Error Codes](./ERROR-CODES.md)

This contract defines the server authority for the first vertical slice. The browser owns voice/media transport with Agora and renders UI. `apps/api` owns durable state, risk decisions, booking transitions, payment intent creation, transaction verification, proof, and receipt issuance.

**Do not add undocumented endpoints or allow client-provided status transitions.** Update this contract and shared schemas first.

---

## 1. API conventions

### 1.1 Authentication and actor context

| Context          | MVP rule                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Customer browser | authenticated session or demo actor; server derives `customerId` from auth where available |
| Operator console | operator role required for manual actions                                                  |
| Agora webhook    | signed/verified provider request; never trusted from browser                               |
| Solana verifier  | server-only worker / endpoint; no wallet secret in client                                  |

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
- booking confirmation plus mock payment create/verify commands require an `Idempotency-Key`.
- A request body never contains authoritative `status`, risk score, `customerId` override, recipient wallet, or proof hash.
- API responses use public IDs (`call_`, `bk_`, `pi_`, `rcpt_`) unless an internal service boundary explicitly needs UUIDs.

---

### 1.6 API discovery and operational health endpoints

`GET /`, `GET /health`, and `GET /ready` are unversioned operational endpoints. They use the standard success envelope but never expose secrets, raw dependency errors, or customer data.

- `/` identifies the API and advertises only the `/health` and `/ready` paths. It does not expose route inventory, configuration, or provider credentials.
- `/health` reports that the API process is alive.
- `/ready` reports current runtime mode, configured adapter names, and PostgreSQL readiness. It returns `503 DATABASE_UNAVAILABLE` when the database is missing or unavailable.
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

### 3.0 Phase 9 voice-session adapter

`POST /v1/voice-sessions` records explicit `ANALYSIS` consent, creates a `LIVE_AGORA` call, and returns public RTC metadata (app ID, channel, numeric UID, short-lived token, expiry). The browser must join that exact channel and publish its microphone before calling `POST /v1/voice-sessions/:callId/start` with `rtcConnected: true`, `microphonePublished: true`, and the issued `browserRtcUid`. The API verifies the issued UID before it starts the CAI agent server-side. `POST /stop` stops the provider agent and ends local session state. `GET /v1/voice-sessions/:callId` returns a privacy-safe status projection.

`POST /v1/voice-sessions/:callId/provider-events` is the internal trusted live-relay boundary only. It requires `X-Agora-Signature` using `AGORA_PROVIDER_EVENT_SECRET`; it is never called by the browser. The isolated `apps/rtm-relay` sidecar uses this boundary after receiving an RTM frame that exactly matches its server-issued call/channel/agent-session binding and expected CAI agent UID. The payload binds `callId`, `channelName`, active CAI `sessionId`, and `occurredAt`; events outside a five-minute freshness window are rejected. It forwards only normalized final provider turns to the canonical transcript command; interim turns are accepted but non-persisted and cannot alter booking, risk, payment, proof, or receipt state. A final signed turn may reconcile after a normal `ENDED` call without reopening it; the same exception is unavailable to browser/replay input and never applies to `FAILED` or `CANCELLED` calls.

`apps/rtm-relay` exposes a separate, private control surface (`POST/DELETE /v1/relay/sessions`) that is not a browser or public API. Only `apps/api` may call it, using `X-Ctc-Relay-Signature` computed with `AGORA_RTM_RELAY_CONTROL_SECRET`. The start command includes only call/channel/agent-session identifiers, agent UID, and a short-lived relay token; it contains no transcript or customer PII. The relay accepts Agora's documented `user.transcription` and `assistant.transcription` RTM messages from the bound `agent_rtm_uid`. Customer messages require `final: true`; terminal assistant messages forward immediately, while valid text-mode assistant updates without `turn_status` are deduplicated and emitted after a 500 ms quiet window. Relay health exposes aggregate received/accepted/rejected counters plus a non-content assistant-text category (`direct`, `alternate`, `missing`, or `nonString`); it never exposes transcript content, payloads, tokens, or signatures. A custom pipeline may still emit the legacy internal `ctc.transcript.final/v1` frame. Browser code never sees the control secret or relay token.

`POST /v1/webhooks/agora/conversation-ai` is the fixed public Agora Notifications reconciliation endpoint. It verifies `Agora-Signature-V2` against the exact raw request body using the separate `AGORA_NCS_WEBHOOK_SECRET`, requires Agora's fixed Conversational AI product id `17` and event type `103`, rejects stale delivery, resolves the call solely from `payload.labels.call_id`, and validates `payload.channel` plus `payload.agent_id` against the call/session binding. The documented `payload.contents` roles map `user → CUSTOMER` and `assistant → AGENT`; each non-empty item receives a deterministic notice/index/role provider turn id before entering the canonical transcript command. Because this is post-session history, a normal `ENDED` call may receive its final reconciled turns after `call.ended`; the API persists them idempotently without reactivating the call. Labels are limited to `call_id` and `schema_version` and never contain PII or transcript content.

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

### 4.1 `POST /v1/calls/:callId/transcript-turns`

Persists a final transcript turn and triggers extraction/risk recomputation. It may be called by a trusted transcript adapter, replay engine, or server-side Agora integration.

**Do not call this endpoint directly from an untrusted browser with arbitrary speaker identity in production.** Use a signed server/proxy path.

#### Request

```json
{
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
    "analysisQueued": false
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Side effects

- redacts/masks PII before default persistence and logs;
- inserts immutable transcript turn;
- emits `transcript.turn.created`;
- executes deterministic replay extraction/risk analysis synchronously for final turns in Phase 5;
- emits `booking.updated`, `risk.score.updated`, and `risk.payment_gate.updated` after committed persistence.
- A trusted final `AGORA` customer turn containing an explicit Vietnamese confirmation (for example
  `tôi xác nhận`) may invoke the existing agreement-confirmation command only when the booking is
  already `AGREEMENT_READY`. The normal agreement/payment events then drive the existing Solana
  payment-intent flow; a replay or untrusted browser turn cannot invoke this automation.

---

### 4.2 `GET /v1/calls/:callId/transcript`

Returns final redacted authoritative turns in ascending server `sequenceNo` order. The web client uses it on recovery; browser RTC/RTM callbacks never populate the durable transcript projection.

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

### 6.2 `GET /v1/bookings/:bookingId`

Returns the current authoritative, customer-safe booking read model used for initial load and REST recovery after an SSE reconnect or sequence gap.

**Owner/source module:** `apps/api/src/modules/booking`

#### Path parameters

```text
bookingId: public booking identifier with the bk_ prefix
```

#### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "bookingId": "bk_01J...",
    "status": "AGREEMENT_READY",
    "routeFrom": "Ha Noi",
    "routeTo": "Sa Pa",
    "departureAt": "2026-06-20T15:30:00.000Z",
    "passengerCount": 3,
    "pickupPoint": "My Dinh",
    "contactPhoneMasked": "0912***678",
    "fareTotalVnd": 1050000,
    "depositAmountVnd": 300000,
    "refundPolicyVersion": "BUS-V1/1.0",
    "agreementVersion": 1,
    "paymentGate": "READY_FOR_CONFIRMATION"
  },
  "meta": { "requestId": "req_01J..." }
}
```

**Privacy:** this projection returns masked contact data only. It never returns a raw phone number, transcript content, or canonical agreement payload. Authorization must prevent callers from reading bookings they do not own.

**Possible errors:** `400 VALIDATION_ERROR`, `404 BOOKING_NOT_FOUND`, `503 DATABASE_UNAVAILABLE`.

---

### 6.3 `PATCH /v1/bookings/:bookingId`

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

### 6.4 `POST /v1/bookings/:bookingId/confirm`

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

For the customer confirmation card, the same endpoint accepts the current
agreement version with `method: "WEB"` and visible acknowledgement text:

```json
{
  "agreementVersion": 1,
  "confirmation": {
    "method": "WEB",
    "text": "Xác nhận điều khoản và mở thanh toán"
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

- booking is `AGREEMENT_READY` and the requested agreement version is the next current version;
- final terms were rendered/read;
- explicit confirmation is unambiguous and evidence-backed;
- no critical risk blocker;
- inventory hold is active.

An exact idempotency replay returns the locked agreement. Reusing the key with another booking or confirmation payload returns `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.

---

## 7. Phase 8 Payment APIs

The payment module remains the transaction authority. Phase 8 adds provider-neutral aliases selected by server configuration while preserving deterministic mock routes for tests and fallback. `PAYMENT_PROVIDER=mock` remains the default; `PAYMENT_PROVIDER=solana_devnet` is an explicit Devnet-only opt-in.

Provider adapters may create request metadata or observe transactions, but they cannot bypass locked-agreement, open-gate, active-hold, expiry, idempotency, signature-uniqueness, proof, receipt, or committed-event rules.

### 7.1 `POST /v1/payments/create`

Provider-neutral alias for payment intent creation. It accepts the same request and idempotency header as the legacy mock create route. When `solana_devnet` is selected, the response keeps the VND booking deposit and adds a Devnet transfer request:

```json
{
  "paymentIntentId": "pi_01J...",
  "bookingId": "bk_01J...",
  "agreementId": "agr_01J...",
  "status": "CREATED",
  "amount": { "currency": "VND", "minor": 300000 },
  "recipient": "<configured-public-key>",
  "reference": "<base58-32-byte-reference>",
  "expiresAt": "2026-06-20T11:00:00.000Z",
  "idempotencyKey": "payment-bk_01J-...",
  "provider": "solana_devnet",
  "providerPayment": {
    "provider": "solana_devnet",
    "cluster": "devnet",
    "amountLamports": 1000000,
    "amountSol": "0.001",
    "solanaPayUrl": "solana:<recipient>?amount=0.001&reference=...",
    "qrPayload": "solana:<recipient>?amount=0.001&reference=...",
    "memo": "ctc:v1:ref:<shortRef>:proof:<shortHash>:amt:<opaqueAmount>"
  }
}
```

The Devnet amount is a demonstration proof amount, not VND settlement or a claim of real commercial payment.

### 7.2 `POST /v1/payments/verify`

Provider-neutral verification alias. With `solana_devnet`, the browser sends only the payment intent ID:

```json
{
  "paymentIntentId": "pi_01J..."
}
```

The server loads recipient, amount, reference, memo, expiry, and agreement binding from the stored intent. It discovers candidate signatures by the opaque Solana Pay reference, then verifies signature status/finality, transaction failure, native SOL transfer recipient and lamports, reference-account presence, and prior signature consumption. The browser polls this endpoint while the drawer is open. Not-found, unconfirmed, timeout, and RPC-unavailable outcomes remain retryable and do not create a proof or Trust Receipt. Definitive mismatches fail closed and enter the existing manual-review flow.

### 7.3 `POST /v1/payments/mock/create`

Creates one server-owned mock payment intent bound to the current locked agreement.

#### Required header

```http
Idempotency-Key: mock-pi-bk_01J-v1-<uuid>
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
    "bookingId": "bk_01J...",
    "agreementId": "agr_01J...",
    "status": "CREATED",
    "amount": { "currency": "VND", "minor": 300000 },
    "recipient": "mock-recipient-wallet",
    "reference": "ref_01J...",
    "expiresAt": "2026-06-20T11:00:00.000Z",
    "idempotencyKey": "mock-pi-bk_01J-v1-..."
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Guards

- booking is `AGREEMENT_LOCKED`;
- current risk gate is `UNLOCKED`;
- active inventory hold has not expired;
- no non-terminal payment intent exists for this booking/agreement.

An exact idempotency replay returns the original intent with `200 OK`. Reusing the key with another booking/payload returns `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.

**Security:** recipient, amount, reference, expiry, memo/proof link, and agreement binding are computed server-side. The browser cannot choose them.

---

### 7.4 `POST /v1/payments/mock/verify`

Verifies deterministic mock-observed amount, recipient, and reference. This endpoint never accepts a client-provided authoritative status or `confirmed=true`.

#### Required header

```http
Idempotency-Key: mock-verify-pi_01J-<uuid>
```

#### Request

```json
{
  "paymentIntentId": "pi_01J...",
  "observedAmount": { "currency": "VND", "minor": 300000 },
  "observedRecipient": "mock-recipient-wallet",
  "observedReference": "ref_01J..."
}
```

#### Response — `202 Accepted` or `200 OK`

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_01J...",
    "bookingId": "bk_01J...",
    "status": "CONFIRMED",
    "transactionSignature": "mock_tx_01J...",
    "proofId": "proof_01J...",
    "receiptId": "rcpt_01J..."
  },
  "meta": { "requestId": "req_01J..." }
}
```

The same key and payload returns the original result without creating another transaction, proof, or receipt. A changed payload with the same key returns `409`. A definitive mismatch returns the matching `PAYMENT_*_MISMATCH` error, persists the rejected attempt, emits `payment.failed`, and moves the booking to manual review.

---

### 7.5 `GET /v1/payments/:bookingId/status`

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

### 7.6 `POST /v1/payments/mock/simulate-failure` _(DEMO_MODE only — Phase 7)_

Forces a payment intent into a deterministic failure outcome for demo presentations. Forbidden outside `DEMO_MODE=true`.

**No `Idempotency-Key` required.**

#### Request

```json
{
  "paymentIntentId": "pi_01J...",
  "outcome": "EXPIRED"
}
```

`outcome` must be one of: `"EXPIRED"` | `"WRONG_AMOUNT"` | `"WRONG_REFERENCE"` | `"WRONG_RECIPIENT"`

#### Response — `200 OK`

For `EXPIRED`: sets `expiresAt` to the past so the next `POST /v1/payments/mock/verify` returns `410 PAYMENT_INTENT_EXPIRED`.

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_01J...",
    "outcome": "EXPIRED",
    "message": "Payment intent forcibly expired. Next verify call will return PAYMENT_INTENT_EXPIRED."
  },
  "meta": { "requestId": "req_01J..." }
}
```

For `WRONG_AMOUNT` / `WRONG_REFERENCE` / `WRONG_RECIPIENT`: immediately submits a verification with deliberately wrong values, moves payment intent to `REJECTED`, booking to `MANUAL_REVIEW_REQUIRED`, and emits `payment.failed`.

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_01J...",
    "outcome": "WRONG_AMOUNT",
    "verificationResult": {
      "error": { "statusCode": 422, "code": "PAYMENT_AMOUNT_MISMATCH", "message": "..." }
    }
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### Guards

- `DEMO_MODE=true` or `403 AUTH_FORBIDDEN`;
- payment intent must exist and be in `CREATED` or `PENDING` state.

---

## 8. Trust Receipt APIs

Payment confirmation creates the proof record and Trust Receipt once in the same authoritative flow. There is no separate client command to issue a Phase 5 receipt.

### 8.1 `GET /v1/receipts/:receiptId`

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

### 8.2 `GET /v1/receipts/:receiptId/verify`

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

In explicit `DEMO_MODE=true`, the optional query parameter `candidateDepositAmountMinor` verifies an altered comparison copy for the tamper demonstration. It never updates the locked agreement snapshot. The query is forbidden outside demo mode.

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

The normal endpoint keeps the connection open, sends committed events after the supplied cursor, and emits heartbeat comments. `?snapshot=true` returns the same ordered replay as a finite response for deterministic contract tests and explicit recovery tooling; browser realtime clients should use the long-lived form.

---

## 10. Endpoint ownership matrix

| Endpoint group          | Main code owner | Shared dependencies                                                                        |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| Calls / transcript      | `apps/api`      | `@call-to-cash/db`, `@call-to-cash/shared`, `@call-to-cash/agora`, `@call-to-cash/ai`      |
| Agora token             | `apps/api`      | `@call-to-cash/agora`, `@call-to-cash/config`                                              |
| Risk                    | `apps/api`      | `@call-to-cash/ai`, `@call-to-cash/db`, `@call-to-cash/shared`                             |
| Booking/agreement       | `apps/api`      | `@call-to-cash/db`, `@call-to-cash/shared`                                                 |
| Payment/proof providers | `apps/api`      | `@call-to-cash/solana`, `@call-to-cash/domain`, `@call-to-cash/db`, `@call-to-cash/shared` |
| Receipt                 | `apps/api`      | `@call-to-cash/db`, `@call-to-cash/shared`                                                 |

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

---

## 12. Phase 11 Revenue Twin runtime routes

Phase 11 runtime routes resolve inventory, pricing, policy and provider state server-side. The browser may send only identifiers and the idempotency key documented below.

| Endpoint                                                      | Request authority                                       | Required server behavior                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST /v1/calls/:callId/revenue-twin/evaluations`             | customer flexibility only when absent from server state | resolve departures, policy, capacity, pricing, and eligibility server-side                              |
| `GET /v1/calls/:callId/revenue-twin/evaluations/latest`       | none                                                    | return safe latest evaluation or null                                                                   |
| `POST /v1/calls/:callId/revenue-twin/offers/:offerId/accept`  | `evaluationId`, `offerId`, `idempotencyKey` only        | reload server offer and revalidate policy/inventory before existing hold flow                           |
| `POST /v1/calls/:callId/revenue-twin/offers/:offerId/decline` | identifiers only                                        | record a safe decision without changing inventory                                                       |
| `GET /v1/revenue-twin/dashboard`                              | none                                                    | return privacy-safe aggregate metrics; secured revenue is zero until authoritative payment confirmation |

The browser must never provide departure, pricing, capacity, pickup compatibility, partner status, policy version, inventory version, or recovered-revenue authority. When a booking has a validated pickup, the server may project it into the internal Revenue Twin demand context as a `pickupPointId`; offer filtering still derives compatibility from the catalogue snapshot. On an accepted alternative, the server atomically replaces only a still-active requested-departure hold owned by the same booking; a failed replacement rolls the old hold release back, and another booking is never preempted. Success/error envelopes remain unchanged.

A final `CUSTOMER` transcript turn may express a stored-offer selection. The server maps only unambiguous ordinal/time selections (or an affirmative with exactly one open offer) to the persisted offer, then reuses the identifier-only acceptance command. An explicit `waitlist`/`danh sach cho` request is admitted only for an evaluation with no suitable offer and creates one idempotent `PENDING` waitlist entry; it never creates or revokes an inventory hold. Ambiguous language is non-mutating; the browser/agent never supplies the selected offer, price, capacity, or hold.
