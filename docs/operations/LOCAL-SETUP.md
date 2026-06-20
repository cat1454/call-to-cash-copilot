# Call-to-Cash Risk Copilot — Local Development Setup

> **Audience:** Developers joining the monorepo  
> **Goal:** Run the full local MVP: web, API, PostgreSQL, Redis, MinIO, mock/Devnet Solana flow, and optional Agora integration.

## 1. Local architecture

```text
Browser (apps/web)
  ↓ REST commands / SSE updates
Node API (apps/api)
  ├── PostgreSQL        durable booking/payment/receipt truth
  ├── Redis             realtime buffers, queues, locks
  ├── MinIO             local S3-compatible audio/evidence storage
  ├── Agora             optional real voice/transcript integration
  └── Solana devnet     payment/proof verification, optional mock fallback
```

`apps/api` is the only local service allowed to own booking/payment state. `packages/*` are shared modules loaded by the apps.

---

## 2. Prerequisites

Install these before starting:

```text
Git
Node.js version specified by the repository (.nvmrc / package.json engines)
pnpm version specified by package.json packageManager field
Docker Desktop with Linux containers enabled
Docker Compose v2
```

Optional for full integration testing:

```text
Solana CLI + a devnet wallet
Agora App ID / App Certificate
AWS credentials for a non-production S3 bucket
```

### Windows notes

- Prefer cloning the repo inside the WSL filesystem for faster volume performance, for example `~/code/call-to-cash-risk-copilot`.
- Ensure Docker Desktop WSL integration is enabled for the distro you use.
- Do not run one copy of PostgreSQL/Redis on Windows and a second in Docker using the same ports.
- Use Git line-ending settings that preserve shell scripts (`LF`) in `infra/`.

---

## 3. Expected repository layout

```text
apps/
  web/
  api/
packages/
  shared/
  db/
  agora/
  solana/
  ai/
  config/
prisma/
  schema.prisma
infra/
  docker/
docs/
```

Create the following local infrastructure file if it does not exist:

```text
docker-compose.dev.yml
```

---

## 4. Environment files

Never commit real secrets. Commit only `.env.example` files.

### Root `.env.example`

```env
# Database
POSTGRES_DB=call_to_cash
POSTGRES_USER=app
POSTGRES_PASSWORD=change-me-local
DATABASE_URL=postgresql://app:change-me-local@localhost:5432/call_to_cash?schema=public

# Redis
REDIS_PASSWORD=change-me-redis
REDIS_URL=redis://:change-me-redis@localhost:6379/0

# Local object storage (MinIO)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change-me-minio
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=call-to-cash-local
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=change-me-minio
S3_FORCE_PATH_STYLE=true

# App runtime
NODE_ENV=development
WEB_ORIGIN=http://localhost:3000
API_ORIGIN=http://localhost:4000

# Agora: optional until real voice is enabled
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_RECORDING_ENABLED=false

# Solana: use mock mode until devnet flow is ready
SOLANA_MODE=mock
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=
SOLANA_RECIPIENT_WALLET=

# AI: use mocked structured responses until provider is wired
AI_MODE=mock
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=

# Feature flags
FEATURE_LIVE_VOICE=false
FEATURE_CLOUD_RECORDING=false
FEATURE_PAYMENT_GATE=true
FEATURE_SOLANA_PROOF=true
```

Copy it once per developer:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Keep secrets in your local `.env`; do not paste them into issue comments, screenshots, source code, or client-side variables.

---

## 5. Docker Compose: PostgreSQL, Redis, and MinIO

Create `docker-compose.dev.yml` at repository root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: call-to-cash-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    container_name: call-to-cash-redis
    restart: unless-stopped
    command: >
      redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD} ping"]
      interval: 5s
      timeout: 5s
      retries: 20

  minio:
    image: minio/minio:latest
    container_name: call-to-cash-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 20

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c '
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
      mc mb --ignore-existing local/${S3_BUCKET};
      exit 0;
      '

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Start infrastructure

```bash
docker compose --env-file .env -f docker-compose.dev.yml up -d
docker compose --env-file .env -f docker-compose.dev.yml ps
```

Expected local endpoints:

```text
PostgreSQL:     localhost:5432
Redis:          localhost:6379
MinIO S3 API:   http://localhost:9000
MinIO Console:  http://localhost:9001
```

Sign in to MinIO Console with `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`; the startup job should create `call-to-cash-local` automatically.

---

## 6. Install dependencies and initialize the database

```bash
pnpm install
pnpm exec prisma generate --schema prisma/schema.prisma
pnpm exec prisma migrate dev --schema prisma/schema.prisma
```

Recommended root scripts:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api dev",
    "db:generate": "prisma generate --schema prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "db:studio": "prisma studio --schema prisma/schema.prisma",
    "infra:up": "docker compose --env-file .env -f docker-compose.dev.yml up -d",
    "infra:down": "docker compose --env-file .env -f docker-compose.dev.yml down",
    "infra:reset": "docker compose --env-file .env -f docker-compose.dev.yml down -v"
  }
}
```

Start applications:

```bash
pnpm dev
```

Expected defaults:

```text
Web: http://localhost:3000
API: http://localhost:4000
```

Use the actual ports defined by app configuration if your repository differs.

---

## 7. Local feature modes

### Mode A — deterministic demo mode

Use this first. It does not require Agora, Solana, or an external AI provider.

```env
AI_MODE=mock
SOLANA_MODE=mock
FEATURE_LIVE_VOICE=false
```

Flow:

```text
Transcript replay → structured extraction fixture → gate → mock payment → mock proof → receipt
```

### Mode B — local storage + real AI adapter

```env
AI_MODE=provider
SOLANA_MODE=mock
FEATURE_LIVE_VOICE=false
```

Use redacted, synthetic test transcripts only.

### Mode C — real Agora + Solana devnet

```env
FEATURE_LIVE_VOICE=true
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
SOLANA_MODE=devnet
SOLANA_RPC_URL=...
SOLANA_RECIPIENT_WALLET=...
```

Enable cloud recording only after you have configured consent and an external object store reachable by Agora. Agora cannot upload recordings to your local `localhost` MinIO instance.

---

## 8. Local smoke test checklist

Run these in order after `pnpm dev` starts:

1. Open web app and start the transcript replay scenario.
2. Verify API health endpoint, for example `GET /health`.
3. Create a booking draft with missing fields; confirm payment is locked.
4. Complete all required fields and explicit confirmation; confirm agreement locks.
5. Generate mock payment intent; verify QR/link is shown.
6. Confirm mock payment; verify receipt status becomes `MATCH`.
7. Change a material agreement field; verify old payment intent is invalidated.
8. Trigger tamper test; verify status becomes `MANUAL_REVIEW_REQUIRED`.
9. Inspect MinIO bucket for a test object when storage upload is enabled.
10. Inspect Redis only for transient keys; verify durable booking data exists in PostgreSQL.

---

## 9. Useful diagnostics

```bash
# Infrastructure status
docker compose --env-file .env -f docker-compose.dev.yml ps

# Follow logs
docker compose --env-file .env -f docker-compose.dev.yml logs -f postgres redis minio

# PostgreSQL shell
docker exec -it call-to-cash-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Redis shell
docker exec -it call-to-cash-redis redis-cli -a "$REDIS_PASSWORD"

# View database data
pnpm db:studio
```

On PowerShell, environment variable syntax differs; use the container name directly or run commands inside Docker Desktop terminal as needed.

---

## 10. Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Port 5432/6379/9000 already in use | local service or prior container | stop conflicting service or change host port |
| Prisma cannot connect | DB not healthy or wrong `DATABASE_URL` | run `docker compose ps`, verify `.env` |
| Redis auth error | password mismatch | restart stack after matching `.env` values |
| MinIO upload fails | bucket not created or endpoint wrong | inspect MinIO Console; use `S3_FORCE_PATH_STYLE=true` locally |
| Frontend cannot call API | CORS / origin mismatch | align `WEB_ORIGIN` and API CORS config |
| Agora token invalid | mismatched App ID/certificate/channel/UID | regenerate through `packages/agora`; never hard-code token |
| Solana payment stuck pending | wrong network, reference, RPC, or recipient | use mock mode first; inspect API verification logs |

---

## 11. Reset policy

### Safe restart without deleting data

```bash
docker compose --env-file .env -f docker-compose.dev.yml down
docker compose --env-file .env -f docker-compose.dev.yml up -d
```

### Destructive local reset

```bash
docker compose --env-file .env -f docker-compose.dev.yml down -v
```

This permanently deletes local PostgreSQL, Redis, and MinIO volumes. Do not use it when you need local demo data.
