# Call-to-Cash Risk Copilot — Incident and Manual Review Runbook

> **Audience:** Tech Lead, demo operator, customer support/operator, backend owner  
> **Principle:** When truth is uncertain, money is not automatically released and the booking is not automatically confirmed.

## 1. Immediate safety rules

1. **Never mark a payment confirmed from a frontend callback alone.**
2. **Never unlock a payment gate because a model asks to.**
3. **Never overwrite a confirmed agreement; create a versioned correction.**
4. **Never place raw transcript/audio/PII into a Solana memo/reference or support ticket screenshot.**
5. **When a payment, proof, inventory, or policy conflict occurs, stop automated confirmation and open manual review.**

---

## 2. Incident severity

| Severity | Definition | Example | Response target |
|---|---|---|---|
| SEV-1 | Money/security/data exposure or systemic false confirmation | wrong recipient accepted, proof mismatch spike, credential leak | immediate containment |
| SEV-2 | Core transaction flow materially degraded | payment verification backlog, DB outage, all calls failing | urgent response |
| SEV-3 | Feature degraded with safe fallback available | Agora transcript outage; replay/manual path works | same working session |
| SEV-4 | Isolated non-critical defect | receipt formatting error | planned fix |

### Roles during an incident

| Role | Responsibility |
|---|---|
| Incident Lead | owns timeline, severity, decisions, communication |
| Backend Owner | investigates API, DB, queue, payment, Solana state |
| Voice/AI Owner | investigates Agora, transcript, AI response, prompts |
| Operator/Support | communicates customer status, opens manual review, collects safe evidence |
| Scribe | records timeline, affected IDs, actions, decisions |

One person can fill multiple roles in a hackathon, but the responsibilities still need to exist.

---

## 3. First 10 minutes: universal response checklist

```text
[ ] Declare severity and assign Incident Lead.
[ ] Capture correlation IDs: callSessionId, bookingId, agreementSnapshotId, paymentIntentId, transaction signature.
[ ] Preserve audit logs and queue state; do not delete evidence.
[ ] Disable the smallest risky feature flag if automated money confirmation may be wrong.
[ ] Confirm whether any customer funds or data are affected.
[ ] Move affected bookings to MANUAL_REVIEW_REQUIRED when truth is uncertain.
[ ] Communicate customer-safe status: “We are verifying your booking/payment.”
[ ] Record every operator action in audit log.
```

### Safe feature flags to disable first

```text
FEATURE_PAYMENT_GATE=false
FEATURE_AUTO_PAYMENT_CONFIRMATION=false
FEATURE_CLOUD_RECORDING=false
FEATURE_LIVE_VOICE=false
AI_MODEL_VERSION=previous-safe-version
```

Disabling a feature must not erase existing booking/payment evidence.

---

## 4. Manual review workflow

### When to open manual review

```text
PAYMENT_AMOUNT_MISMATCH
PAYMENT_RECIPIENT_MISMATCH
PAYMENT_REFERENCE_MISMATCH
PAYMENT_DUPLICATE_DETECTED
AGREEMENT_VERSION_STALE
PROOF_MISMATCH
INVENTORY_HOLD_EXPIRED_AFTER_PAYMENT
CALL_DROPPED_DURING_CONFIRMATION
LOW_TRANSCRIPT_CONFIDENCE on a material term
POLICY_EXCEPTION_REQUESTED
```

### Manual review record must contain

```text
review_id
severity
booking_id
call_session_id
agreement_snapshot_id + version
payment_intent_id
transaction_signature (if present)
reason_codes
audit event timeline
operator decision
customer communication status
resolution timestamp
```

### Allowed manual-review resolutions

```text
CONFIRM_BOOKING
REJECT_PAYMENT
REQUEST_CUSTOMER_CONFIRMATION
RECREATE_AGREEMENT
RECREATE_PAYMENT_INTENT
REFUND_OR_ESCALATE_REFUND
CANCEL_BOOKING
CLOSE_NO_ACTION
```

### Operator rule

An operator must not “just change the booking” after payment. They must create a corrected agreement version, explain the change, and obtain fresh confirmation when commercial terms changed.

---

## 5. Payment incidents

## 5.1 Payment amount mismatch

### Trigger

A transaction is detected but amount is different from `payment_intent.expected.amount`.

### Immediate actions

```text
1. Set payment intent to MANUAL_REVIEW_REQUIRED.
2. Do not confirm booking or issue confirmed receipt.
3. Persist observed transaction details and mismatch reason.
4. Verify whether amount is lower, higher, or asset-decimal mismatch.
5. Contact customer with verification status; do not ask them to pay twice yet.
```

### Resolution paths

| Situation | Resolution |
|---|---|
| amount lower than required | request balance payment only if policy permits; otherwise create new intent/review |
| amount higher than required | preserve evidence; initiate approved refund/support path |
| wrong decimals/token | reject as unmatched; do not treat as deposit |
| matching transaction appears later | attach only if it matches unconsumed payment intent |

---

## 5.2 Wrong recipient or reference

### Trigger

Recipient wallet/reference does not match payment intent.

### Severity

`SEV-1` if systemic or if system generated the wrong recipient; otherwise `SEV-2`/manual review.

### Immediate actions

```text
1. Disable new payment intent generation if recipient configuration may be wrong.
2. Preserve the intent, QR/link payload, transaction details, and deployment version.
3. Check environment configuration, feature flags, and recent deploys.
4. Do not mark the booking paid.
5. Rotate/repair configuration before reopening payment flow.
```

### Customer-safe message

```text
Chúng tôi chưa thể xác nhận khoản cọc này vì thông tin thanh toán không khớp.
Đặt chỗ của anh/chị đang được kiểm tra; vui lòng chưa thanh toán thêm cho đến khi nhận hướng dẫn mới.
```

---

## 5.3 Duplicate payment

### Trigger

Two or more transactions reference one payment intent, or a prior transaction signature is reused.

### Actions

```text
1. Mark first valid matching transaction as candidate confirmation.
2. Mark additional transactions as duplicate candidates.
3. Do not create multiple bookings.
4. Open manual review/refund workflow for duplicate amount.
5. Check idempotency key, database uniqueness constraint, and Redis lock history.
```

### Required database guards

```text
unique(payment_intent_id, verified_transaction_signature)
unique(payment_intent_id) where status = CONFIRMED
unique(reference)
```

---

## 5.4 Payment pending or verification backlog

### Trigger

Payment shows on customer wallet but API has not confirmed it within target time.

### Actions

```text
1. Keep booking in PAYMENT_PENDING; do not expire immediately if valid transaction may be in flight.
2. Check queue age, worker health, RPC availability, and webhook/reconciliation logs.
3. Retry idempotent verification with bounded backoff.
4. Show “Đang xác nhận” rather than “Thất bại” until timeout/review policy applies.
5. Escalate if backlog affects multiple intents.
```

---

## 6. Agreement and proof incidents

## 6.1 Proof mismatch

### Trigger

The SHA-256 hash recomputed from the stored agreement snapshot does not match the transaction-linked/anchored proof.

### Severity

`SEV-1` until root cause is understood.

### Immediate actions

```text
1. Disable automatic Trust Receipt confirmation.
2. Set affected receipt/booking to MANUAL_REVIEW_REQUIRED.
3. Preserve canonical payload, hash inputs, algorithm version, agreement version, and transaction evidence.
4. Compare deployment/config versions and recent canonicalization changes.
5. Check for unauthorized database mutation or serialization bug.
6. Do not edit evidence in place.
```

### Common causes

```text
Different canonicalization version
Timezone/number formatting drift
Agreement was changed without versioning
Incorrect hash attached to payment intent
Wrong environment/recipient/reference
Unauthorized or buggy data mutation
```

### Resolution

Only issue a new proof after a documented, versioned agreement and valid payment reconciliation. Never “force MATCH” manually.

---

## 6.2 Stale agreement version

### Trigger

Payment refers to agreement v1 while booking has changed to v2.

### Actions

```text
1. Block automatic confirmation.
2. Determine whether v1 payment occurred before or after v2 creation.
3. If v1 was valid at payment time, resolve booking terms manually according to policy.
4. If terms changed before payment, create/reconcile a correct intent; do not apply money blindly to v2.
5. Document the customer communication and final agreement version.
```

---

## 7. Voice, transcript, and AI incidents

## 7.1 Agora call or transcript outage

### Trigger

Customers cannot join calls, audio fails, transcript events stop, or token creation fails.

### Severity

Usually `SEV-3`; `SEV-2` if it blocks the entire booking channel.

### Actions

```text
1. Check API health, token endpoint, channel/UID mapping, client browser permissions, and Agora status/configuration.
2. Disable live voice only if necessary; do not disable booking/replay flow.
3. Offer transcript replay, text intake, or operator handoff as fallback.
4. Preserve call lifecycle events without raw audio where recording failed.
5. Do not infer missing fields from partial or low-confidence transcript.
```

---

## 7.2 Low transcript confidence on material field

### Trigger

The system is unsure about date/time, passenger count, contact, price, or confirmation.

### Actions

```text
1. Do not auto-fill as confirmed.
2. Ask one clear clarification question.
3. Show/voice back the interpreted value.
4. If still uncertain, route to text confirmation or human operator.
5. Log LOW_TRANSCRIPT_CONFIDENCE with field and evidence segment IDs.
```

---

## 7.3 Unsafe or malformed AI output

### Trigger

The AI returns invalid JSON, an unknown action, a tool invocation outside allow-list, or instruction to bypass payment policy.

### Actions

```text
1. Reject output at schema validation boundary.
2. Do not persist a transition or run a tool.
3. Fall back to a safe generic question or manual review.
4. Capture sanitized prompt/model/version/request ID for debugging.
5. Roll back model/prompt feature flag if repeated.
```

### Never do

```text
Do not parse free-form model prose as a payment decision.
Do not pass raw transcript text into shell/SQL/tool commands.
Do not let model output choose recipient wallet or payment amount.
```

---

## 8. Database, Redis, and storage incidents

## 8.1 PostgreSQL unavailable or degraded

### Actions

```text
1. Stop creating new payment intents and agreement locks.
2. Keep UI in safe read-only/degraded status if possible.
3. Check connection pool, provider health, slow queries, migration status, storage capacity.
4. Do not rely on Redis as a substitute source of truth.
5. Restore service, then reconcile queued idempotent jobs.
```

## 8.2 Redis unavailable or queue backlog

### Actions

```text
1. Preserve API correctness using PostgreSQL; degrade realtime features if needed.
2. Stop/reduce non-essential background jobs.
3. Inspect worker availability, queue depth, oldest job age, and lock expiration.
4. Retry idempotently after recovery.
5. Move aged payment verification jobs to manual review before their policy timeout.
```

## 8.3 S3/MinIO upload failure or suspected exposure

### Actions

```text
1. Disable recording and presigned URL issuance if access policy may be wrong.
2. Check bucket policy, IAM identity, object prefix, encryption, and endpoint configuration.
3. Do not retry by making bucket public.
4. Rotate credentials if exposure is possible.
5. Identify affected objects and follow data-incident process.
```

---

## 9. Credential leak / security event

### Possible indicators

```text
Secret committed to Git
Unexpected S3 access
Agora token generation abuse
Unknown Solana signing activity
Unusual API calls using leaked key
```

### Actions

```text
1. Revoke/rotate affected credential immediately.
2. Disable dependent feature if rotation is not instantaneous.
3. Review access logs and deployment history.
4. Invalidate active sessions/tokens only as necessary.
5. Open SEV-1 if customer data or funds may be affected.
6. Remove secret from source history according to repository security process; rotation is more important than history cleanup.
```

---

## 10. Customer communication templates

### Payment pending

```text
Khoản cọc của anh/chị đang được hệ thống xác nhận. Đặt chỗ chưa bị hủy;
chúng tôi sẽ cập nhật trạng thái ngay khi kiểm tra xong. Vui lòng chưa thanh toán thêm.
```

### Terms need reconfirmation

```text
Thông tin đặt chỗ đã thay đổi nên chúng tôi cần anh/chị xác nhận lại các điều khoản mới
trước khi tiếp tục thanh toán. Khoản cọc sẽ không được tự động áp dụng cho điều khoản mới.
```

### Manual review

```text
Chúng tôi cần kiểm tra thêm để đảm bảo thông tin đặt chỗ và khoản cọc khớp chính xác.
Yêu cầu của anh/chị đã được chuyển đến bộ phận hỗ trợ; chúng tôi sẽ không tự động xác nhận sai thông tin.
```

Avoid blaming the customer, naming internal providers, or claiming legal conclusions.

---

## 11. Required evidence checklist

For any payment/proof incident, preserve:

```text
correlation_id
call_session_id
booking_id
agreement_snapshot_id + version
payment_intent_id
payment reference
transaction signature
expected vs observed payment fields
proof hash + canonicalization version
audit event timeline
app/worker deployment version
rule config version
model/prompt version if AI contributed
```

Do not paste unredacted transcript/audio into chat channels. Link to authorized storage records instead.

---

## 12. Closure and post-incident review

Close an incident only when:

```text
[ ] affected bookings have a known final status
[ ] customer communication is complete where needed
[ ] payment/proof evidence is reconciled
[ ] risky automation is restored only after validation
[ ] root cause and corrective action are documented
[ ] regression scenario is added to the test suite
```

### Postmortem template

```text
Incident title:
Severity:
Start / end time:
Customer impact:
Financial impact:
Detection method:
Timeline:
Root cause:
Why safeguards did/did not work:
Immediate remediation:
Long-term remediation:
New test scenario:
Owner and due date:
```

