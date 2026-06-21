# Call-to-Cash Risk Copilot - Local Development Setup

> **Status:** Phase 0-9 implementation is executable. Deterministic replay/mock remain the defaults; Solana Devnet and Agora are explicit opt-in providers. Phase 9 is fully implemented and aligned.

## 1. Current local architecture

```text
Browser (apps/web)
  - React/Vite scripted demo
  - explicit demo-mode disclosure
  - server-owned payment request rendering and automatic reference-based verification

Fastify API (apps/api)
  - GET /health
  - GET /ready
  - validated runtime/provider configuration and PostgreSQL readiness
  - authoritative replay call/transcript/risk/booking routes
  - long-lived SSE stream plus Last-Event-ID recovery
  - idempotent deterministic mock payment/proof/receipt flow
  - optional Solana Devnet request and verification provider
  - optional Agora RTC token and Conversation AI Engine orchestration
  - Phase 6: structured Pino JSON logging, CORS, per-IP rate limiting

Web adapter (apps/web/src/lib/)
  - apiClient.js — typed REST client for all Phase 5/7 API endpoints incl. simulatePaymentFailure
  - sseClient.js — SSE stream consumer with Last-Event-ID reconnect
  - useApiMode.js — probes /health; falls back to mock simulation when API offline

Phase 7 web hooks (apps/web/src/features/simulation/hooks/)
  - useServerState.js — useCallSession, useBookingReadModel, useReceiptVerification, usePaymentStatus
  - useServerSimulation.js — API-driven simulation loop; wired into useCallSimulation
  - useCallSimulation.js — branches API/mock based on apiMode

The browser restores only an in-progress demo session after refresh. Completed receipt and manual-review screens clear their browser recovery pointer so a reload starts a fresh presentation; API/database records are not deleted.

PostgreSQL 18 (Docker Compose)
  - durable source of truth on host port 55432
  - reviewed Prisma migration and idempotent demo seed
  - no Redis or object storage in Phase 4

packages/*
  - shared executable contracts and deterministic domain kernel
  - packages/db Prisma client, inventory repository, safe receipt trace projection
  - apps/api orchestration writes through Prisma/domain boundaries
  - packages/solana owns Devnet URL/reference/memo/RPC verification helpers
```

The API is the future authority boundary. The current browser simulation remains non-authoritative and must not be treated as a production transaction system.

## 2. Prerequisites

- Git
- Node.js from `.nvmrc` (currently 22.14.0)
- pnpm from the root `packageManager` field (currently 11.1.1)
- Docker Desktop with Compose

PostgreSQL is the only Phase 4 container. Do not start Redis or MinIO yet.

## 3. Install dependencies

```bash
pnpm install --frozen-lockfile
```

The repository uses one root `pnpm-lock.yaml`. Do not create or commit npm/yarn lockfiles or a local `.pnpm-store/` cache.

### Trusted CA setup

If Node reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` behind an organization proxy, obtain the valid organization/root CA bundle from IT and point Node to it:

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\trusted-organization-roots.pem"
pnpm install --frozen-lockfile
```

Keep `strict-ssl=true`. Never use `NODE_TLS_REJECT_UNAUTHORIZED=0`, `strict-ssl=false`, `--insecure`, or disabled certificate verification as a workaround. Do not commit CA bundles.

## 4. Configure Phase 1 runtime

Copy the committed environment template:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

The repository-root `.env` is the canonical local server configuration. The API entrypoint resolves this file explicitly even though pnpm runs the API package with `apps/api` as its working directory. Do not create or depend on `apps/api/.env`; package-local files are ignored and are not part of the documented startup path. Vite reads browser-safe values from `apps/web/.env.local` when it exists, otherwise `apps/web/.env`; `demo:preflight` uses that same precedence. Copy `apps/web/.env.example` to one of those files and never place server credentials there.

Current variables:

```env
NODE_ENV=development
API_HOST=127.0.0.1
API_PORT=3001
POSTGRES_PORT=55432
DATABASE_URL=postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public

DEMO_MODE=true
PAYMENT_PROVIDER=mock
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_RECIPIENT_PUBLIC_KEY=
SOLANA_DEMO_AMOUNT_LAMPORTS=1000000
SOLANA_PAYMENT_LABEL=Call-to-Cash Demo
VOICE_PROVIDER=replay
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_CUSTOMER_ID=
AGORA_CUSTOMER_SECRET=
AGORA_PROVIDER_EVENT_SECRET=
AGORA_NCS_WEBHOOK_SECRET=
AGORA_NCS_PRODUCT_ID=conversation-ai
AGORA_TOKEN_TTL_SECONDS=600
AGORA_AGENT_UID=9001
AGORA_CAI_AGENT_NAME=call-to-cash-agent
AGORA_API_BASE_URL=https://api.agora.io
AGORA_CAI_PROPERTIES_JSON=
AI_PROVIDER=deterministic

VITE_DEMO_MODE=true
VITE_API_BASE_URL=http://127.0.0.1:3001

For the deployed Danang Toi Uu surfaces, configure the backend with
`WEB_ORIGIN=https://ctc.danangtoiiu.live`, the frontend build with
`VITE_API_BASE_URL=https://ctc-api.danangtoiiu.live`, and configure Agora Notifications with
`https://ctc-api.danangtoiiu.live/v1/webhooks/agora/conversation-ai`.
VITE_VOICE_PROVIDER=replay
```

Only `VITE_*` values may be exposed to the browser. Never put provider certificates, private keys, database URLs, webhook secrets, or LLM keys in a `VITE_*` variable.

Set `PAYMENT_PROVIDER=solana_devnet` only when a public Devnet recipient is configured. Set both `VOICE_PROVIDER=agora` and `VITE_VOICE_PROVIDER=agora` only when the server-only Agora values are configured. Missing/invalid provider configuration leaves process liveness intact but the selected live flow fails closed. No private key is accepted. Redis, object-storage, and LLM variables remain deferred until their first implemented consumer.

## 5. Start PostgreSQL and apply durable state

```bash
docker compose up -d postgres
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:seed
```

The local database uses a dedicated Docker volume and host port `55432`, avoiding a typical developer PostgreSQL service on `5432`. The committed credentials are synthetic local-development values only.

Migration policy:

- use `pnpm db:migrate:dev --name <change>` only against an individual local database;
- use `pnpm db:migrate:deploy` for shared, preview, staging, and production environments;
- never use `prisma db push` as a deployment strategy;
- never edit a migration after it has been deployed outside local development.

The Phase 4 seed is idempotent and creates `usr_provider_demo` plus departure `dep_hn_sapa_20260620_2230` with 36 seats, `BUS-PRICE-V1`, and `BUS-V1/1.0`.

## 6. Run the applications

Run both development processes through Turbo:

```bash
pnpm dev
```

Or run them independently:

```bash
pnpm dev:api
pnpm dev:web
```

After both processes are running, verify the complete local configuration without printing secret values:

```bash
pnpm demo:preflight
```

Current defaults:

```text
Web: http://localhost:5173
API: http://127.0.0.1:3001
```

The development servers are long-running. Stop them with `Ctrl+C`.

## 7. Runtime smoke checks

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/ready
```

`/health` confirms that the Fastify process is alive. `/ready` reports the explicit provider configuration and returns success only when PostgreSQL is reachable and the selected payment provider is configured.

Phase 5 API smoke flow:

```text
POST /v1/calls
POST /v1/calls/:callId/transcript-turns
GET  /v1/calls/:callId/risk
GET  /v1/calls/:callId/events
POST /v1/bookings/:bookingId/confirm
POST /v1/payments/create
POST /v1/payments/verify
POST /v1/payments/mock/create
POST /v1/payments/mock/verify
GET  /v1/receipts/:receiptId
GET  /v1/receipts/:receiptId/verify
```

Booking confirmation and both mock payment commands require `Idempotency-Key`. The normal events endpoint is long-lived; append `?snapshot=true` only for a finite diagnostic/recovery replay.

For an optional real Devnet transaction, follow [SOLANA-DEVNET-SMOKE-TEST.md](./SOLANA-DEVNET-SMOKE-TEST.md). Do not claim a live Devnet result from fixture-backed unit/integration tests.

Open the web URL and verify:

1. A visible demo-mode badge is present.
2. Provider labels say deterministic mock or Solana Devnet demo without claiming mainnet or real settlement.
3. The scripted mobile/desktop demo still completes.
4. Refund copy consistently references policy `BUS-V1` version `1.0`: 80% refund with at least 12 hours notice.

## 8. Verification commands

Run narrow checks while developing, then the full workspace gate:

```bash
pnpm format:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI executes the same commands after a frozen-lockfile install.

Run the real PostgreSQL repository suite explicitly:

```powershell
$env:TEST_DATABASE_URL = $env:DATABASE_URL
pnpm db:generate
pnpm --filter @call-to-cash/db test
pnpm --filter @call-to-cash/api test
```

Run the DB and API PostgreSQL suites sequentially because both reset synthetic test data. Without `TEST_DATABASE_URL`, the root suite skips destructive integration cases while schema generation, type checking, and all non-database tests still run.

Turbo's package-local DB task graph runs `prisma:generate` once before DB build/typecheck/test tasks. Keep generated Prisma files out of source control and do not add independent concurrent generation steps to those compiler tasks.

## 9. Implementation status

Do not expect the following commands or services to work until their pipeline phase is implemented:

| Capability                                                                          |         Planned phase |
| ----------------------------------------------------------------------------------- | --------------------: |
| Web REST/SSE adapter and refresh recovery                                           |    **Phase 6 — done** |
| Mock payment failure outcomes and simulate-failure demo endpoint                    |    **Phase 7 — done** |
| Server read-model hooks and useServerSimulation wiring                              |    **Phase 7 — done** |
| Solana Devnet provider, URL, automatic reference discovery, and server verification |    **Phase 8 — done** |
| Agora adapter and server-to-CAI probe                                               |    **Phase 9 — done** |
| Agora browser microphone, final transcript, and SSE live acceptance                 |    **Phase 9 — done** |
| Optional LLM extraction                                                             |              Phase 10 |
| Redis, MinIO/S3, consent/media workflows                                            |              Phase 11 |

Do not create speculative Redis or object-storage configuration before its consumer phase.

## 10. Common local problems

| Symptom                                   | Likely cause                                       | Fix                                                               |
| ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| pnpm cannot verify npm TLS chain          | organization proxy CA is missing from Node trust   | configure `NODE_EXTRA_CA_CERTS` with the valid CA bundle          |
| API exits during startup                  | invalid port, boolean, or provider value           | compare `.env` with `.env.example`                                |
| PostgreSQL container port is unavailable  | another process uses `55432`                       | set `POSTGRES_PORT` and update `DATABASE_URL` consistently        |
| Prisma cannot connect                     | container is unhealthy or `DATABASE_URL` differs   | run `docker compose ps` and `pnpm db:migrate:status`              |
| PostgreSQL 18 reports an old data path    | Compose volume mounted at the pre-v18 path         | keep the committed mount at `/var/lib/postgresql`                 |
| Web still shows fixture-owned state       | API mode probe failed or VITE_API_BASE_URL not set | check console.warn from useApiMode; verify API is running on 3001 |
| `dist` import is missing during typecheck | package dependency was not built                   | run the root command so Turbo follows `^build` dependencies       |
| UI claims live provider status            | stale browser assets/cache                         | rebuild, unregister stale service worker if needed, and reload    |

## 11. Safety notes

- Keep `PAYMENT_PROVIDER=mock` unless intentionally running the documented Devnet smoke test.
- Treat Devnet as demonstration proof only; never describe it as real VND settlement.
- Do not point placeholder adapters at real credentials.
- Do not disable TLS checks.
- Do not commit `.env`, CA bundles, caches, generated build output, or alternate lockfiles.
- Do not use the local Compose password outside this isolated development stack.
- Do not remove the named PostgreSQL volume unless intentionally resetting synthetic local data.
- The current UI payment/proof flow is a simulation and is not transaction authority.
