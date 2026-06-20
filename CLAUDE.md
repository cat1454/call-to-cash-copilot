# CLAUDE.md — Operating Guidelines for Claude Code CLI

This file defines repository workflow, implementation guardrails, and coding constraints for Claude Code working in this repository.

## Commands

- **Install dependencies**: `corepack pnpm install`
- **Local Dev Server**: `corepack pnpm dev`
- **Build compilation**: `corepack pnpm build`
- **Project linting**: `corepack pnpm lint`
- **Project tests**: `corepack pnpm test`

## ECC Workflow Discovery

- `ECC/` is the local upstream workflow library and is not application code.
- Before implementation or analysis, read the relevant project contracts, then scan metadata in `ECC/.agents/skills/*/SKILL.md` and `ECC/skills/*/SKILL.md` for the smallest matching workflow.
- Read a selected `SKILL.md` completely before using it and announce the selected skill in the progress update.
- Prefer ECC skills over legacy command shims. Do not assume ECC hooks, MCP servers, subagents, or slash commands are installed.
- Project security, contract, state-machine, data-model, and product documents override generic ECC guidance.
- Do not modify the `ECC/` clone during product work. See `docs/operations/ECC-AGENT-WORKFLOW.md` for the full routing and update policy.

## Visual Styling Compliance (V6 Specs)

- **Strict Color Tokens**:
  - Background is white (`#FFFFFF`) / light grey (`#F9FAFB`).
  - Primary color is green (`#059669`).
  - Green (`#10B981`) is reserved exclusively for successful matches or confirmed cọc.
  - Amber (`#F59E0B`) represents warnings or pending states.
  - Red (`#F43F5E`) represents cryptographic mismatch warnings.
  - No dark, neon purple, or complex crypto visual elements in the customer flow.
- **Mobile Responsive Design**: Ensure all controls and components collapse correctly on screens `<= 768px` to render only the smartphone screen as a full-screen layout.
- **Tactile Transitions**: Buttons must react to click/tap events using an active transition `transform: scale(0.96)`.
- **Text & Numeric Wrapping**: Headline titles must use `text-wrap: balance` and counters/financial metrics must use `font-variant-numeric: tabular-nums` to prevent visual shifting.

## Core Code Architecture

- **Current demo state**: The existing frontend simulation lifts shared scenario, transcript, and receipt/proof state into `apps/web/src/App.jsx` and passes it to `PhoneScreen.jsx` and `DesktopConsole.jsx`. Preserve this while editing the current demo, but do not treat browser state as the target system authority. New production behavior must follow the documented API, domain, state-machine, and package boundaries below.
- **Immutability**: Avoid direct state mutation. Always return fresh copied objects when applying changes using React hook setters.
- **Service Worker & Manifest**: Do not break the PWA configuration inside `apps/web/index.html` and `apps/web/src/main.jsx`.

## Security & Verification Ledger

- **Verification Contract**:
  - The off-chain draft agreement payload (route, seats, masked contact identity, price, and deposit) must be canonicalized and hashed to construct a verifiable reference.
  - The computed hash must be checked against the anchored proof hash.
  - If they do not match, the transaction must fail with a `mismatch` warning stamp and block the booking receipt.
- **Secret Management**: Never write hardcoded API keys, Agora certificates, database credentials, webhook secrets, or Solana private credentials into client-facing code.

## Documentation-First Implementation Rules

Agents must read the relevant documentation before changing code. Use the documentation-to-code ownership map below to determine what is relevant.

- Product docs define business behavior.
- Architecture docs define system boundaries and technical decisions.
- Contract docs define API payloads, realtime events, errors, and shared schemas.
- Security docs define PII handling and on-chain/off-chain storage restrictions.
- Operations docs define local run, deployment, migration, rollback, and incident-response procedures.
- If code conflicts with documentation, do not silently choose one. Flag the mismatch and update the relevant contract/documentation before or together with the implementation.
- Do not duplicate contracts across frontend and backend. Shared schemas and types are the source of truth.
- Any new endpoint, event, state, table, external provider, or sensitive data field requires a corresponding documentation update.

Use this documentation precedence order:

```text
1. docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md
2. docs/contracts/API-CONTRACT.md
3. docs/contracts/EVENT-CONTRACT.md
4. docs/architecture/STATE-MACHINES.md
5. docs/architecture/DATA-MODEL.md
6. docs/architecture/DECISIONS.md
7. docs/architecture/PIPELINE.md
8. docs/product/BOOKING-CONTRACT.md
9. docs/product/RISK-SCORING.md
10. docs/operations/*.md
```

When documents conflict, the higher document in this precedence order wins until the conflict is explicitly resolved in the affected documents.

## Documentation to Code Ownership Map

| Documentation | Governs | Primary Code Areas |
|---|---|---|
| `docs/architecture/PIPELINE.md` | End-to-end Call → Transcript → Risk → Booking → Payment → Receipt flow | `apps/web`, `apps/api`, `packages/ai`, `packages/solana`, `packages/agora` |
| `docs/architecture/DECISIONS.md` | Technology choices, module boundaries, tradeoffs | Entire repository |
| `docs/architecture/DATA-MODEL.md` | Entities, relationships, retention, indexes, sensitive fields | `packages/db/`, `apps/api/`; planned `prisma/` path documented in `PIPELINE.md` |
| `docs/architecture/STATE-MACHINES.md` | Call, booking, payment, receipt, and payment-gate transitions | `packages/shared/`, `apps/api/` |
| `docs/product/BOOKING-CONTRACT.md` | Booking fields, agreement behavior, confirmation requirements | `packages/shared/`, `packages/ai/`, `apps/web/src/features/`, `apps/api/` |
| `docs/product/RISK-SCORING.md` | Risk scoring rules, thresholds, explanations, payment-gate logic | `packages/ai/`, `apps/api/`, `apps/web/src/features/simulation/` |
| `docs/contracts/API-CONTRACT.md` | HTTP endpoints, DTOs, response shapes, side effects | `apps/api/`, `packages/shared/`, `apps/web/`; dedicated API client paths are planned |
| `docs/contracts/EVENT-CONTRACT.md` | SSE/realtime event names and payloads | `apps/api/`, `packages/shared/`, `apps/web/`; dedicated realtime client paths are planned |
| `docs/contracts/ERROR-CODES.md` | Standard API/domain error codes | `apps/api/`, `packages/shared/` |
| `docs/security/DATA-PRIVACY-ONCHAIN-POLICY.md` | PII handling, audio/transcript retention, Solana on-chain limits | `packages/db/`, `packages/solana/`, `apps/api/`, `apps/web/` |
| `docs/operations/LOCAL-SETUP.md` | Local development workflow | Root tooling, `.env.example`, scripts |
| `docs/operations/DEPLOYMENT.md` | Deployment environment, migration and release process | CI/CD, Docker, deployment config |
| `docs/operations/INCIDENT-RUNBOOK.md` | Operational response and recovery process | Logging, monitoring, rollback procedures |

Paths marked as planned do not currently exist. Verify their status and the relevant architecture decision before relying on or creating them.

### Architecture Boundaries

- Agora is the media plane. Browser/mobile clients connect directly to Agora for realtime voice.
- Do not proxy or relay full voice streams through the Node API.
- Node API is the orchestration layer for call state, transcript persistence, AI analysis, booking state, payment gate, Solana verification, proof records, and trust receipts.
- Frontend must not generate Agora RTC tokens, verify payments authoritatively, access private keys, or access the database directly.
- `packages/ai` owns extraction, scoring, payment-gate policy, and recommendation logic.
- `packages/solana` owns Solana Pay generation, transaction parsing, verification, payment reference generation, and proof hash utilities.
- `packages/agora` owns server-side Agora token generation, webhook parsing, recording helpers, and event normalization.
- `packages/db` owns Prisma client setup and repositories. Business logic must not be scattered into raw database calls.
- `packages/shared` owns Zod schemas, API DTOs, enums, domain types, constants, and event contracts.
- `packages/domain` owns pure state transitions, risk/payment-gate policy, agreement rules, and inventory guards without framework, database, provider, or network dependencies.

### Privacy and Blockchain Rules

- Never store full audio, full transcript, raw phone number, raw customer PII, or the full agreement payload on Solana.
- Keep full transcript, booking details, AI score reasoning, optional recording references, and PII off-chain in PostgreSQL.
- Solana/on-chain records may contain only the payment transaction information, tx signature, reference, memo, proof hash, receipt verification metadata, and other approved non-PII values.
- Never expose Agora App Certificate, Solana private keys, database URLs, webhook secrets, or LLM API keys to the frontend.
- Mask phone numbers and PII in non-authorized views, logs, analytics, and realtime events.

### State-Machine Rules

- Never introduce a new call, booking, payment, receipt, or payment-gate state without updating `docs/architecture/STATE-MACHINES.md`.
- Never transition state by directly assigning arbitrary status strings.
- State transitions must be validated by a centralized domain/service layer.
- Payment intent creation is prohibited unless the payment gate is open and booking confirmation requirements are satisfied.
- Payment confirmation must be verified server-side and must be idempotent.
- Trust receipt creation must be idempotent and linked to a canonical agreement payload hash.

### API and Event Contract Rules

- Any API endpoint addition or modification requires updating `docs/contracts/API-CONTRACT.md`.
- Any websocket/realtime event addition or modification requires updating `docs/contracts/EVENT-CONTRACT.md`.
- Any new error condition or changed error response requires updating `docs/contracts/ERROR-CODES.md`.
- Validate external input using shared Zod schemas.
- Use shared DTOs/types from `packages/shared`; do not duplicate request/response types in frontend and backend.
- Keep API responses consistent with the documented success/error envelope.
- Never use undocumented realtime event names.

## Required Workflow for Any Feature Change

1. Identify affected domain: call, transcript, risk, booking, payment, proof, receipt, dashboard, deployment, or security.
2. Read every relevant document from the documentation-to-code ownership map.
3. Check API, event, state-machine, data-model, and privacy impact before writing code.
4. Update documentation first or in the same change set if the behavior/contract changes.
5. Update `packages/shared` schemas/enums/types before implementing frontend/backend changes.
6. Implement backend domain logic and persistence.
7. Implement API routes and realtime events.
8. Implement frontend integration.
9. Add/update tests for business rules, invalid transitions, and contract validation.
10. Run lint, typecheck, test, and build.
11. Summarize documentation changes, code changes, migration requirements, and unimplemented integration dependencies.

Every agent response after a code change must include:

```text
- Documentation consulted
- Documentation updated
- Files changed
- Contracts changed
- Database migration required: yes/no
- Environment variables added/changed
- Tests run
- Remaining TODOs or mocked integrations
```

## New Feature Change Checklist

Before implementation, check:

- [ ] Is the product behavior covered by `BOOKING-CONTRACT.md` or `RISK-SCORING.md`?
- [ ] Does it add/change an API endpoint?
- [ ] Does it add/change a realtime event?
- [ ] Does it add/change a domain state or transition?
- [ ] Does it add/change a database entity, field, index, or retention policy?
- [ ] Does it handle PII, audio, transcript, payment, wallet, or blockchain data?
- [ ] Does it require a new environment variable or third-party credential?
- [ ] Does it need demo-mode behavior?
- [ ] Does it need unit, integration, or end-to-end tests?
- [ ] Does it require deployment, migration, rollback, or incident-runbook changes?

## Demo Mode Policy

- The project must support an explicit `DEMO_MODE=true` configuration.
- Demo mode may use deterministic mock transcript events, mock AI provider responses, mock payment confirmation, and simulated Agora metadata.
- Demo mode must preserve real domain state transitions and real rule-based risk logic.
- Demo mode must never silently pretend a production blockchain transaction or Agora connection occurred.
- Any mocked provider or simulation must be clearly documented in the final implementation summary.
