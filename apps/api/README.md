# API application boundary

This directory contains the Fastify/TypeScript composition root for Call-to-Cash.

**Phase 6** adds to the Phase 5 foundation:

- Structured Pino JSON logging (level configurable via `LOG_LEVEL`)
- CORS via `@fastify/cors` — allows Vite dev origin in non-production
- Per-IP rate limiting via `@fastify/rate-limit` (configurable via `RATE_LIMIT_MAX`)
- Dev-only `candidateDepositAmountMinor` tamper query guard (403 outside demo mode)
- Web REST/SSE adapter layer in `apps/web/src/lib/` for frontend API integration

Business rules belong in `@call-to-cash/domain`, durable access belongs in `@call-to-cash/db`, and provider integrations remain adapters. The API must never treat browser state or provider callbacks as transaction authority.

## Phase 6 Demo Runbook

### Quick start

```bash
# 1. Start PostgreSQL
docker compose up -d postgres
pnpm db:migrate:deploy
pnpm db:seed

# 2. Run API + Web together
pnpm dev

# 3. Smoke check
curl http://127.0.0.1:3001/health   # → { "data": { "status": "ok" } }
curl http://127.0.0.1:3001/ready    # → providers: mock/replay/deterministic
```

### Phase 5 API flow (happy path)

```bash
# Create call session
curl -s -X POST http://127.0.0.1:3001/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"channelPurpose":"BOOKING","sourceMode":"TRANSCRIPT_REPLAY"}'

# Submit transcript turn (replace CALL_ID)
curl -s -X POST http://127.0.0.1:3001/v1/calls/CALL_ID/transcript-turns \
  -H "Content-Type: application/json" \
  -d '{"turn":{"clientTurnId":"t001","sequenceNo":1,"speaker":"CUSTOMER","content":"Tôi muốn đặt 3 vé Hà Nội đi Sa Pa chuyến 22:30, đón ở Mỹ Đình, số 0912345678.","language":"vi-VN","isFinal":true,"source":"REPLAY"}}'

# Check risk
curl -s http://127.0.0.1:3001/v1/calls/CALL_ID/risk

# Confirm booking (replace BOOKING_ID)
curl -s -X POST http://127.0.0.1:3001/v1/bookings/BOOKING_ID/confirm \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: confirm-$(date +%s)" \
  -d '{"agreementVersion":1,"confirmation":{"method":"VOICE","text":"Tôi xác nhận giữ chỗ và đồng ý cọc"}}'

# Create mock payment
curl -s -X POST http://127.0.0.1:3001/v1/payments/mock/create \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment-$(date +%s)" \
  -d '{"bookingId":"BOOKING_ID"}'

# Verify mock payment (replace PAYMENT_INTENT_ID, REFERENCE, AMOUNT from above)
curl -s -X POST http://127.0.0.1:3001/v1/payments/mock/verify \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: verify-$(date +%s)" \
  -d '{"paymentIntentId":"PAYMENT_INTENT_ID","observedAmount":{"currency":"VND","minor":300000},"observedRecipient":"mock-recipient-wallet","observedReference":"REFERENCE"}'

# Get receipt (replace RECEIPT_ID from verify response)
curl -s http://127.0.0.1:3001/v1/receipts/RECEIPT_ID

# Tamper demo (DEMO_MODE=true only)
curl -s "http://127.0.0.1:3001/v1/receipts/RECEIPT_ID/verify?candidateDepositAmountMinor=1"
```

### Dev-only guards

- `GET /v1/receipts/:id/verify?candidateDepositAmountMinor=N` — blocked (403) when `DEMO_MODE=false`
- Rate limiting applies globally; set `RATE_LIMIT_MAX=0` in `.env` to disable during integration tests

The normal call-events endpoint is a long-lived SSE stream. `?snapshot=true` is reserved for finite diagnostic and recovery reads. The web REST/SSE adapter and opt-in Solana Devnet provider are implemented. Agora live voice, optional LLM extraction, and authentication remain later phases.
