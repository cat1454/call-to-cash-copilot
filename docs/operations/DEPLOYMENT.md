# Call-to-Cash Risk Copilot — Deployment Guide

> **Audience:** Tech Lead, DevOps owner, hackathon demo operator  
> **Goal:** Promote a tested local flow into a repeatable preview/staging/demo deployment without exposing secrets or weakening payment controls.

## 1. Deployment principle

Deploy the smallest architecture that preserves safety:

```text
Web app
→ Node API + worker
→ Managed PostgreSQL
→ Managed Redis
→ Private S3 bucket
→ Agora cloud services
→ Solana devnet (MVP) / approved production network later
```

The MVP is a modular monolith. Do not split the system into microservices merely because the diagram has multiple boxes.

---

## 2. Environment matrix

| Environment | Primary use | Data | Agora | Solana | Recording |
|---|---|---|---|---|---|
| Local | individual development | synthetic | optional | mock/devnet | MinIO only |
| Preview | pull-request review | synthetic | optional | mock/devnet | off by default |
| Staging | end-to-end rehearsal | controlled demo data | enabled when needed | devnet | private S3 if consent flow tested |
| Demo | live hackathon presentation | synthetic/demo data | enabled | devnet or controlled mock | only if required |
| Production | real customers | consented real data | enabled | approved configuration | private S3 with retention |

### Hard rules

- Never share production database, Redis, S3 bucket, Agora certificate, or Solana keys with preview/demo.
- Never use a production wallet for hackathon payments.
- Never allow unreviewed migrations to run automatically against production.
- Never expose permanent provider credentials to `apps/web`.

---

## 3. Recommended deployment topology

```text
Internet
  ├── apps/web
  │     └── CDN / web host
  └── apps/api
        ├── REST API + SSE endpoint
        ├── background worker / queue consumer
        ├── managed PostgreSQL
        ├── managed Redis
        ├── private S3 bucket
        ├── Agora token/recording/webhook integration
        └── Solana RPC + verification integration
```

### Components

| Component | Deployment requirement |
|---|---|
| `apps/web` | static/SSR compatible host; `NEXT_PUBLIC_*` only for non-secret config |
| `apps/api` | container/node host with environment secrets; supports long-lived SSE connections |
| worker | same codebase, separate process/command recommended for queues and retries |
| PostgreSQL | managed or persistent database with backups and migration access |
| Redis | managed Redis with authentication, TLS where supported, persistence appropriate to queue needs |
| S3 | private bucket, encryption, lifecycle, scoped IAM identity |
| Agora | server-held App Certificate; webhook endpoint verification |
| Solana | RPC endpoint and server-held signing/verification configuration |

---

## 4. Environment configuration

### Server-only variables

```env
DATABASE_URL=
REDIS_URL=
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
SOLANA_RPC_URL=
SOLANA_RECIPIENT_WALLET=
SOLANA_PROOF_SIGNER_KEY=
AI_API_KEY=
AI_MODEL=
```

### Browser-safe variables

```env
NEXT_PUBLIC_API_ORIGIN=
NEXT_PUBLIC_AGORA_APP_ID=
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_FEATURE_LIVE_VOICE=true
```

Do not mark a variable `NEXT_PUBLIC_*` unless it is intended to be visible in browser JavaScript.

### Secret management

- Store values in the deployment provider secret manager, not `.env` files in CI logs.
- Use separate credentials per environment.
- Rotate a credential after any suspected leak.
- Scope S3/IAM permissions to one bucket and needed prefixes.
- Keep Solana signing keys server-side and preferably use a managed secure secret mechanism.

---

## 5. AWS S3 production/staging setup

### Bucket policy requirements

```text
Private bucket
Block public access enabled
Default encryption enabled
Versioning enabled if operationally needed
Lifecycle policies defined before recording is enabled
```

### Suggested object prefixes

```text
raw/{environment}/{yyyy}/{mm}/{dd}/{callSessionId}/{recordingId}
derived/{environment}/{yyyy}/{mm}/{dd}/{callSessionId}/redacted-transcript.json
receipts/{environment}/{bookingId}/{trustReceiptId}.json
```

### Required lifecycle concept

| Prefix | Action |
|---|---|
| `raw/` | expire according to recording consent/retention policy |
| `derived/` | expire/pseudonymize according to evaluation policy |
| `receipts/` | retain according to booking/dispute policy |

### IAM minimum permissions

Grant only required object/bucket actions to the API/recording identity:

```text
ListBucket
GetObject
PutObject
DeleteObject
```

Use a separate least-privilege identity for each environment. Do not use root-account access keys.

---

## 6. CI/CD pipeline

### Pull request pipeline

```text
1. Install with frozen lockfile
2. Typecheck
3. Lint
4. Unit tests
5. Contract/schema tests
6. Prisma schema validation
7. Build web and API
8. Run scripted payment-gate regression suite
9. Build container artifact
10. Deploy preview if enabled
```

### Main/staging pipeline

```text
1. All PR checks
2. Create immutable artifact / image tag
3. Apply reviewed database migration
4. Deploy API and worker
5. Run API health check
6. Deploy web
7. Run synthetic end-to-end smoke test
8. Announce release with version/config identifiers
```

### Production pipeline

Add manual approval between migration review and rollout. Keep rollback artifact available.

---

## 7. Database migration protocol

### Rules

- Additive migrations first: new columns/tables/indexes before code depends on them.
- Avoid destructive changes in the same release as behavior changes.
- Backfill with worker jobs, not blocking application startup.
- Record the Prisma migration version with deployment metadata.
- Test migration timing on a staging-sized data copy when possible.

### Safe rollout example

```text
Release A: add nullable column + write-compatible code
Release B: backfill existing rows
Release C: enforce non-null / remove deprecated path
```

Never run `prisma db push` against production as a release strategy. Use reviewed migrations.

---

## 8. Agora deployment checklist

Before enabling live voice:

```text
[ ] API endpoint can generate short-lived Agora tokens
[ ] Channel names use opaque callSessionId values
[ ] App Certificate remains server-only
[ ] Web origin is permitted by app configuration where applicable
[ ] Webhook signature/secret validation is implemented
[ ] Call lifecycle events are idempotent
[ ] Recording consent gate exists before recording start
[ ] Storage location is reachable by Agora if cloud recording is enabled
[ ] A fallback transcript replay mode remains available for demo
```

---

## 9. Solana deployment checklist

Before enabling payment/proof:

```text
[ ] Cluster is explicit: mock, devnet, or approved production network
[ ] Recipient wallet is environment-specific
[ ] Payment intent contains unique reference and expiry
[ ] Server verifies recipient, amount, asset, reference, and replay status
[ ] Payment confirmation is idempotent
[ ] Proof hash excludes PII and transcript/audio
[ ] Receipt can recompute and verify local snapshot hash
[ ] Failure path opens manual review, never falsely confirms booking
```

### Hackathon recommendation

Use devnet or a fully labeled mock mode. Do not make judges depend on a wallet extension or public RPC reliability without a fallback demo path.

---

## 10. Worker and queue deployment

Run background work separately from request handling when possible:

```text
transcript processing
risk re-evaluation
payment verification retries
proof verification
retention cleanup
webhook retry/dead-letter handling
```

### Requirements

- Jobs must be idempotent.
- Jobs must carry correlation IDs.
- Retry policy must have bounded attempts and exponential delay.
- Permanent failures must create a manual-review task and alert the team.
- Worker deployment version should be observable.

---

## 11. Monitoring and alerting

### Minimum dashboard metrics

```text
API error rate and latency
SSE connection failures
Queue depth and oldest job age
Redis availability
PostgreSQL connection saturation / slow queries
Agora token / webhook errors
Transcript-to-decision latency
Payment intent creation rate
Payment verification success/failure/mismatch rate
Proof MATCH/MISMATCH rate
Manual-review queue size
S3 upload/download error rate
```

### Suggested alerts

| Alert | Severity | Initial action |
|---|---|---|
| payment recipient/reference mismatch spike | Critical | disable new payment intents; investigate |
| proof mismatch | Critical | stop automatic receipt confirmation; manual review |
| payment verification backlog | High | scale/check worker and RPC; preserve pending state |
| DB unavailable | Critical | fail safe; do not create payment intents |
| Agora/webhook failures | High | switch to replay/manual fallback |
| S3 access denied/exposure signal | High/Critical | disable recording; rotate credentials |

---

## 12. Release checklist

### Pre-deploy

```text
[ ] CI green
[ ] Regression suite passes
[ ] Environment variables validated by `packages/config`
[ ] Migration reviewed and backup/rollback plan known
[ ] Feature flags set for target environment
[ ] Demo mode/fallback verified
[ ] S3 lifecycle and bucket access verified
[ ] Solana cluster/recipient explicitly reviewed
[ ] Agora credentials configured only on server
```

### Post-deploy smoke test

```text
[ ] Web opens and reaches API
[ ] API health endpoint returns success
[ ] Create draft with missing field → gate locked
[ ] Complete agreement → gate unlocks
[ ] Create payment intent
[ ] Verify controlled payment/mock transaction
[ ] Receipt verifies MATCH
[ ] Tamper scenario becomes MANUAL_REVIEW_REQUIRED
[ ] Queue/worker consumes jobs
[ ] Logs contain correlation IDs without PII
```

---

## 13. Rollback procedure

### Application rollback

1. Disable risky feature flags first: recording, automatic gate unlock, new model version, payment provider.
2. Route new traffic to the previous healthy API/web artifact.
3. Do not roll back database schema blindly.
4. Continue to verify already-created payment intents using compatible code.
5. Open manual review for any transaction whose state cannot be safely reconciled.

### Migration rollback

Prefer forward-fix migrations. A destructive down migration is a last resort and requires backup/recovery validation.

---

## 14. Hackathon demo release strategy

Use a separate `demo` environment configured as follows:

```text
Synthetic dataset only
Transcript replay enabled by default
Live Agora voice optional
Solana devnet or clearly labeled mock payment mode
No production credentials
Feature flags visible to operator, not customer
Seeded happy-path and edge-case scenarios
```

The demo must still work if wallet, microphone, external AI, or Agora connectivity fails. The fallback is a deterministic replay that uses the exact same state machine, gate logic, agreement, payment intent, proof, and receipt flow.
