# Call-to-Cash Risk Copilot — State Machines

> **Status:** MVP technical contract v1  
> **Owner:** Backend Lead  
> **Primary implementation:** shared enums in `packages/shared`; transition guards in `apps/api`  
> **Related docs:** [Data Model](./DATA-MODEL.md), [Booking Contract](../product/BOOKING-CONTRACT.md), [Risk Scoring](../product/RISK-SCORING.md), [API Contract](../contracts/API-CONTRACT.md), [Error Codes](../contracts/ERROR-CODES.md)

State machines make payment and receipt behavior deterministic. The frontend may display a state, but it never owns a transition. Every authoritative transition runs inside `apps/api`, validates guards, persists state, writes an audit log, and emits a realtime event.

---

## 1. Global transition rules

1. **No direct status assignment from client payloads.** APIs accept commands, not arbitrary `status` values.
2. **Every transition is idempotent.** A replayed request returns the current state/result and does not create duplicate money movement.
3. **Terminal state is not always final business closure.** `PAYMENT_FAILED` may lead to a new payment intent; a verified payment cannot be silently reverted.
4. **State is separated by aggregate.** Call state, booking state, payment state, proof state, and receipt state do not collapse into one overloaded enum.
5. **Unexpected condition fails safe.** Low confidence, mismatch, expiry, or policy exception must lock payment or route to manual review.

---

## 2. Call Session state machine

### 2.1 States

| State | Meaning | Terminal? |
|---|---|---|
| `CREATED` | call session exists; participant may not have joined | No |
| `ACTIVE` | at least one participant joined; transcript may arrive | No |
| `ENDED` | normal completion/end action | Yes |
| `FAILED` | infrastructure/session failure before normal end | Yes |
| `CANCELLED` | cancelled before active call begins | Yes |

### 2.2 Transitions

```text
CREATED ──join──> ACTIVE ──end──> ENDED
   │                  │
   ├─cancel──────────> CANCELLED
   └─setup failure────> FAILED

ACTIVE ──provider failure / timeout──> FAILED
```

| From | Command / event | To | Guards | Side effects |
|---|---|---|---|---|
| `CREATED` | participant joins / Agora webhook | `ACTIVE` | valid call, authorized participant | set `started_at`; audit; emit `call.joined` |
| `CREATED` | `POST /end` before join | `CANCELLED` | caller owns call | audit; emit `call.ended` |
| `CREATED` | token/channel setup failure | `FAILED` | server-detected | error audit; emit `call.failed` |
| `ACTIVE` | `POST /end` / webhook left | `ENDED` | idempotent | set `ended_at`; flush buffers; emit `call.ended` |
| `ACTIVE` | provider outage/timeout | `FAILED` | server-detected | preserve transcript; queue recovery; emit `call.failed` |

**Call state must not decide payment gate.** It only governs session lifecycle and transcript acceptance.

---

## 3. Booking state machine

### 3.1 Canonical states

| State | Meaning | Payment allowed? |
|---|---|---|
| `DRAFT` | booking record exists but required fields are incomplete | No |
| `FIELDS_PARTIAL` | some fields extracted; missing/ambiguous data remains | No |
| `BOOKING_DRAFT_READY` | operational fields are complete; price/policy/inventory still may need resolution | No |
| `AGREEMENT_READY` | current terms are available to render/read to customer | No |
| `AGREEMENT_LOCKED` | customer explicitly confirmed a specific agreement version | Not yet; intent creation guard still required |
| `PAYMENT_PENDING` | valid payment intent exists and is awaiting verification | Yes, for that intent only |
| `PAYMENT_CONFIRMED` | transaction validated server-side | No new payment required |
| `BOOKING_CONFIRMED` | provider inventory hold converted/confirmed | No |
| `RECEIPT_ISSUED` | customer receipt generated | Terminal success for MVP |
| `CANCELLED` | customer/provider cancelled before confirmed payment | Terminal |
| `MANUAL_REVIEW_REQUIRED` | exception requires operator resolution | Hold |
| `EXPIRED` | inventory hold/agreement/payment window expired | Terminal for current agreement |

### 3.2 Main path

```text
DRAFT
→ FIELDS_PARTIAL
→ BOOKING_DRAFT_READY
→ AGREEMENT_READY
→ AGREEMENT_LOCKED
→ PAYMENT_PENDING
→ PAYMENT_CONFIRMED
→ BOOKING_CONFIRMED
→ RECEIPT_ISSUED
```

### 3.3 Alternative paths

```text
DRAFT / FIELDS_PARTIAL / BOOKING_DRAFT_READY / AGREEMENT_READY
  → CANCELLED

AGREEMENT_READY / AGREEMENT_LOCKED / PAYMENT_PENDING
  → EXPIRED

PAYMENT_PENDING / PAYMENT_CONFIRMED / BOOKING_CONFIRMED
  → MANUAL_REVIEW_REQUIRED
```

### 3.4 Transition guards

| From | To | Required command / event | Non-negotiable guards |
|---|---|---|---|
| `DRAFT` | `FIELDS_PARTIAL` | extraction accepted | at least one canonical field captured |
| `FIELDS_PARTIAL` | `BOOKING_DRAFT_READY` | update/recompute | required operational fields complete and non-contradictory |
| `BOOKING_DRAFT_READY` | `AGREEMENT_READY` | create agreement draft | current price, deposit, policy, and inventory hold valid |
| `AGREEMENT_READY` | `AGREEMENT_LOCKED` | booking confirm | explicit confirmation of rendered agreement version; final transcript/interaction evidence |
| `AGREEMENT_LOCKED` | `PAYMENT_PENDING` | create payment intent | gate `UNLOCKED`; hold valid; no critical blocker; no existing active intent |
| `PAYMENT_PENDING` | `PAYMENT_CONFIRMED` | verified chain transaction | correct amount, recipient, token, reference, intent not expired, signature unused |
| `PAYMENT_CONFIRMED` | `BOOKING_CONFIRMED` | inventory confirmation | provider/hold conversion success |
| `BOOKING_CONFIRMED` | `RECEIPT_ISSUED` | receipt issue | proof record generated and receipt payload valid |
| any non-terminal pre-payment state | `CANCELLED` | cancel command | no confirmed payment exists |
| any non-terminal payment state | `MANUAL_REVIEW_REQUIRED` | exception detected | mismatch, stale agreement, manual override, policy exception |

### 3.5 Material change rule

The following changes invalidate an unlocked/active payment path:

```text
route, departure time, passenger count, pickup point,
total amount, deposit amount, refund policy version, provider/inventory assignment
```

When any material term changes:

```text
1. Mark current agreement SUPERSEDED.
2. Expire/cancel active payment intent.
3. Return booking to AGREEMENT_READY.
4. Require a new explicit confirmation.
5. Create a new agreement version before payment can reopen.
```

---

## 4. Payment Gate state machine

The public decision enum stays aligned with `RISK-SCORING.md`. A separate `next_action` tells the UI what to do.

| Gate decision | UI meaning | Typical next action | Can create payment intent? |
|---|---|---|---|
| `LOCKED` | information/policy not ready | `ASK_CLARIFICATION` or `HOLD` | No |
| `READY_FOR_CONFIRMATION` | terms are ready, explicit confirmation still missing | `ASK_CONFIRMATION` | No |
| `UNLOCKED` | deterministic rules permit payment intent creation | `OPEN` | Yes |
| `MANUAL_REVIEW_REQUIRED` | critical exception or mismatch | `BLOCK` / `HANDOFF` | No |

### 4.1 Gate transition inputs

```text
completeness_score
payment_readiness_score
dispute_risk_score
explicit_confirmation
agreement_locked
inventory_hold_active
critical_blockers[]
```

### 4.2 Gate rules

```ts
if (criticalBlockers.length > 0) => MANUAL_REVIEW_REQUIRED
else if (disputeRisk > 35) => LOCKED
else if (completeness < 85) => LOCKED
else if (!agreementLocked || !explicitConfirmation) => READY_FOR_CONFIRMATION
else if (paymentReadiness < 80) => READY_FOR_CONFIRMATION
else if (!inventoryHoldActive) => LOCKED
else => UNLOCKED
```

**Important:** UI score animation never overrides this evaluator. An LLM cannot return `UNLOCKED` without this deterministic rule set passing.

---

## 5. Payment Intent state machine

### 5.1 States

| State | Meaning | Terminal? |
|---|---|---|
| `NOT_CREATED` | no payment intent exists | No |
| `CREATED` | server created QR/link/reference | No |
| `PENDING` | a transaction may be in flight or awaiting confirmation | No |
| `CONFIRMED` | server has validated the on-chain transaction | Yes |
| `FAILED` | technical verification failed; may retry safely | No / operational terminal |
| `EXPIRED` | time window ended | Yes |
| `REJECTED` | observed payment failed validation | Yes for this intent |
| `MANUAL_REVIEW_REQUIRED` | ambiguous/mismatch requires operator | Yes for automatic flow |
| `CANCELLED` | intent invalidated by changed agreement/cancel | Yes |

### 5.2 Transitions

```text
NOT_CREATED → CREATED → PENDING → CONFIRMED
                    │        ├→ REJECTED
                    │        ├→ MANUAL_REVIEW_REQUIRED
                    │        └→ FAILED → PENDING (retry)
                    ├→ EXPIRED
                    └→ CANCELLED
```

| From | To | Trigger | Guards |
|---|---|---|---|
| `NOT_CREATED` | `CREATED` | create payment API | booking `AGREEMENT_LOCKED`, gate `UNLOCKED`, no active intent |
| `CREATED` | `PENDING` | wallet/webhook/poller detects candidate tx | reference matches intent candidate |
| `PENDING` | `CONFIRMED` | server verification | amount/recipient/token/reference/signature all valid |
| `PENDING` | `REJECTED` | server verification | amount/recipient/reference incorrect or signature reused |
| `CREATED`/`PENDING` | `EXPIRED` | expiry worker | now >= `expires_at`; no confirmation |
| `CREATED`/`PENDING` | `CANCELLED` | material booking change/cancel | agreement no longer active |
| any non-confirmed | `MANUAL_REVIEW_REQUIRED` | ambiguous chain/provider condition | audit reason required |

**Never transition from `CONFIRMED` back to `PENDING`, `CREATED`, or `CANCELLED`.** Refunds are separate workflows and must not pretend the original payment never happened.

---

## 6. Payment transaction verification state machine

This is intentionally separate from payment intent status because multiple observed transaction attempts may exist.

```text
OBSERVED
→ VALIDATING
→ CONFIRMED | REJECTED | FAILED
```

| State | Meaning |
|---|---|
| `OBSERVED` | tx signature detected from client, webhook, or poller |
| `VALIDATING` | chain data is being checked by backend |
| `CONFIRMED` | all verification predicates matched |
| `REJECTED` | definitive mismatch, reused signature, or invalid chain data |
| `FAILED` | temporary infrastructure/chain query failure; retry allowed |

A transaction record is append-only. A retry creates a new verification attempt/audit entry; it does not rewrite observed values.

---

## 7. Proof state machine

| State | Meaning |
|---|---|
| `PENDING` | agreement hash exists; waiting for verified payment anchor |
| `MATCH` | recomputed canonical agreement hash matches stored/anchored proof |
| `MISMATCH` | hash or agreement version differs; requires manual review |
| `UNAVAILABLE` | verification data temporarily unavailable; do not claim success |

```text
PENDING → MATCH
PENDING → UNAVAILABLE
PENDING / MATCH → MISMATCH
UNAVAILABLE → PENDING (retry) → MATCH | MISMATCH
```

**Rule:** `MISMATCH` is sticky until an operator completes a documented resolution. Never hide it by regenerating a proof over altered data.

---

## 8. Trust Receipt state machine

| State | Meaning | Customer copy |
|---|---|---|
| `NOT_CREATED` | no receipt yet | none |
| `ISSUED` | receipt created, verification may still be pending | “Đang xác minh” |
| `VERIFIED_MATCH` | payment and proof verified | “Đã xác minh” |
| `MISMATCH` | proof/payment mismatch | “Cần kiểm tra thủ công” |
| `MANUAL_REVIEW` | support/operator handling exception | “Đang được hỗ trợ” |

```text
NOT_CREATED → ISSUED → VERIFIED_MATCH
                     ├→ MISMATCH
                     └→ MANUAL_REVIEW
```

A receipt may be created only after payment `CONFIRMED` or when the user-facing product intentionally needs a pending receipt. It may not be branded as “verified” before proof verification passes.

---

## 9. Transition implementation template

All authoritative transitions should follow this order:

```text
1. Authenticate actor/system event.
2. Load aggregate with row lock or optimistic version check.
3. Validate current state and guards.
4. Write state change + dependent records in one DB transaction.
5. Append audit log in the same transaction.
6. Commit.
7. Publish realtime event through outbox/queue after commit.
```

### Required concurrency controls

- `payment_intents.solana_reference` unique;
- `payment_transactions.tx_signature` unique;
- unique active payment intent per booking/agreement via partial index or transactional guard;
- optimistic `version` field or `SELECT ... FOR UPDATE` for booking/payment transitions;
- idempotency key for every money-adjacent POST command.

---

## 10. State machine test matrix

| Scenario | Expected outcome |
|---|---|
| Same transcript turn posted twice | one durable turn / idempotent API response |
| Customer says “ok” before terms rendered | gate remains `LOCKED` or `READY_FOR_CONFIRMATION`; no agreement lock |
| Agreement changes after QR shown | old intent `CANCELLED`; new agreement confirmation required |
| Transaction has correct amount but wrong reference | transaction `REJECTED`; booking goes `MANUAL_REVIEW_REQUIRED` |
| Browser reports payment success without server verification | booking remains `PAYMENT_PENDING` |
| Correct verified transaction replayed to another booking | second use rejected by unique tx signature |
| Proof recomputation differs after DB tamper test | proof/receipt becomes `MISMATCH`; payment is not silently altered |
| Call drops during confirmation | booking remains pre-payment; gate locked; no payment intent |
