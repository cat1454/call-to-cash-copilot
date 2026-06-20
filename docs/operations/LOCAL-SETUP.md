# Call-to-Cash Risk Copilot - Local Development Setup

> **Status:** Phase 0-4 workspace, contracts, domain kernel, PostgreSQL, Prisma migrations, inventory repositories, and deterministic seed are executable. Redis, MinIO, business APIs/SSE, Solana, Agora, and LLM integrations remain later phases.

## 1. Current local architecture

```text
Browser (apps/web)
  - React/Vite scripted demo
  - explicit demo-mode disclosure
  - browser-side simulated booking/payment/proof flow

Fastify API (apps/api)
  - GET /health
  - GET /ready
  - validated runtime/provider configuration
  - no business routes, persistence, or SSE stream yet

PostgreSQL 18 (Docker Compose)
  - durable source of truth on host port 55432
  - reviewed Prisma migration and idempotent demo seed
  - no Redis or object storage in Phase 4

packages/*
  - shared executable contracts and deterministic domain kernel
  - packages/db Prisma client, inventory repository, safe receipt trace projection
  - provider packages remain scaffolds
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

Current variables:

```env
NODE_ENV=development
API_HOST=127.0.0.1
API_PORT=3001
POSTGRES_PORT=55432
DATABASE_URL=postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public

DEMO_MODE=true
PAYMENT_PROVIDER=mock
VOICE_PROVIDER=replay
AI_PROVIDER=deterministic

VITE_DEMO_MODE=true
VITE_API_BASE_URL=http://localhost:3001
```

Only `VITE_*` values may be exposed to the browser. Never put provider certificates, private keys, database URLs, webhook secrets, or LLM keys in a `VITE_*` variable.

Redis, object-storage, Agora, Solana, and LLM variables must be introduced only with their first implemented consumer and corresponding documentation/tests.

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

`/health` confirms that the Fastify process is alive. `/ready` reports the explicit demo/provider configuration. Neither endpoint implies that database or external providers are connected.

Open the web URL and verify:

1. A visible demo-mode badge is present.
2. Provider labels say replay/mock/deterministic instead of claiming live Agora or Solana.
3. The scripted mobile/desktop demo still completes.
4. Refund copy consistently references policy `BUS-V1` version `1.0`: 80% refund with at least 12 hours notice.

## 8. Verification commands

Run narrow checks while developing, then the full Phase 1 gate:

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
pnpm --filter @call-to-cash/db test
```

Without `TEST_DATABASE_URL`, the root suite skips the four destructive integration cases while schema generation, type checking, and all non-database tests still run.

## 9. Not implemented yet

Do not expect the following commands or services to work until their pipeline phase is implemented:

| Capability | Planned phase |
|---|---:|
| Shared Zod/API/event/error contracts | Phase 2 |
| Deterministic risk, gate, state transitions, agreement hash | Phase 3 |
| Replay business API and SSE | Phase 5 |
| Web REST/SSE adapter and refresh recovery | Phase 6 |
| Durable mock payment/proof/receipt vertical slice | Phase 7 |
| Solana devnet | Phase 8 |
| Agora live voice/transcript | Phase 9 |
| Optional LLM extraction | Phase 10 |
| Redis, MinIO/S3, consent/media workflows | Phase 11 |

Do not create speculative Redis or object-storage configuration before its consumer phase.

## 10. Common local problems

| Symptom | Likely cause | Fix |
|---|---|---|
| pnpm cannot verify npm TLS chain | organization proxy CA is missing from Node trust | configure `NODE_EXTRA_CA_CERTS` with the valid CA bundle |
| API exits during startup | invalid port, boolean, or provider value | compare `.env` with `.env.example` |
| PostgreSQL container port is unavailable | another process uses `55432` | set `POSTGRES_PORT` and update `DATABASE_URL` consistently |
| Prisma cannot connect | container is unhealthy or `DATABASE_URL` differs | run `docker compose ps` and `pnpm db:migrate:status` |
| PostgreSQL 18 reports an old data path | Compose volume mounted at the pre-v18 path | keep the committed mount at `/var/lib/postgresql` |
| Web cannot reach future API routes | business API is not implemented yet | use the scripted UI until Phase 5-6 |
| `dist` import is missing during typecheck | package dependency was not built | run the root command so Turbo follows `^build` dependencies |
| UI claims live provider status | stale browser assets/cache | rebuild, unregister stale service worker if needed, and reload |

## 11. Safety notes

- Keep `DEMO_MODE=true` with mock/replay/deterministic providers during Phase 1.
- Do not point placeholder adapters at real credentials.
- Do not disable TLS checks.
- Do not commit `.env`, CA bundles, caches, generated build output, or alternate lockfiles.
- Do not use the local Compose password outside this isolated development stack.
- Do not remove the named PostgreSQL volume unless intentionally resetting synthetic local data.
- The current UI payment/proof flow is a simulation and is not transaction authority.
