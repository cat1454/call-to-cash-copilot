# Call-to-Cash Risk Copilot

An interactive hackathon demonstration console for a voice-first transaction decision operator. Call-to-Cash Risk Copilot simulates Agora Conversational AI telemetry, a real-time risk gate, Solana Pay deposits, and tamper-evident trust receipts.

```text
Customer voice -> Booking extraction -> Risk scoring -> Payment gate
       -> Solana Pay deposit -> Ledger proof -> Verified trust receipt
```

## Core product positioning

- **Revenue operator**: decides when a conversation is complete, safe, and explicitly confirmed before opening payment.
- **Customer UX**: shows booking summaries, a deposit drawer, a reservation timer, and a verified ticket.
- **Mentor console**: exposes the simulated transcript, risk telemetry, booking extraction, ledger proof, and tamper demonstration.

## Decision pipeline

1. The voice layer produces live transcript turns and latency telemetry.
2. The extraction layer builds route, departure time, passenger count, and phone fields.
3. The risk engine measures completeness, dispute risk, and payment readiness.
4. The payment gate stays locked until `Completeness >= 85`, `Readiness >= 80`, `Dispute Risk <= 35`, and the customer explicitly confirms.
5. The payment drawer creates a simulated Solana Pay deposit request.
6. The ledger auditor anchors and verifies a proof derived from the agreed booking.
7. The trust receipt reports `MATCH`; the Tamper action produces `MISMATCH` and invalidates the ticket.

## Repository structure

```text
call-to-cash-risk-copilot/
├── apps/
│   ├── web/                  # React/Vite demo, PWA assets, and frontend tests
│   │   ├── public/
│   │   ├── src/
│   │   ├── eslint.config.js
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   └── api/                  # Fastify/TypeScript orchestration boundary
├── packages/
│   ├── shared/               # Future shared contracts and schemas
│   ├── domain/               # Pure deterministic business rules and transitions
│   ├── db/                   # Future persistence and migrations
│   ├── agora/                # Future Agora provider integration
│   ├── solana/               # Future Solana Pay and proof integration
│   ├── ai/                   # Future extraction and risk engine
│   └── config/               # Future shared environment/lint/type config
├── docs/
├── ECC/                      # Local agent tooling; excluded from the workspace
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The API currently exposes only Phase 1 health/readiness scaffolding. Business contracts, domain rules, persistence, and provider adapters remain intentionally unimplemented; the working transaction simulation is still self-contained in `apps/web`.

## Local development

Requirements: Node.js 22+ and Corepack.

```bash
corepack pnpm install
corepack pnpm dev
```

The Vite app is available at `http://localhost:5173/` by default.

Root commands:

```bash
corepack pnpm dev       # Start the web app through Turbo
corepack pnpm test      # Run workspace structure and frontend tests
corepack pnpm lint      # Run package lint tasks
corepack pnpm build     # Build apps/web/dist
corepack pnpm preview   # Preview the frontend production build
```

When Corepack shims are enabled, the shorter `pnpm dev`, `pnpm test`, and related commands work identically.

## Foundation documents

- [AGENTS.md](./AGENTS.md): simulated agent roles and system boundaries.
- [RULES.md](./docs/RULES.md): coding, risk-gate, and ledger verification rules.
- [DESIGN.md](./docs/DESIGN.md): UI tokens and responsive design guidance.
- [MAINTAINABILITY.md](./docs/MAINTAINABILITY.md): source organization and refactoring guidance.
- [Backend roadmap](./docs/BACKEND_ROADMAP_2026.md): framework-neutral backend phases and API contract.
- [ECC agent workflow](./docs/operations/ECC-AGENT-WORKFLOW.md): project-specific skill discovery, precedence, and update rules for the local ECC clone.
