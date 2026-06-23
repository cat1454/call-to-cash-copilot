# Call-to-Cash Risk Copilot — Booking Contract

> **Status:** MVP v1  
> **Vertical:** Catalogue-backed intercity bus / tour booking — demo departures include Hà Nội → Sa Pa and Đà Nẵng → Hà Nội
> **Owner:** Product Lead + Backend Lead  
> **Related docs:** [Pipeline](../architecture/PIPELINE.md), [Decisions](../architecture/DECISIONS.md), [Risk Scoring](./RISK-SCORING.md)

The Booking Contract is the canonical definition of what the system is allowed to sell, confirm, take a deposit for, and prove later. It prevents the product from treating a casual conversation as a valid transaction.

## 1. Product principle

A booking becomes payable only after the system can answer all of these questions reliably:

1. **What is being booked?**
2. **When and where does the service occur?**
3. **For how many people?**
4. **What will the customer pay now and later?**
5. **What cancellation/refund policy applies?**
6. **Has the customer explicitly accepted those terms?**

If any answer is unknown, ambiguous, stale, contradictory, or outside policy, the payment gate remains locked.

---

## 2. Scope of Booking Contract v1

### Supported use case

```text
Customer books seats on an intercity trip:
Hà Nội → Sa Pa
```

### Supported payment action

```text
Deposit to hold a confirmed number of seats.
```

### Explicitly out of scope for v1

- multi-leg trips;
- shared bookings across multiple payers;
- complex loyalty pricing;
- cash-on-delivery reconciliation;
- dynamic seat-map allocation;
- international travel documents;
- automatic refund execution.

The system may collect a request that falls outside scope, but it must route it to manual review rather than invent missing terms.

---

## 3. Canonical entities

```text
Call Session
  → Booking Draft
  → Agreement Snapshot (versioned, immutable)
  → Payment Intent
  → Verified Payment
  → Proof Anchor
  → Trust Receipt
```

| Entity               | Purpose                                         | Mutability                                   |
| -------------------- | ----------------------------------------------- | -------------------------------------------- |
| `call_session`       | Identifies a live/replayed customer interaction | lifecycle updates only                       |
| `booking_draft`      | Current editable operational proposal           | mutable until agreement lock                 |
| `agreement_snapshot` | Customer-confirmed commercial terms             | immutable/versioned                          |
| `payment_intent`     | One payable request bound to one agreement      | status mutable, terms immutable              |
| `payment_attempt`    | A detected user payment transaction             | append-only                                  |
| `trust_receipt`      | Customer-facing proof/result                    | append-only with verification status updates |

---

## 4. Required booking fields

All required fields are validated by backend rules. AI can propose field values but cannot mark them confirmed by itself.

| Field                      | Type                  | Required before payment | Source                  | Validation / rule                                                                          |
| -------------------------- | --------------------- | ----------------------: | ----------------------- | ------------------------------------------------------------------------------------------ |
| `route_from`               | enum/string           |                     Yes | customer + inventory    | supported origin from a scheduled catalogue route; normalized                              |
| `route_to`                 | enum/string           |                     Yes | customer + inventory    | supported destination in the spoken direction from a scheduled catalogue route; normalized |
| `departure_at`             | ISO 8601 datetime     |                     Yes | customer + schedule     | valid slot; future time                                                                    |
| `passenger_count`          | integer               |                     Yes | customer                | integer `1..max_capacity`                                                                  |
| `pickup_point`             | enum/string           |                     Yes | customer + route policy | supported pickup location                                                                  |
| `customer_contact`         | encrypted phone/email |                     Yes | customer                | valid normalized format; display masked                                                    |
| `fare_total_vnd`           | integer               |                     Yes | pricing service         | server-calculated only                                                                     |
| `deposit_amount_vnd`       | integer               |                     Yes | policy service          | server-calculated; `> 0` and `<= fare_total_vnd`                                           |
| `currency`                 | enum                  |                     Yes | system                  | MVP: `VND` display; payment asset configured separately                                    |
| `refund_policy_version`    | string                |                     Yes | policy service          | must exist and be active                                                                   |
| `refund_policy_confirmed`  | boolean               |                     Yes | customer                | must be explicitly accepted                                                                |
| `explicit_confirmation`    | boolean               |                     Yes | customer                | confirmed against current agreement version                                                |
| `inventory_reservation_id` | opaque ID             |                     Yes | inventory service       | active hold, not expired                                                                   |

### Phase 9 deterministic live extraction

The live transcript adapter may propose a route only when the customer says an exact
scheduled catalogue route and an exact future departure. The summary is updated from the
authoritative booking snapshot as soon as that departure is selected; it does not wait for
passenger count. When passenger count arrives in a later customer turn, the server recomputes
`fare_total_vnd` from the selected departure's fare per seat and the new count.

Route, departure date, and departure time may arrive in separate final customer turns. The
server retains the already accepted route while matching a later date/time turn against the
scheduled catalogue; it does not require the customer to repeat every prior field in one sentence.

The deterministic matcher tolerates omitted internal spaces in a catalogue place name (for
example `Sapa` for `Sa Pa`) and accepts ASR's spoken `hour:minute` form (for example
`hai mươi hai:ba mươi phút`). It still requires an exact scheduled route and departure; these
normalizations do not allow a near-match or an inferred inventory choice.

For the current deterministic Vietnamese parser, a contact number may be supplied as a valid
contiguous number or as digit-by-digit speech after `số điện thoại`, `sđt`, or `liên hệ`.
Only a valid normalized number is retained off-chain; all booking and realtime displays remain
masked. These rules only propose draft fields and never confirm a booking or payment.

The digit-by-digit form may contain the filler word `là` and terminal punctuation. For a material
passenger-count change such as `từ ba người thành bốn người`, the replacement count after the
change keyword is authoritative for the new draft; the earlier count remains transcript evidence.

When that required contact label is present, the parser also accepts ASR-concatenated digit words
such as `làkhông` and `mộthai`. It does not infer a phone number from a standalone digit sequence.
For a labelled Vietnamese `chín trăm lẻ ...` contact expression, the parser normalizes the spoken
hundreds group and restores the leading domestic `0` only when the resulting sequence has exactly
nine digits.

For the supported Đà Nẵng terminal pickup, the deterministic matcher accepts the common ASR
substitution `bảy xe trung tâm Đà Nẵng` for `bến xe trung tâm Đà Nẵng`, including when the
preceding prompt phrase is transcribed as `điểm đốn`. Once all operational
fields are valid, the server reserves the existing temporary inventory hold and moves the booking
to `AGREEMENT_READY`; it must still read the terms and obtain explicit confirmation before a
Solana payment intent is created.

For a trusted live Agora final turn, an explicit confirmation such as `tôi xác nhận` after the
booking reaches `AGREEMENT_READY` locks the agreement and triggers the existing Solana payment
intent flow. The same phrase before readiness, or from replay/browser input, cannot create payment.

### Optional fields

| Field             | Why useful              | Rule                                                   |
| ----------------- | ----------------------- | ------------------------------------------------------ |
| `customer_name`   | receipt personalization | do not require for payment if local policy permits     |
| `luggage_count`   | operational preparation | may be collected later                                 |
| `special_notes`   | accessibility/support   | redaction and manual review rules apply                |
| `seat_preference` | UX enhancement          | no guarantee unless inventory supports it              |
| `agent_notes`     | manual operation        | never included in customer agreement or on-chain proof |

---

## 5. Field provenance and confidence

Every extracted field records where it came from and how it became trusted.

```ts
export type FieldProvenance = {
  source: "customer_voice" | "customer_text" | "operator" | "inventory" | "pricing" | "system";
  transcriptSegmentId?: string;
  confidence?: number; // only for AI-derived value
  status: "proposed" | "confirmed" | "corrected" | "invalidated";
  confirmedBy?: "customer" | "operator" | "system";
  confirmedAt?: string;
};
```

### Rule

- A voice-extracted value starts as `proposed`.
- A value becomes `confirmed` only through explicit customer confirmation, an authoritative upstream system, or an audited operator action.
- A material change invalidates confirmation for the whole agreement.

---

## 6. Booking Draft contract

`booking_draft` is the editable working object. It is not yet a sale and cannot be used directly to create payment.

```ts
export type BookingDraftV1 = {
  id: string;
  // Canonical state-machine enum from packages/shared.
  // Do not introduce local status strings such as POLICY_CONFIRMED.
  status: BookingStatus;

  service: {
    vertical: "INTERCITY_BUS";
    routeFrom?: string;
    routeTo?: string;
    departureAt?: string;
    passengerCount?: number;
    pickupPoint?: string;
    inventoryReservationId?: string;
    inventoryHoldExpiresAt?: string;
  };

  customer: {
    contactEncrypted?: string;
    contactMasked?: string;
    name?: string;
  };

  pricing: {
    fareTotalVnd?: number;
    depositAmountVnd?: number;
    currency: "VND";
    refundPolicyVersion?: string;
  };

  confirmations: {
    refundPolicyConfirmed: boolean;
    explicitConfirmation: boolean;
    explicitConfirmationForAgreementVersion?: number;
  };

  provenance: Record<string, FieldProvenance>;
  createdAt: string;
  updatedAt: string;
};
```

---

## 7. Agreement Snapshot contract

An agreement record may be prepared as `DRAFT`/`READY` once terms are renderable. Its commercial terms become immutable only when a customer explicitly confirms and it transitions to `LOCKED`.

```ts
export type AgreementSnapshotV1 = {
  id: string;
  bookingId: string;
  version: number;
  status: "DRAFT" | "READY" | "LOCKED" | "SUPERSEDED" | "EXPIRED";

  service: {
    routeFrom: string;
    routeTo: string;
    departureAt: string;
    passengerCount: number;
    pickupPoint: string;
    inventoryReservationId: string;
    holdExpiresAt: string;
  };

  commercialTerms: {
    fareTotalVnd: number;
    depositAmountVnd: number;
    currency: "VND";
    refundPolicyVersion: string;
    refundPolicySummary: string;
  };

  customerAcknowledgement: {
    contactMasked: string;
    explicitConfirmationAt: string;
    confirmationMethod: "VOICE" | "WEB" | "OPERATOR";
  };

  canonicalizationVersion: "v1";
  canonicalPayload: string;
  sha256Hash: string;
  createdAt: string;
};
```

### Canonicalization rule

Before hashing, serialize a whitelisted payload with stable key ordering and normalized values:

- datetimes in ISO 8601 with timezone;
- amounts as integer minor/display units defined by policy;
- strings trimmed and Unicode-normalized;
- no raw transcript, phone number, name, or internal notes;
- no fields whose values could change after confirmation.

---

## 8. Explicit confirmation policy

### Accepted confirmations

An explicit confirmation is valid only when it clearly accepts the current agreement terms, for example:

```text
"Tôi xác nhận giữ 3 chỗ chuyến 22:30."
"Đúng, tôi đồng ý cọc 300 nghìn theo chính sách vừa đọc."
"Confirm booking."
```

### Not accepted as explicit confirmation

```text
"Ừm."
"Chắc vậy."
"Để xem đã."
"Gửi tôi link trước đi."
"Tôi hiểu rồi."
```

### Confirmation invalidation

Any change to these fields invalidates the existing confirmation and requires a fresh agreement version:

```text
route_from
route_to
departure_at
passenger_count
pickup_point
fare_total_vnd
deposit_amount_vnd
refund_policy_version
```

---

## 9. Inventory and hold rules

### Purpose

The system must not accept money for capacity it cannot reserve.

### Minimum flow

```text
Valid route + time + passenger count
→ check inventory
→ reserve temporary hold
→ create agreement snapshot
→ create payment intent
→ payment confirmation
→ convert hold to confirmed booking
```

### Rules

- A hold has an expiry timestamp.
- A payment intent cannot outlive the hold without renewal/revalidation.
- When a hold expires, its payment intent becomes invalid.
- If payment arrives after expiry, do not automatically confirm the booking; open manual review or refund flow.

---

## 10. Payment Intent contract

A payment intent is the sole source for generating a payment QR/link.

```ts
export type PaymentIntentV1 = {
  id: string;
  bookingId: string;
  agreementSnapshotId: string;
  // Canonical payment-intent state-machine enum from packages/shared.
  // A presented QR/link remains CREATED; a detected candidate payment is PENDING.
  status: PaymentIntentStatus;

  expected: {
    amount: number;
    currency: "VND";
    recipient: string;
    reference: string;
    memoHash?: string;
  };

  expiresAt: string;
  idempotencyKey: string;
  createdAt: string;
};
```

### Non-negotiable validation

Payment verification must check all of:

```text
expected amount
expected asset/currency
expected recipient
expected reference
expected agreement snapshot
unconsumed payment intent
non-expired payment intent
```

A frontend “success” event is never payment confirmation.

---

## 11. Booking lifecycle

```text
DRAFT
→ AGREEMENT_READY
→ AGREEMENT_LOCKED
→ PAYMENT_PENDING
→ PAYMENT_CONFIRMED
→ BOOKING_CONFIRMED
→ RECEIPT_ISSUED
```

### Exceptions

```text
CALL_DROPPED
CUSTOMER_CANCELLED
INVENTORY_UNAVAILABLE
PAYMENT_TIMEOUT
PAYMENT_MISMATCH
MANUAL_REVIEW_REQUIRED
REFUND_REQUESTED
```

### Core transition table

| From                  | To                    | Allowed only when                      |
| --------------------- | --------------------- | -------------------------------------- |
| `FIELDS_PARTIAL`      | `BOOKING_DRAFT_READY` | required operational fields present    |
| `BOOKING_DRAFT_READY` | `AGREEMENT_READY`     | pricing/policy/inventory hold valid    |
| `AGREEMENT_READY`     | `AGREEMENT_LOCKED`    | customer gives explicit confirmation   |
| `AGREEMENT_LOCKED`    | `PAYMENT_PENDING`     | gate passes and payment intent created |
| `PAYMENT_PENDING`     | `PAYMENT_CONFIRMED`   | server verifies transaction            |
| `PAYMENT_CONFIRMED`   | `BOOKING_CONFIRMED`   | inventory hold converted successfully  |
| `BOOKING_CONFIRMED`   | `RECEIPT_ISSUED`      | proof/receipt generation succeeds      |

---

## 12. Customer-facing agreement copy

The canonical hackathon refund policy is:

```text
Policy ID: BUS-V1
Version: 1.0
Cancellation at least 12 hours before departure: refund 80% of the deposit.
Cancellation less than 12 hours before departure: deposit is non-refundable.
```

No UI, fixture, or provider adapter may embed a different unversioned policy.

The customer must hear/see concise terms before payment:

```text
Anh/chị đang giữ 3 chỗ tuyến Hà Nội đi Sa Pa, chuyến 22:30,
đón tại Mỹ Đình. Tổng giá là 1.050.000 đồng, tiền cọc là 300.000 đồng.
Nếu hủy trước 12 giờ, hệ thống hoàn 80% tiền cọc theo chính sách BUS-V1 v1.0.
Anh/chị có xác nhận giữ chỗ và cọc theo các điều khoản này không?
```

The UI must expose a readable detail view and policy version, not only a spoken summary.

---

## 13. Privacy rules

- Display contact information only in masked form outside authorized operations screens.
- Encrypt sensitive contact fields at rest where feasible.
- Do not put contact data, transcript text, or full booking payload into Solana memo/reference.
- Store the minimum data necessary to operate the booking and resolve disputes.
- Audio recording requires separate consent from AI analysis and training use.

---

## 14. Acceptance test matrix

| Scenario                                                | Expected result                                       |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Customer gives complete booking + explicit confirmation | agreement locks; payment gate opens                   |
| Customer gives route but no passenger count             | gate remains locked; AI asks for count                |
| Customer says “send link first”                         | no gate unlock; request explicit confirmation         |
| Price changes after confirmation                        | prior agreement superseded; new confirmation required |
| Inventory hold expires before payment                   | payment intent expires; no booking confirmation       |
| Payment amount is short                                 | manual review; no receipt as confirmed                |
| Payment transaction correct                             | booking confirms; receipt issued                      |
| Agreement payload is tampered after proof               | receipt reports `MISMATCH`; manual review             |

---

## 15. Implementation ownership

| Concern                           | Code location                         |
| --------------------------------- | ------------------------------------- |
| Zod DTOs / enums                  | `packages/shared`                     |
| Prisma models / repositories      | `prisma/schema.prisma`, `packages/db` |
| State transitions / policy guards | `apps/api` + shared domain module     |
| Voice extraction proposal         | `packages/ai`                         |
| Agora transcript mapping          | `packages/agora`                      |
| Payment / proof helpers           | `packages/solana`                     |
| Customer agreement UI             | `apps/web`                            |
