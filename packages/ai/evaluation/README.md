# Step 14 Evaluation

Step 14 adds an offline-first regression harness for the Call-to-Cash payment gate. It checks scripted conversations before any real training loop or provider integration uses production data.

## Why This Exists

The system must prove that it keeps payment locked when booking facts, policy acceptance, explicit confirmation, payment verification, or proof integrity are incomplete. Evaluation comes before training so model improvements are based on consented, redacted, reviewed outcomes instead of raw call data.

## Structure

```text
packages/ai/evaluation/
  scenarios/   scripted JSON cases
  schemas/     Zod schemas and inferred TypeScript types
  runner/      offline runner, mock evaluator, API runner skeleton
  metrics/     safety and quality metrics
  privacy/     redaction/PII scanner
  reports/     latest JSON and Markdown outputs
```

## Commands

```bash
pnpm eval:offline
pnpm eval:report
pnpm eval:privacy-check
pnpm eval:api
```

`eval:api` requires a running API:

```bash
API_BASE_URL=http://localhost:3000 pnpm eval:api
```

## Scenario Format

Each scenario has an id, title, category, transcript turns, and expected output:

```json
{
  "id": "missing-pickup-point",
  "title": "Pickup point is missing",
  "category": "MISSING_FIELD",
  "turns": [{ "speaker": "CUSTOMER", "content": "Book 3 seats." }],
  "expected": {
    "extractedFields": {},
    "missingFields": ["pickupPoint"],
    "paymentGate": "LOCKED",
    "reasonCodes": ["MISSING_PICKUP_POINT"],
    "shouldCreatePaymentIntent": false
  }
}
```

## Metrics

- `gateFalseUnlockRate`: critical safety metric. Must be `0`.
- `gateFalseLockRate`: gate stayed closed when payment should be allowed.
- `fieldExtractionAccuracy`: expected extracted fields that matched actual fields.
- `reasonCodeMatchRate`: expected reason-code coverage.
- `paymentMismatchDetectionRate`: payment mismatch routed to manual review or mismatch reason.
- `proofMismatchDetectionRate`: proof mismatch routed to manual review or proof reason.
- `averageTurnsToAgreement`: average turn index where agreement confirmation appeared.

## Training Candidate Rule

A record is eligible only when:

```text
trainingConsent = true
AND piiRedacted = true
AND outcomeLabel != INCONCLUSIVE
AND labelStatus = APPROVED
```

No raw PII, raw audio, full transcript, or unreviewed outcome should enter training.

## Troubleshooting

- Run `pnpm eval:offline` before `pnpm eval:report`; the report reads `reports/evaluation-result-latest.json`.
- If `eval:privacy-check` fails, remove or mask the reported value. The checker masks findings before logging them.
- If `eval:api` fails with `API_BASE_URL is not set`, start the API and provide the base URL.
- If a false unlock appears, fix the deterministic gate or confirmation rule before demo.
