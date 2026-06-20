# Docker Desktop & PostgreSQL Local Setup

> **Audience:** Call-to-Cash contributors on Windows using Docker Desktop.
>
> **Scope:** local PostgreSQL for the Phase 5 authoritative replay API. This guide does not set up Redis, MinIO/S3, Agora, Solana, or production hosting.
>
> **Current architecture:** PostgreSQL is the durable local authority for calls, transcript turns, risk assessments, bookings, inventory holds, agreements, mock payments, proof records, Trust Receipts, and committed SSE/audit events.

---

## 1. What this setup creates

Each developer runs a separate local PostgreSQL instance on their own machine:

```text
Your Windows machine
└── Docker Desktop
    └── PostgreSQL container
        ├── call_to_cash       # local development database
        ├── call_to_cash_test  # isolated integration-test database
        └── named Docker volume
```

Git synchronizes **code, Prisma schema, migrations, and seed scripts**. It does **not** synchronize a teammate's Docker container, Docker volume, or local database rows.

Do not use another developer's laptop database as a shared development environment. Tests reset synthetic data and can interfere with one another.

---

## 2. Repository assumptions

This guide assumes the repository root contains:

```text
compose.yaml
.env.example
prisma.config.ts
prisma/schema.prisma
prisma/migrations/
prisma/seed.ts
packages/db/
```

The repository's local Compose service is:

```yaml
name: call-to-cash-copilot

services:
  postgres:
    image: postgres:18.3-alpine
    environment:
      POSTGRES_DB: call_to_cash
      POSTGRES_USER: call_to_cash
      POSTGRES_PASSWORD: call_to_cash
    ports:
      - "${POSTGRES_PORT:-55432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U call_to_cash -d call_to_cash"]
    volumes:
      - call_to_cash_postgres:/var/lib/postgresql
```

### Local database connection details

| Setting | Value |
|---|---|
| Host when the app runs directly on Windows | `localhost` |
| Host port | `55432` by default |
| Container port | `5432` |
| Development database | `call_to_cash` |
| Development user | `call_to_cash` |
| Development password | `call_to_cash` |
| Docker named volume | `call_to_cash_postgres` |

The password above is permitted only for local development. Never reuse it in staging or production.

---

## 3. Prerequisites

Install or verify the following before continuing:

- Git
- Node.js version pinned by the repository (`.nvmrc`, `package.json`, or project documentation)
- pnpm version pinned by the repository
- Docker Desktop for Windows with its Linux/WSL 2 engine running

From PowerShell in the repository root, verify Docker:

```powershell
docker version
docker compose version
```

A healthy installation shows both a Docker **Client** and **Server**, and a Compose v2 version. The Docker context should normally be `desktop-linux`.

---

## 4. Pull the repository and install dependencies

```powershell
git pull
pnpm install --frozen-lockfile
```

Do not commit `node_modules`, `.pnpm-store`, `.env`, generated local database files, or Docker volumes.

---

## 5. Configure local environment variables

Create `.env` from the repository template if it does not exist:

```powershell
Copy-Item .env.example .env
```

Open `.env`. Keep any existing application variables and make sure the local database URLs point to your Docker-exposed port:

```env
DATABASE_URL=postgresql://call_to_cash:call_to_cash@localhost:55432/call_to_cash?schema=public
TEST_DATABASE_URL=postgresql://call_to_cash:call_to_cash@localhost:55432/call_to_cash_test?schema=public
```

Important:

```text
DATABASE_URL      -> development database; preserve it while developing
TEST_DATABASE_URL -> test-only database; integration tests may reset its synthetic data
```

Never point both variables at the same database.

### If port `55432` is already occupied

Add this to `.env`:

```env
POSTGRES_PORT=55433
DATABASE_URL=postgresql://call_to_cash:call_to_cash@localhost:55433/call_to_cash?schema=public
TEST_DATABASE_URL=postgresql://call_to_cash:call_to_cash@localhost:55433/call_to_cash_test?schema=public
```

Then use that same port in all local connection tools.

---

## 6. Validate and start PostgreSQL

Validate the Compose configuration first:

```powershell
docker compose config
```

Start only the PostgreSQL service in the background:

```powershell
docker compose up -d postgres
```

Check health:

```powershell
docker compose ps
```

Expected result: the `postgres` service eventually reports `running` / `healthy`.

Watch startup logs if necessary:

```powershell
docker compose logs -f postgres
```

The expected success message contains:

```text
database system is ready to accept connections
```

Press `Ctrl + C` to stop following logs. This does not stop PostgreSQL.

---

## 7. Verify PostgreSQL directly

Run a non-interactive query:

```powershell
docker compose exec postgres psql -U call_to_cash -d call_to_cash -c "SELECT current_database(), current_user;"
```

Expected values:

```text
current_database = call_to_cash
current_user     = call_to_cash
```

Optional version check:

```powershell
docker compose exec postgres psql -U call_to_cash -d call_to_cash -c "SELECT version();"
```

To open an interactive SQL shell:

```powershell
docker compose exec postgres psql -U call_to_cash -d call_to_cash
```

Useful `psql` commands:

```sql
\l       -- list databases
\dt      -- list tables in the current database
\q       -- quit
```

---

## 8. Create the dedicated integration-test database

Create this database once per local Docker volume:

```powershell
docker compose exec postgres psql -U call_to_cash -d postgres -c "CREATE DATABASE call_to_cash_test OWNER call_to_cash;"
```

If PostgreSQL reports that `call_to_cash_test` already exists, that is fine.

Verify both databases:

```powershell
docker compose exec postgres psql -U call_to_cash -d postgres -c "\l"
```

You should see at least:

```text
call_to_cash
call_to_cash_test
postgres
template0
template1
```

---

## 9. Apply committed migrations before seeding

### Correct command when you pulled existing code

Use the committed migration history:

```powershell
pnpm exec prisma migrate deploy --config prisma.config.ts
```

Then inspect migration state:

```powershell
pnpm exec prisma migrate status --config prisma.config.ts
```

### Do not use `migrate dev` as the normal new-machine setup command

`prisma migrate dev` is for a developer who intentionally changed `prisma/schema.prisma` and needs to create a **new committed migration**.

When you only pulled a teammate's code, use `migrate deploy` instead.

If you accidentally run `migrate dev` and Prisma asks:

```text
Enter a name for the new migration:
```

do **not** invent a migration name unless you intentionally changed the schema and own that migration. Press `Ctrl + C`, then run `prisma migrate status` and use `migrate deploy` to apply the committed migration history.

### Why the seed can fail before migration

A seed failure such as:

```text
P2021: The table public.users does not exist
```

means Prisma Client was generated but the PostgreSQL tables were not created yet. Generation does not apply migrations.

Fix order:

```powershell
pnpm exec prisma migrate deploy --config prisma.config.ts
pnpm --filter @call-to-cash/db seed
```

---

## 10. Generate Prisma Client and seed deterministic local data

First inspect actual project scripts:

```powershell
pnpm run
```

Use the canonical scripts that exist in this repository. With the current package layout, the database seed command is expected to be:

```powershell
pnpm --filter @call-to-cash/db seed
```

That package command generates Prisma Client and executes `prisma/seed.ts`.

If the repository exposes root shortcuts, use those instead where documented, for example:

```powershell
pnpm db:generate
pnpm db:seed
pnpm db:validate
```

Do not run seed until migrations are successfully applied.

---

## 11. Open Prisma Studio to inspect tables

From the repository root, with PostgreSQL running and migrations applied:

```powershell
pnpm exec prisma studio --config prisma.config.ts --port 5555
```

Prisma Studio will print a local URL. Open:

```text
http://localhost:5555
```

Use the left-side model list to inspect tables such as:

```text
User / users
CallSession / call_sessions
TranscriptTurn / transcript_turns
Booking / bookings
Agreement / agreements
PaymentIntent / payment_intents
PaymentTransaction / payment_transactions
ProofRecord / proof_records
TrustReceipt / trust_receipts
AuditLog / audit_logs
```

Prisma Studio is a database editor. Treat it as a local debugging tool:

- Do not manually edit a locked agreement, payment, proof, or receipt while testing authoritative flows.
- Do not use a production database connection in Studio.
- Stop Studio with `Ctrl + C` when finished.

If port `5555` is busy, choose another local port:

```powershell
pnpm exec prisma studio --config prisma.config.ts --port 5556
```

---

## 12. Verify API readiness

Start the API using the repository's supported script. Typical options are:

```powershell
pnpm dev
```

or:

```powershell
pnpm --filter @call-to-cash/api dev
```

Read the terminal output for the actual API port, then call the readiness endpoint:

```powershell
Invoke-RestMethod http://localhost:<API_PORT>/ready
```

`/ready` should succeed only when PostgreSQL is reachable. If it fails, check:

1. `docker compose ps` reports PostgreSQL as healthy.
2. `DATABASE_URL` uses `localhost:55432` (or your overridden port).
3. Migrations have been applied.
4. The API process loaded the intended `.env` values.

When the API runs directly on Windows, use `localhost:<host-port>`. The hostname `postgres:5432` is valid only for a service running inside the same Docker Compose network.

---

## 13. Run the repository checks

The current full quality gate is:

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The integration suites use `TEST_DATABASE_URL` and should run sequentially because they reset synthetic test data.

### Known formatting baseline note

The current project snapshot records pre-existing formatting drift in files outside the Phase 5 implementation. A root `pnpm format:check` can therefore fail even when the Phase 5 files are correctly formatted.

Do not mix a repository-wide formatting change into a feature branch. Create a dedicated non-functional change such as:

```text
chore(format): normalize repository formatting baseline
```

---

## 14. Daily Docker commands

```powershell
# Start PostgreSQL and preserve existing local data
docker compose up -d postgres

# See status and health
docker compose ps

# Follow PostgreSQL logs
docker compose logs -f postgres

# Stop PostgreSQL but preserve the database
docker compose stop postgres

# Stop and remove containers/networks, but preserve the named volume
docker compose down

# Remove containers AND delete all local PostgreSQL data — destructive
docker compose down -v
```

`docker compose down -v` deletes `call_to_cash_postgres`. Use it only when you explicitly want to reset your local database and are prepared to re-run migrations and seed.

---

## 15. Common troubleshooting

### A. `P2021` / `public.users does not exist`

Cause: seed was run before migrations.

```powershell
pnpm exec prisma migrate deploy --config prisma.config.ts
pnpm --filter @call-to-cash/db seed
```

### B. `port is already allocated`

Find what is using the default port:

```powershell
netstat -ano | findstr :55432
```

Choose a different `POSTGRES_PORT` in `.env`, update both database URLs, then restart the Compose service.

### C. `password authentication failed`

The Docker volume may have been initialized using older credentials. PostgreSQL initialization values are only used when the data volume is empty.

For a disposable local database only:

```powershell
docker compose down -v
docker compose up -d postgres
pnpm exec prisma migrate deploy --config prisma.config.ts
pnpm --filter @call-to-cash/db seed
```

### D. `/ready` fails while Docker says PostgreSQL is healthy

Confirm the API is using a Windows host connection string:

```env
DATABASE_URL=postgresql://call_to_cash:call_to_cash@localhost:55432/call_to_cash?schema=public
```

Do not use `postgres:5432` unless the API itself runs as a Compose service.

### E. Prisma Studio cannot start

Check that PostgreSQL is healthy and migration status is valid:

```powershell
docker compose ps
pnpm exec prisma migrate status --config prisma.config.ts
```

Then choose an unused Studio port:

```powershell
pnpm exec prisma studio --config prisma.config.ts --port 5556
```

### F. Need a completely clean local database

This is destructive:

```powershell
docker compose down -v
docker compose up -d postgres
pnpm exec prisma migrate deploy --config prisma.config.ts
pnpm --filter @call-to-cash/db seed
```

---

## 16. Phase 5 scope and what is intentionally absent

After this guide succeeds, your machine can run the Phase 5 server-authoritative replay flow:

```text
Replay transcript
→ durable PostgreSQL turn
→ deterministic risk and payment gate
→ booking and inventory hold
→ immutable agreement
→ idempotent mock payment
→ proof record and Trust Receipt
→ durable SSE events
```

The web application remains fixture-driven until Phase 6 wires it to REST and SSE.

Do not add Redis, MinIO/S3, Agora, Solana, or a live LLM merely to complete the Docker stack. They are deferred until each has a real consumer:

| Component | Add when |
|---|---|
| Redis | retry/outbox workers, live transcript buffers, or queue consumers exist |
| MinIO / S3 | recording or object-storage flow has consent and retention controls |
| Solana Devnet | payment provider adapter and server-side transaction verification are ready |
| Agora | web-to-API/server-authoritative replay path is already proven |
| LLM | strict extraction schema and domain safety rules are already stable |

---

## 17. Team rules

```text
- Every developer owns a separate local Docker PostgreSQL volume.
- Prisma migrations are the source of truth for schema.
- Deterministic seed scripts are the source of truth for demo baseline data.
- Never commit .env, Docker volumes, local database dumps, or secrets.
- Never run test resets against a shared staging database.
- Never create a migration merely because a new-machine setup command prompted for one.
- Do not use Prisma Studio against production or shared staging without explicit approval.
```
