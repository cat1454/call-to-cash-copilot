# Call-to-Cash Risk Copilot — Risk Scoring and Payment Gate

> **Status:** MVP v1  
> **Owner:** AI Lead + Backend Lead + Product Lead  
> **Related docs:** [Booking Contract](./BOOKING-CONTRACT.md), [Architecture Decisions](../architecture/DECISIONS.md), [Incident Runbook](../operations/INCIDENT-RUNBOOK.md)

## 1. Purpose

Risk scoring exists to answer one controlled question:

> **Is this booking sufficiently complete, understandable, and policy-compliant to open a deposit payment gate now?**

It is not a fraud detector, a personality classifier, a credit score, or a legal decision engine.

The system must score **observable transaction conditions**: missing terms, ambiguous confirmation, price/policy uncertainty, inventory status, payment mismatches, and operational exceptions.

---

## 2. Non-goals and fairness guardrails

The system must not increase risk because of:

- accent, dialect, gender presentation, age inference, or voice quality;
- perceived nervousness, emotion, or speaking speed;
- socioeconomic inference;
- arbitrary identity/profile stereotypes.

The system may increase risk only from explicit, explainable, auditable conditions relevant to booking/payment correctness.

```text
Bad signal: “voice sounds suspicious”
Good signal: “customer did not explicitly accept the stated deposit amount”
```

---

## 3. Decision model

```text
Voice / text / authoritative systems
→ AI structured extraction proposal
→ validation and normalization
→ deterministic score calculation
→ rule-based gate evaluation
→ explainable reason codes + next action
```

The LLM proposes fields and signals. The backend owns the score, the gate, and state transitions.

---

## 4. The four MVP scores

| Score               | Range | Question answered                                               | Used for                                 |
| ------------------- | ----: | --------------------------------------------------------------- | ---------------------------------------- |
| `completeness`      | 0–100 | Do we have all operationally required facts?                    | Gate prerequisite                        |
| `dispute_risk`      | 0–100 | How likely are terms to be misunderstood or contested?          | Gate blocker / manual review             |
| `payment_readiness` | 0–100 | Has the customer clearly accepted the current commercial terms? | Gate prerequisite                        |
| `agent_quality`     | 0–100 | Did the system handle the interaction safely and efficiently?   | Monitoring; never sole payment authority |

### Customer-facing score

`call_to_cash_readiness` is a progress indicator for the UI. It must not hide risk conditions.

```text
Customer UI: “Còn 1 bước để cọc giữ chỗ.”
Mentor/operator UI: Completeness 88, Dispute Risk 18, Payment Readiness 82.
```

---

## 5. Completeness score

### Purpose

Measure whether the booking has enough validated information to operate and price correctly.

### Weighted components for v1

| Component              | Weight | Complete when                                       |
| ---------------------- | -----: | --------------------------------------------------- |
| Route                  |     15 | origin and destination are supported and normalized |
| Departure time         |     15 | valid schedule slot is confirmed                    |
| Passenger count        |     12 | integer within available capacity                   |
| Pickup point           |     10 | supported pickup point is confirmed                 |
| Customer contact       |     10 | valid contact captured and masked                   |
| Inventory hold         |     15 | active hold exists and is not expired               |
| Pricing                |     10 | total price is server-calculated and current        |
| Deposit amount         |      5 | server-calculated and shown to customer             |
| Refund policy          |      5 | active policy version attached                      |
| Confirmation readiness |      3 | all terms are available to be read back             |

```ts
export function calculateCompleteness(input: CompletenessInput): number {
  let score = 0;
  if (input.routeValid) score += 15;
  if (input.departureValid) score += 15;
  if (input.passengerCountValid) score += 12;
  if (input.pickupPointValid) score += 10;
  if (input.contactValid) score += 10;
  if (input.inventoryHoldActive) score += 15;
  if (input.pricingCurrent) score += 10;
  if (input.depositCalculated) score += 5;
  if (input.refundPolicyAttached) score += 5;
  if (input.termsRenderable) score += 3;
  return score;
}
```

### Completeness blockers

```text
MISSING_ROUTE
MISSING_DEPARTURE_TIME
AMBIGUOUS_DEPARTURE_TIME
MISSING_PASSENGER_COUNT
MISSING_PICKUP_POINT
MISSING_CONTACT
INVENTORY_UNAVAILABLE
INVENTORY_HOLD_EXPIRED
PRICE_UNAVAILABLE
DEPOSIT_UNAVAILABLE
REFUND_POLICY_UNAVAILABLE
```

---

## 6. Dispute Risk score

### Purpose

Measure the possibility that the customer and provider do not share the same understanding of the terms.

This score is based on **current evidence**, not a prediction about the person.

### Base score

```text
0 = no identified disagreement risk
100 = severe unresolved inconsistency or payment exception
```

### Signal weights for v1

| Reason code                        | Weight | Example                                |         Critical? |
| ---------------------------------- | -----: | -------------------------------------- | ----------------: |
| `AMBIGUOUS_CONFIRMATION`           |    +25 | “Ừm”, “để xem” after terms are read    |                No |
| `PRICE_NOT_CONFIRMED`              |    +25 | total/deposit not read back            |                No |
| `REFUND_POLICY_NOT_CONFIRMED`      |    +20 | customer asks but never accepts policy |                No |
| `TIME_CONTRADICTION`               |    +30 | customer says both 20:30 and 22:30     | Yes if unresolved |
| `PASSENGER_COUNT_CONTRADICTION`    |    +20 | says 2 then 4 without resolution       |                No |
| `PICKUP_POINT_UNSUPPORTED`         |    +20 | requested point not served             |                No |
| `CALL_DROPPED_DURING_CONFIRMATION` |    +30 | call ended while terms were unresolved |                No |
| `PAYMENT_AMOUNT_MISMATCH`          |    +80 | transaction amount differs             |               Yes |
| `PAYMENT_RECIPIENT_MISMATCH`       |   +100 | funds sent to wrong recipient          |               Yes |
| `PAYMENT_REFERENCE_MISMATCH`       |    +80 | reference belongs to another intent    |               Yes |
| `AGREEMENT_VERSION_STALE`          |    +60 | payment bound to superseded agreement  |               Yes |
| `PROOF_MISMATCH`                   |   +100 | stored terms do not match proof        |               Yes |

### Calculation

```ts
export function calculateDisputeRisk(signals: RiskSignal[]): number {
  const score = signals
    .filter((signal) => signal.status === "ACTIVE")
    .reduce((total, signal) => total + signal.weight, 0);

  return Math.min(100, score);
}
```

No opaque model score may be added without an associated reason code, evidence reference, model version, and approval process.

---

## 7. Payment Readiness score

### Purpose

Determine whether the customer is ready to make the deposit for the **current** agreement version.

### Weighted components

| Component                     | Weight | Required evidence                         |
| ----------------------------- | -----: | ----------------------------------------- |
| Terms were rendered/read      |     20 | agreement was shown/spoken                |
| Total price understood        |     15 | customer accepts or repeats correct total |
| Deposit amount understood     |     20 | customer accepts stated amount            |
| Refund policy understood      |     15 | explicit policy acceptance                |
| Explicit booking confirmation |     25 | clear affirmative statement/action        |
| Payment channel available     |      5 | valid payment intent can be presented     |

```ts
export function calculatePaymentReadiness(input: PaymentReadinessInput): number {
  return (
    (input.termsRendered ? 20 : 0) +
    (input.totalPriceConfirmed ? 15 : 0) +
    (input.depositConfirmed ? 20 : 0) +
    (input.refundPolicyConfirmed ? 15 : 0) +
    (input.explicitConfirmation ? 25 : 0) +
    (input.paymentIntentReady ? 5 : 0)
  );
}
```

### Readiness cannot be inferred from

```text
A customer staying on the call
A customer asking for a payment QR/link
An AI-generated summary alone
A prior agreement version
```

---

## 8. Agent Quality score

### Purpose

Measure operational quality and regressions in the assistant, not customer trustworthiness.

### Signals

| Signal                                      |         Direction |
| ------------------------------------------- | ----------------: |
| Asked one missing field at a time           |          positive |
| Repeated a field already confirmed          |          negative |
| Asked for payment before agreement lock     | critical negative |
| Failed to clarify low-confidence transcript |          negative |
| Recovered from misunderstanding             |          positive |
| Handed off appropriately                    |          positive |
| Average response latency beyond target      |          negative |

### Rule

`agent_quality` must never alone open/close a customer payment gate. It is used for team analytics, quality review, and regression prevention.

---

## 9. Gate decision policy

```ts
export type PaymentGateDecision =
  | "LOCKED"
  | "READY_FOR_CONFIRMATION"
  | "UNLOCKED"
  | "MANUAL_REVIEW_REQUIRED";

export function evaluatePaymentGate(input: GateInput): PaymentGateDecision {
  if (input.criticalBlockers.length > 0) return "MANUAL_REVIEW_REQUIRED";
  if (input.disputeRisk > 35) return "LOCKED";
  if (input.completeness < 85) return "LOCKED";
  if (input.paymentReadiness < 80) return "READY_FOR_CONFIRMATION";
  if (!input.explicitConfirmation) return "READY_FOR_CONFIRMATION";
  if (!input.agreementLocked) return "READY_FOR_CONFIRMATION";
  if (!input.inventoryHoldActive) return "LOCKED";
  return "UNLOCKED";
}
```

The pre-confirmation reasons `PRICE_NOT_CONFIRMED`, `DEPOSIT_NOT_CONFIRMED`, and
`REFUND_POLICY_NOT_CONFIRMED` do not make an otherwise complete draft `LOCKED`: they produce
`READY_FOR_CONFIRMATION`, so the assistant can read the terms and prepare the Solana deposit
step. They remain hard guards against creating a payment intent until the customer explicitly
confirms the current agreement.

### Gate thresholds for MVP

| Condition              | Threshold | Rationale                                       |
| ---------------------- | --------: | ----------------------------------------------- |
| Completeness           |   `>= 85` | operational details must be mostly complete     |
| Dispute risk           |   `<= 35` | unresolved contradiction must not reach payment |
| Payment readiness      |   `>= 80` | terms must be understood before payment         |
| Explicit confirmation  |    `true` | prevents “payment link first” ambiguity         |
| Critical blocker count |       `0` | payment/proof mismatch requires review          |

Thresholds live in versioned configuration, not hard-coded in UI components.

---

## 10. Reason-code catalog

### Missing data

```text
MISSING_ROUTE
MISSING_DEPARTURE_TIME
MISSING_PASSENGER_COUNT
MISSING_PICKUP_POINT
MISSING_CONTACT
MISSING_PRICE
MISSING_DEPOSIT_AMOUNT
MISSING_REFUND_POLICY
```

### Ambiguity/confirmation

```text
AMBIGUOUS_DEPARTURE_TIME
AMBIGUOUS_CONFIRMATION
PRICE_NOT_CONFIRMED
DEPOSIT_NOT_CONFIRMED
REFUND_POLICY_NOT_CONFIRMED
CUSTOMER_CHANGED_TERMS
```

### Inventory/payment/proof

```text
INVENTORY_UNAVAILABLE
INVENTORY_HOLD_EXPIRED
PAYMENT_TIMEOUT
PAYMENT_AMOUNT_MISMATCH
PAYMENT_RECIPIENT_MISMATCH
PAYMENT_REFERENCE_MISMATCH
PAYMENT_DUPLICATE_DETECTED
AGREEMENT_VERSION_STALE
PROOF_MISMATCH
```

### Operational safety

```text
LOW_TRANSCRIPT_CONFIDENCE
CALL_DROPPED
PROVIDER_WEBHOOK_FAILED
MANUAL_REVIEW_REQUESTED
POLICY_EXCEPTION_REQUESTED
```

Each reason code must include a severity, user-safe message, operator message, evidence references, and recommended next action.

---

## 11. AI extraction contract

AI output is validated before it influences scoring.

```ts
export type AiDecisionProposal = {
  schemaVersion: "v1";
  intent: "BOOK_INTERCITY_TRIP" | "CHANGE_BOOKING" | "CANCEL_BOOKING" | "OTHER";
  extractedFields: Partial<{
    routeFrom: string;
    routeTo: string;
    departureAt: string;
    passengerCount: number;
    pickupPoint: string;
    contact: string;
  }>;
  fieldConfidence: Record<string, number>;
  missingFields: string[];
  contradictions: Array<{
    field: string;
    evidenceSegmentIds: string[];
  }>;
  confirmation: "EXPLICIT" | "AMBIGUOUS" | "NONE";
  proposedSignals: Array<{
    code: string;
    evidenceSegmentIds: string[];
  }>;
  nextAction: string;
  nextQuestion: string;
};
```

### Validation rules

- reject unknown enum values;
- parse dates only with timezone and route context;
- do not treat low-confidence contact extraction as confirmed;
- validate price, availability, and policy only through backend services;
- attach source transcript segment IDs to all AI-derived signals;
- store prompt/model/version metadata for evaluation.

---

## 12. UI behavior

### Customer view

Show only actionable, non-judgmental information:

```text
Đã hiểu: Hà Nội → Sa Pa, 3 khách, 22:30
Còn thiếu: Điểm đón
Trạng thái cọc: Chưa sẵn sàng
Bước tiếp theo: Xác nhận điểm đón
```

### Mentor/operator view

Show score values, reason codes, evidence references, rule version, model version, and gate decision history.

### Never show to customer

- labels such as “high-risk customer”;
- raw internal confidence values;
- hidden anti-abuse rules;
- transcript snippets from another speaker if not appropriate for their view.

---

## 13. Evaluation plan

### Regression suite before training

Create at least 30–80 scripted scenarios and verify:

| Metric                             |               Target for MVP |
| ---------------------------------- | ---------------------------: |
| Required-field extraction accuracy |             tracked by field |
| Incorrect gate unlock rate         | 0 in scripted critical cases |
| Gate lock explanation coverage     |      100% reason-code backed |
| Payment mismatch detection         |          100% scripted cases |
| Agreement-change invalidation      |          100% scripted cases |
| Transcript-to-decision latency     |   target tracked, not hidden |
| Human-handoff trigger correctness  |               reviewed cases |

### Training data eligibility

A record is eligible only when:

```text
training_consent = true
AND PII redaction complete
AND final transaction outcome known
AND label reviewed
AND dataset split assigned by customer/provider/time boundary
```

Do not train from payment completion alone; wait for outcomes such as completed service, cancellation, refund, dispute, or verified incident.

---

## 14. Change control

Every score/policy release must record:

```text
score_config_version
prompt_version
model_version
reason_code_catalog_version
release_timestamp
approver
regression_suite_result
```

A configuration change that materially affects gate unlocking requires staged rollout or feature-flag control and an easy rollback path.
