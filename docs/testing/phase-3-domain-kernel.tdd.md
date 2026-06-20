# Phase 3 deterministic domain kernel — TDD evidence

## Source and user journeys

No external plan file was used. The journeys were derived from the authoritative Phase 3 section of `docs/architecture/PIPELINE.md` and the booking, risk, state-machine, and privacy contracts.

1. As a customer, I cannot reach a payable state while a required booking term, policy confirmation, inventory hold, or explicit confirmation is missing.
2. As a customer, a valid, confirmed, held agreement can open payment only through the deterministic gate.
3. As an operator, material term changes invalidate the prior agreement confirmation instead of silently reusing it.
4. As a system, unsupported state jumps fail deterministically and canonical agreement output stays stable and free of contact data.

## RED and GREEN record

| Stage | Command | Result | Evidence |
|---|---|---|---|
| RED | `corepack pnpm --filter @call-to-cash/domain build` | Expected failure | `TS2305` reported each missing Phase 3 export from `src/index.ts`, including `evaluatePaymentGate`, transition functions, and `serializeCanonicalAgreement`. |
| GREEN | `corepack pnpm --filter @call-to-cash/domain test` | PASS | 9 tests passed, 0 failed after the pure domain implementation was added. |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---:|---|---|---|---|
| 1 | Missing pickup is a normal gate blocker, not an automatic manual-review escalation. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 2 | Missing policy acceptance, confirmation, or active hold cannot open payment. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 3 | Completeness, readiness, and dispute scores are deterministic and capped. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 4 | Critical proof exceptions force manual review with a blocking action. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 5 | Only a locked agreement with an open gate and active hold is eligible for payment intent creation. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 6 | Accepted extraction remains proposed and invalidates a prior explicit confirmation when it changes a material term. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 7 | Material changes are immutable-input operations and clear the agreement-version confirmation. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 8 | Call, booking, payment-intent, and receipt transitions reject skipped states. | `packages/domain/src/domain.test.ts` | Unit | PASS |
| 9 | Inventory is evaluated against supplied server time; canonical agreement serialization is stable and excludes contact acknowledgement. | `packages/domain/src/domain.test.ts` | Unit | PASS |

## Coverage and known gaps

The workspace has no `test:coverage` command or configured coverage threshold, so no coverage percentage is claimed. The focused unit tests cover the Phase 3 mandatory invariants. Database persistence, API/SSE integration, SHA-256/proof anchoring, and browser wiring remain intentionally deferred to later documented phases.
