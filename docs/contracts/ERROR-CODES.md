# Call-to-Cash Risk Copilot — Error Codes

> **Status:** MVP technical contract v1  
> **Owner:** Backend Lead  
> **Related docs:** [API Contract](./API-CONTRACT.md), [Event Contract](./EVENT-CONTRACT.md), [State Machines](../architecture/STATE-MACHINES.md), [Incident Runbook](../operations/INCIDENT-RUNBOOK.md)

Error codes are a product and integration contract. They let the web app display a safe next action, let operators diagnose failure, and let retries be deterministic. Do not branch client logic on English error messages.

---

## 1. Standard error shape

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATE_LOCKED",
    "message": "Payment cannot be created because confirmation is incomplete.",
    "details": {
      "missingFields": ["refundPolicyConfirmation"]
    },
    "requestId": "req_01J...",
    "retryable": false
  }
}
```

### Rules

- `code` is stable, uppercase snake case.
- `message` is customer-safe and non-sensitive.
- `details` is optional and must be redacted/authorization-aware.
- `requestId` is always present for support/debugging.
- `retryable` means automatic retry may be attempted by a trusted client/worker; it does not mean user should repeatedly press a button.

---

## 2. HTTP status mapping

| HTTP | When to use |
|---|---|
| `400` | malformed command or impossible request shape |
| `401` | no/invalid authentication |
| `403` | authenticated but not permitted |
| `404` | requested public resource does not exist or is not visible |
| `409` | valid request conflicts with current state/idempotency/version |
| `410` | expired payment intent or invalidated resource |
| `422` | valid JSON but domain/policy validation fails |
| `429` | rate limit / abusive retry |
| `500` | unexpected server error, no safe public diagnosis |
| `502` | upstream provider failed unexpectedly |
| `503` | service unavailable / maintenance / dependency outage |
| `504` | upstream/provider timeout |

---

## 3. Validation and request errors

| Code | HTTP | Retry? | Customer-safe meaning |
|---|---:|---:|---|
| `VALIDATION_ERROR` | 400 | No | Some submitted fields are invalid. |
| `UNSUPPORTED_MEDIA_TYPE` | 400 | No | The request format is not supported. |
| `INVALID_IDEMPOTENCY_KEY` | 400 | No | The safety key is invalid. |
| `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` | 409 | No | The same request key was used for a different action. |
| `REQUEST_TOO_LARGE` | 413 | No | The submitted content is too large. |
| `RATE_LIMITED` | 429 | Yes, after delay | Too many requests; try again later. |

---

## 4. Authentication and authorization errors

| Code | HTTP | Retry? | Customer-safe meaning |
|---|---:|---:|---|
| `AUTH_REQUIRED` | 401 | No | Sign in is required. |
| `AUTH_INVALID_TOKEN` | 401 | No | Your session is no longer valid. |
| `AUTH_FORBIDDEN` | 403 | No | You do not have permission for this action. |
| `RESOURCE_NOT_FOUND` | 404 | No | The requested item was not found. |
| `RECEIPT_ACCESS_DENIED` | 403 | No | You cannot view this receipt. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | No | Provider event was rejected. |

---

## 5. Call, Agora, and transcript errors

| Code | HTTP | Retry? | System action |
|---|---:|---:|---|
| `CALL_NOT_FOUND` | 404 | No | show safe “call not found” UI |
| `CALL_NOT_ACTIVE` | 409 | No | do not accept live transcript into closed call |
| `CALL_ALREADY_ENDED` | 409 | No | return idempotent end result where possible |
| `AGORA_TOKEN_ISSUE_FAILED` | 502 | Yes | retry server-side; do not log secret/token |
| `AGORA_CHANNEL_UNAVAILABLE` | 503 | Yes | preserve existing state; offer retry/rejoin |
| `TRANSCRIPT_TURN_DUPLICATE` | 409 | No | return existing turn/idempotent result |
| `TRANSCRIPT_SEQUENCE_CONFLICT` | 409 | No | fetch current transcript and reconcile |
| `TRANSCRIPT_NOT_FINAL` | 422 | No | cannot drive irreversible analysis from interim text |
| `TRANSCRIPT_CONSENT_REQUIRED` | 422 | No | collect required analysis consent |
| `STT_CONFIDENCE_TOO_LOW` | 422 | No | ask customer to repeat/confirm; do not infer data |

---

## 6. Risk, policy, and booking errors

| Code | HTTP | Retry? | Meaning / next action |
|---|---:|---:|---|
| `RISK_ASSESSMENT_NOT_READY` | 409 | Yes | wait for final turn analysis or use replay retry |
| `PAYMENT_GATE_LOCKED` | 422 | No | ask for missing field or resolve blocker |
| `PAYMENT_GATE_MANUAL_REVIEW` | 422 | No | operator review required |
| `BOOKING_NOT_FOUND` | 404 | No | booking unavailable |
| `BOOKING_STATE_CONFLICT` | 409 | No | reload latest state |
| `BOOKING_REQUIRED_FIELD_MISSING` | 422 | No | collect/confirm required field |
| `BOOKING_FIELD_CONTRADICTION` | 422 | No | clarify conflicting value |
| `INVENTORY_HOLD_EXPIRED` | 410 | No | create/update booking and obtain new hold |
| `INVENTORY_UNAVAILABLE` | 422 | No | recommend alternate option / operator support |
| `PRICE_UNAVAILABLE` | 422 | No | do not create agreement/payment |
| `REFUND_POLICY_UNAVAILABLE` | 422 | No | do not create agreement/payment |
| `AGREEMENT_NOT_FOUND` | 404 | No | reload booking flow |
| `AGREEMENT_NOT_READY` | 409 | No | render/complete terms first |
| `AGREEMENT_VERSION_CONFLICT` | 409 | No | fetch latest agreement; reconfirm |
| `AGREEMENT_STALE` | 410 | No | old terms cannot be paid; reconfirm new version |
| `EXPLICIT_CONFIRMATION_REQUIRED` | 422 | No | ask clear yes/no confirmation |

---

## 7. Payment and Solana errors

| Code | HTTP | Retry? | Meaning / next action |
|---|---:|---:|---|
| `PAYMENT_INTENT_NOT_FOUND` | 404 | No | payment request unavailable |
| `PAYMENT_INTENT_ALREADY_EXISTS` | 409 | No | return/reuse current active intent |
| `PAYMENT_INTENT_EXPIRED` | 410 | No | create a new intent only after current booking terms are valid |
| `PAYMENT_INTENT_CANCELLED` | 409 | No | agreement changed or booking cancelled |
| `PAYMENT_VERIFICATION_PENDING` | 202 | Yes | show “đang xác nhận” state |
| `PAYMENT_TRANSACTION_NOT_FOUND` | 404 | Yes | chain data may not be available yet |
| `PAYMENT_TRANSACTION_FAILED` | 422 | No | chain execution failed; do not create proof or receipt |
| `PAYMENT_TRANSACTION_REUSED` | 409 | No | signature already belongs to another intent |
| `PAYMENT_AMOUNT_MISMATCH` | 422 | No | manual review; never auto-confirm |
| `PAYMENT_RECIPIENT_MISMATCH` | 422 | No | manual review/security escalation |
| `PAYMENT_TOKEN_MISMATCH` | 422 | No | manual review; wrong asset |
| `PAYMENT_REFERENCE_MISMATCH` | 422 | No | reject for this booking; investigate if needed |
| `PAYMENT_CLUSTER_MISMATCH` | 422 | No | devnet/mainnet mismatch |
| `PAYMENT_TRANSACTION_UNCONFIRMED` | 202 | Yes | poll/retry verification safely |
| `PAYMENT_VERIFICATION_FAILED` | 502 | Yes | dependency failure; do not mark payment failed until definitive |
| `SOLANA_RPC_UNAVAILABLE` | 503 | Yes | queue verification retry |
| `SOLANA_RPC_TIMEOUT` | 504 | Yes | queue verification retry |

---

## 8. Proof and receipt errors

| Code | HTTP | Retry? | Meaning / next action |
|---|---:|---:|---|
| `PROOF_NOT_READY` | 409 | Yes | payment/proof processing has not completed |
| `PROOF_ANCHOR_UNAVAILABLE` | 503 | Yes | retry verification; do not claim match |
| `PROOF_MISMATCH` | 422 | No | manual review required |
| `RECEIPT_NOT_FOUND` | 404 | No | receipt not issued or unavailable |
| `RECEIPT_NOT_READY` | 409 | Yes | payment/proof pending |
| `RECEIPT_ALREADY_ISSUED` | 409 | No | return existing receipt idempotently |
| `RECEIPT_MANUAL_REVIEW_REQUIRED` | 422 | No | display support route |

---

## 9. Storage, privacy, and system errors

| Code | HTTP | Retry? | Meaning / next action |
|---|---:|---:|---|
| `CONSENT_REQUIRED` | 422 | No | collect specific consent before action |
| `TRAINING_CONSENT_REQUIRED` | 422 | No | record cannot enter training candidate set |
| `AUDIO_RECORDING_NOT_ALLOWED` | 403 | No | recording disabled / not consented |
| `OBJECT_STORAGE_UNAVAILABLE` | 503 | Yes | keep metadata; queue retry; do not expose raw asset |
| `DATABASE_UNAVAILABLE` | 503 | Yes | fail closed for mutations/payment |
| `REDIS_UNAVAILABLE` | 503 | Yes | no realtime processing; read-only recovery allowed if DB healthy |
| `UPSTREAM_TIMEOUT` | 504 | Yes | retry based on idempotency policy |
| `INTERNAL_ERROR` | 500 | Maybe | generic safe error; inspect requestId |

---

## 10. Frontend behavior mapping

| Error class | UI behavior |
|---|---|
| validation / missing field | focus exact missing field / ask one clarifying question |
| conflict / stale agreement | refresh current booking and explain that terms changed |
| gate locked | show reason and next best action; no payment CTA |
| payment pending | show non-final waiting state; subscribe/poll |
| definitive payment mismatch | stop auto flow; show manual review/support route |
| temporary infrastructure | preserve input; offer retry; never invent success |
| access/privacy | show generic permission message; do not leak resource existence/details |

---

## 11. Error code acceptance rules

- [ ] errors are defined in `@call-to-cash/shared` as a finite union/constant map;
- [ ] every error has HTTP status, retry behavior, and customer-safe message;
- [ ] API never returns raw provider errors, secrets, stack traces, wallet private data, or raw transcript in `details`;
- [ ] non-terminal dependency failure is not mislabeled as payment rejection;
- [ ] incident runbook references the same codes for operational response.
