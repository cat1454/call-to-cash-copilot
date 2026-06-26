# Call-to-Cash Risk Copilot

# Phase 11 — Fleet Revenue Twin

## Product Specification, Architecture, Algorithms, Build Plan, Prompts, Tests and Demo Strategy

> **Canonical handbook.** This document is the canonical implementation handbook for the entire Phase 11. It normalizes the approved roadmap and defines the product thesis, business value, architecture, authority boundaries, contracts, algorithms, implementation sequence, tests, individual Codex prompts, demo narrative, risks, and closure criteria. It is a build plan, not evidence that the remaining slices are implemented.

> **Implementation status — 2026-06-23:** Phase 11 is **IMPLEMENTED / AUTOMATED VERIFICATION PASSED** against the isolated PostgreSQL test database. The shipping algorithm is **Scenario-Robust Revenue Rebalancing Optimizer**. Its judge-visible surfaces are Priority Allocation, Dynamic Incentive, and Overflow Routing. It applies scarce-primary / surplus-alternative policy through voluntary, expiring offers and an explicit no-hold waitlist; it never auto-reroutes a customer, revokes a hold, or bypasses inventory, agreement, payment, or privacy guards. A controlled Agora live-provider smoke remains an operational validation and is not claimed by demo-mode tests.

## Table of contents

1. [Roadmap and current evidence](#1-roadmap-and-current-evidence)
2. [Product thesis and business value](#2-product-thesis-and-business-value)
3. [Authority, privacy, and revenue meanings](#3-authority-privacy-and-revenue-meanings)
4. [End-to-end flow](#4-end-to-end-flow)
5. [Contract summary](#5-contract-summary)
6. [Events, errors, and API behavior](#6-events-errors-and-api-behavior)
7. [Implementation slices](#7-implementation-slices)
8. [Advanced algorithm roadmap](#8-advanced-algorithm-roadmap)
9. [Testing and quality gates](#9-testing-and-quality-gates)
10. [Judge demo and pitch](#10-judge-demo-and-pitch)
11. [Risks and mitigations](#11-risks-and-mitigations)
12. [Commit and completion strategy](#12-commit-and-completion-strategy)
13. [Umbrella Codex prompt](#13-umbrella-codex-prompt)

## 1. Roadmap and current evidence

### Approved roadmap

| Phase                                                           | Status                             | Meaning                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Phase 10 — Strict-schema LLM Extraction                         | **COMPLETE**                       | GPT-5 mini proposes strict-schema booking facts only; the domain remains authoritative.                               |
| Phase 11 — Fleet Revenue Twin                                   | **COMPLETE / AUTOMATED PASS**      | Server-authoritative proactive rebalancing plus overflow recovery; live-provider smoke remains operational follow-up. |
| 11.0 — Contract Normalization                                   | **COMPLETE**                       | Executable shared/domain contracts only.                                                                              |
| 11.1 — Authoritative Fleet Demand and Departure Snapshot        | **COMPLETE**                       | DB-derived snapshot with active/expired hold accounting.                                                              |
| 11.2 — Deterministic Overflow Recommendation Engine             | **COMPLETE**                       | Deterministic proactive/overflow evaluation, filtering, ranking, and top-three offers.                                |
| 11.3 — Incentive Policy Engine                                  | **COMPLETE**                       | Server-owned bounded incentives and scarce-primary/surplus-alternative thresholds.                                    |
| 11.4 — Offer Persistence, Acceptance and Inventory Revalidation | **COMPLETE**                       | Transactional persistence, idempotency, revalidation, and existing hold authority.                                    |
| 11.5 — Voice Negotiation Runtime Directive                      | **COMPLETE (demo/API projection)** | Server-approved proactive/overflow/waitlist directive; live Agora smoke remains separate.                             |
| 11.6 — Revenue Recovery Dashboard                               | **COMPLETE**                       | Safe aggregates, occupancy, timeline, and potential-versus-secured separation.                                        |
| 11.7 — Multi-demand Simulation                                  | **COMPLETE**                       | Deterministic FCFS simulation modes and fixture-backed judge surface.                                                 |
| Phase 12 — E2E, Observability, Accessibility and Deployment     | **PARTIAL / follows Phase 11 MVP** | Broader hardening.                                                                                                    |
| Phase 13 — Outcome Labeling, Evaluation and Opt-in Data         | **NOT STARTED**                    | Later learning lane.                                                                                                  |
| Phase 14 — Redis, Queue and Object Storage                      | **DEFERRED**                       | Not required for Phase 11 MVP.                                                                                        |

Fleet Revenue Twin is **Phase 11**, never Phase 14. Domain schema identifiers stay phase-neutral: `ctc.revenue-twin.*`.

### Phase 11.0: complete, bounded evidence

Phase 11.0 is **COMPLETE**. It added: strict demand-context, departure-snapshot, incentive-policy, overflow-offer, and evaluation-result schemas; identifier-only acceptance command and safe result; a strict reason-code enum; five safe versioned Revenue Twin events; fourteen Revenue Twin errors; a pure freshness/reevaluation guard; shared and domain tests.

It did **not** add a database migration, runtime API route, Redis, queue, object storage, LLM business authority, or Solana behavior change. The current inventory authority is PostgreSQL `trip_departures` plus transactional `inventory_holds`; departure data is catalogue-backed `TripDeparture`; money is integer VND minor units; public IDs are strict prefixed IDs; SSE uses the existing versioned envelope with `callId`, `bookingId`, sequence, and safe data; APIs use the existing success and safe-error envelopes; durable server-side idempotency replays same input and conflicts on changed input.

## 2. Product thesis and business value

Fleet Revenue Twin is a **server-authoritative real-time demand orchestration layer that protects scarce hot-departure capacity and redirects overflow demand to valid surplus alternatives, uses policy-controlled incentives, negotiates through voice, revalidates inventory transactionally, and measures recovered revenue.**

It evolves the positioning from **Conversational Booking Assistant** to **Real-time Fleet Revenue Operating System**. It is not merely a chatbot: the conversation is an interface to an authoritative booking, inventory, agreement, and payment system.

```text
Traditional flow
full departure → reject customer → lose booking → lose revenue

Revenue Twin
full departure → find alternatives → create safe incentive → negotiate
→ customer accepts → revalidate inventory → create hold → verify deposit/payment
→ recover revenue
```

The product hypothesis is that a truthful, explainable same-route alternative can retain demand that a full departure would otherwise lose. This is not a claim of measured market impact until dashboard data is available.

## 3. Authority, privacy, and revenue meanings

### Canonical authority principle

> **LLM interprets. Revenue Twin recommends. Domain validates. Inventory commits. Customer confirms. Payment verifies.**

| Surface                | Responsibility                                                                  | Must not do                                                                        |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Browser                | Render safe projections; send identifiers and explicit customer choices.        | Authoritatively submit price, discount, capacity, revenue, or provider state.      |
| Agora voice agent      | Receive/phrase turns and present only server-approved directives.               | Confirm booking/payment without server state or invent offers.                     |
| GPT-5 mini             | Propose strict-schema booking facts and flexibility behind Phase 10 validation. | Create offers, rank alternatives, choose a discount, or control inventory/payment. |
| Revenue Twin optimizer | Deterministically filter, rank, and calculate policy-bounded terms.             | Reserve seats or bypass domain policy.                                             |
| Domain                 | Validate state, freshness, agreement/payment guards, and transitions.           | Directly substitute provider/database authority.                                   |
| PostgreSQL             | Persist canonical records, durable idempotency, outbox/audit data.              | Expose PII in projections.                                                         |
| Inventory service      | Reload capacity and atomically create existing holds.                           | Preempt or revoke existing holds.                                                  |
| Payment service        | Create request only after applicable guards and verify payment server-side.     | Treat an offer or deposit intent as paid revenue.                                  |
| Solana Devnet          | Carry the customer-signed payment transaction used by server verification.      | Act as escrow or receive full booking/PII.                                         |

Non-negotiable rules:

1. A recommendation does not reserve inventory.
2. The customer must explicitly accept a departure change.
3. Acceptance reloads the stored server-owned offer.
4. Inventory is revalidated before hold creation.
5. Policy is revalidated before discount becomes effective.
6. Holds belonging to another booking cannot be revoked. On an explicit accepted alternative, any active requested-departure hold belonging to that same booking is released and the new hold is created in one atomic transaction; if the new hold cannot be created, the release rolls back.
7. Browser cannot submit authoritative price, discount, capacity, or revenue.
8. LLM cannot create an offer.
9. Voice agent cannot confirm booking or payment without server state.
10. Potential revenue is not secured revenue.
11. Revenue Twin cannot bypass agreement or payment gates.
12. Solana verification remains server-authoritative.
13. Scarce-primary rebalancing is always voluntary: it may propose a later departure but cannot auto-change a booking or reclaim a hold.

### Privacy and revenue vocabulary

No on-chain record, event, dashboard projection, or voice directive may contain raw phone, full transcript, full agreement, wallet secret, provider secret, or model trace. Full booking/PII, transcript, reasoning, and optional recording reference remain off-chain according to the privacy policy.

| Term                            | Definition                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Potential gross revenue         | `original fare × passenger count` for an evaluated alternative.                                  |
| Potential discount cost         | `discount × passenger count`; a forecast/cost projection only.                                   |
| Potential net recovered revenue | `final fare × passenger count`; not a booking or payment.                                        |
| Accepted-offer revenue          | Value associated with a persisted, accepted offer after an authoritative hold succeeds.          |
| Secured recovered revenue       | Accepted-offer revenue only after the existing authoritative booking/payment condition succeeds. |

A deposit amount is **not** automatically recognized revenue.

## 4. End-to-end flow

```text
Agora final CUSTOMER transcript
  → Phase 10 strict-schema extraction
  → booking facts and customer flexibility
  → requested departure resolution
  → authoritative fleet snapshot
  → overflow detection
  → candidate filtering
  → deterministic ranking
  → incentive policy
  → expiring offers
  → SSE and REST projection
  → server-approved voice directive
  → customer accepts
  → reload stored offer
  → revalidate TTL, policy, inventory version and capacity
  → transactional inventory hold
  → booking departure and fare update
  → agreement
  → payment gate
  → Solana Pay Devnet request
  → server transaction verification
  → proof and Trust Receipt
  → secured recovered revenue
  → dashboard and refresh recovery
```

Fallback is deliberately boring and safe:

```text
Revenue Twin unavailable or no valid alternative
  → preserve existing booking flow
  → do not invent an alternative
  → do not mutate inventory
  → display truthful no-alternative state
```

## 5. Contract summary

The Phase 11.0 shared schemas are the source of truth; future slices extend them rather than duplicating frontend/backend DTOs.

| Contract                        | Current repository contract / purpose                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RevenueTwinDemandContext`      | `ctc.revenue-twin.demand.v1`; `callId`, optional booking/source turn IDs, route/requested departure, positive group size, validated flexibility, deposit readiness, `KEEP_TOGETHER`, request timestamp. No PII. |
| `RevenueTwinDepartureSnapshot`  | `ctc.revenue-twin.departure-snapshot.v1`; departure/operator/route, schedule, capacity/available seats, VND fare, pickup IDs, own/verified-partner relation, inventory version, observed time.                  |
| `RevenueTwinIncentivePolicy`    | `ctc.revenue-twin.incentive-policy.v1`; enabled/versioned server policy with VND/basis-point caps, minimum fare, shift, TTL, relation, and reason-code limits.                                                  |
| `RevenueTwinOverflowOffer`      | `ctc.revenue-twin.offer.v1`; prefixed offer/evaluation IDs, safe alternative/rank/time/capacity/version/fare/discount/reason/expiry facts. Final fare must equal fare minus discount.                           |
| `RevenueTwinEvaluationResult`   | `ctc.revenue-twin.evaluation.v1`; status, maximum three offers, potential impact, policy version, time.                                                                                                         |
| `AcceptRevenueTwinOfferCommand` | Identifier-only `callId`, evaluation ID, offer ID, idempotency key.                                                                                                                                             |
| `AcceptRevenueTwinOfferResult`  | `ACCEPTED` or `REQUIRES_REEVALUATION`, optional selected departure/hold ID, and safe next action.                                                                                                               |
| `RevenueTwinVoiceDirective`     | `ctc.revenue-twin.voice-directive.v1`; server-approved projection referencing stored offer IDs and safe display facts/actions only.                                                                             |
| `RevenueTwinWaitlistEntry`      | one idempotent `PENDING` entry per no-offer evaluation; requested departure and party size only, without a hold or payment authority.                                                                           |

The public status values are `PRIMARY_AVAILABLE`, `PROACTIVE_OFFERS_AVAILABLE`, `OVERFLOW_OFFERS_AVAILABLE`, `NO_ELIGIBLE_ALTERNATIVE`, `GROUP_CAPACITY_UNAVAILABLE`, `WAITLIST_RECOMMENDED`, and `POLICY_DISABLED`. A proactive offer is eligible only when the requested departure is at or below `scarcePrimaryAvailableSeats`, the customer is not fixed-time, and the alternative remains at or above `minimumAlternativeSurplusSeats` after the whole group. Current reason codes include primary/full/scarce, alternative surplus/capacity, same-route/operator/verified-partner/pickup, time/incentive/capacity, policy, expiry, and stale-inventory reasons; use `RevenueTwinReasonCodeSchema`, not a parallel enum.

## 6. Events, errors, and API behavior

### Events

The registered version-1 event names are `RevenueTwinEvaluated` (`revenue_twin.evaluated`), `RevenueTwinOfferAccepted`, `RevenueTwinOfferDeclined`, `RevenueTwinOfferExpired`, `RevenueTwinReevaluationRequired`, and `RevenueTwinWaitlistJoined`. All use the existing strict SSE envelope: event ID, version, occurrence time, optional correlation ID, `callId`, nullable `bookingId`, sequence, and safe data.

Safe data includes evaluation/offer/departure/hold identifiers, status/count, safe reason codes, integer fare/discount/potential-net amounts, and timestamp as applicable. It explicitly excludes raw transcript, raw phone, wallet secret, full payment signature, OpenAI prompt, OpenAI response, chain of thought, and customer wealth inference.

### Errors and retry behavior

| Error code                                | HTTP | Retry | Next action                                 |
| ----------------------------------------- | ---: | ----: | ------------------------------------------- |
| `REVENUE_TWIN_EVALUATION_NOT_FOUND`       |  404 |    No | Evaluation is unavailable for this call.    |
| `REVENUE_TWIN_OFFER_NOT_FOUND`            |  404 |    No | Offer is unavailable in the evaluation.     |
| `REVENUE_TWIN_OFFER_EXPIRED`              |  409 |   Yes | Re-evaluate safe alternatives.              |
| `REVENUE_TWIN_OFFER_ALREADY_DECIDED`      |  409 |    No | Return existing decision if idempotent.     |
| `REVENUE_TWIN_NO_ELIGIBLE_ALTERNATIVE`    |  422 |    No | Continue existing flow.                     |
| `REVENUE_TWIN_GROUP_CAPACITY_UNAVAILABLE` |  422 |    No | No full-group alternative.                  |
| `REVENUE_TWIN_POLICY_DISABLED`            |  422 |    No | Policy permits no discounted offer.         |
| `REVENUE_TWIN_POLICY_REJECTED`            |  422 |    No | Server policy rejected offer.               |
| `REVENUE_TWIN_UNVERIFIED_PARTNER`         |  422 |    No | Partner is not eligible.                    |
| `REVENUE_TWIN_INVENTORY_CHANGED`          |  409 |   Yes | Re-evaluate current inventory.              |
| `REVENUE_TWIN_STALE_SNAPSHOT`             |  409 |   Yes | Re-evaluate current snapshot.               |
| `REVENUE_TWIN_REEVALUATION_REQUIRED`      |  409 |   Yes | Do not create hold; re-evaluate.            |
| `REVENUE_TWIN_INVALID_FLEXIBILITY`        |  400 |    No | Correct customer-owned preference.          |
| `REVENUE_TWIN_IDEMPOTENCY_CONFLICT`       |  409 |    No | Same key carried changed acceptance intent. |

Runtime routes retain the existing success `{ success: true, data, meta }` and safe error `{ success: false, error }` envelope:

```text
POST /v1/calls/:callId/revenue-twin/evaluations
GET  /v1/calls/:callId/revenue-twin/evaluations/latest
POST /v1/calls/:callId/revenue-twin/offers/:offerId/accept
POST /v1/calls/:callId/revenue-twin/offers/:offerId/decline
```

## 7. Implementation slices

### 11.1 — Authoritative Fleet Demand and Departure Snapshot

**Objective:** map `trip_departures` + active `inventory_holds` + catalogue schedule, route, fare, and pickup facts into `RevenueTwinDepartureSnapshot[]`.

It uses the current PostgreSQL inventory authority. Active holds and confirmed reservations reduce availability; expired holds do not. Clamp/prevent invalid state so availability is never negative or greater than capacity. Use integer VND, `observedAt`, stable `inventoryVersion`, own-fleet or verified-partner relation, and no PII.

Choose inventory version evidence in this order: (1) an existing version field, (2) authoritative `updatedAt`, (3) inventory aggregate sequence, (4) a minimal schema change only if unavoidable. Do not pretend a timestamp has stronger concurrency semantics than it actually does; document the chosen mapping with a migration if one becomes necessary.

Conceptual repository interface:

```ts
interface RevenueTwinDepartureSnapshotRepository {
  listSnapshots(input: {
    routeId: string;
    observedAt: Date;
    includeRelations: readonly ["OWN_FLEET", "VERIFIED_PARTNER"];
  }): Promise<RevenueTwinDepartureSnapshot[]>;
  getSnapshot(departureId: string, observedAt: Date): Promise<RevenueTwinDepartureSnapshot | null>;
}
```

Implementation: trace existing `TripDeparture`/inventory repository semantics; add a DB repository mapper; resolve verified partner status only from authoritative catalogue data; expose through a service used by later slices, not browser input; add safe repository tests. Focused tests cover active/expired/confirmed accounting, bounds, VND, pickup/relation mapping, stable version, and PII absence. DB-backed tests must create realistic departure/hold/reservation rows and compare snapshot availability with the locked hold authority.

Phase 10.5 catalogue hardening adds deterministic fixture metadata for Phase 11 rehearsal:
`trip-schedule-demo.csv` holds physical routes, service variants, operator relation, status, fare,
deposit, and pickup codes; `pickup-point-demo.csv` holds aliases; `trip-inventory-demo.csv` holds
scenario counts; `revenue-twin-demand-demo.csv` holds expected demand outcomes; and
`revenue-twin-policy-demo.csv` holds policy knobs. Runtime offers still read authoritative
`trip_departures` plus `inventory_holds`; browser and LLM input cannot supply capacity, fare,
discount, operator relation, inventory version, or policy.

The runtime demand context may include a server-derived `pickupPointId` after the booking pickup is
validated. CSV pickup codes such as `HUE_TERMINAL` remain operator-editable catalogue codes; the API
adapter maps them to shared runtime identifiers such as `pickup_HUE_TERMINAL` before the deterministic
Revenue Twin filter runs. If present, the pickup identifier is a constraint: same-route alternatives
that do not list that pickup are rejected before ranking.

Acceptance: one authoritative snapshot is reproducible from known DB rows; no candidate is accepted from browser capacity/fare; test data proves expiration handling and bounds. Explicitly out of scope: ranking, incentives, offer creation, inventory mutation, voice directives, dashboard, provider calls, and Redis.

#### Codex prompt — 11.1

```text
Implement only Phase 11.1 in Call-to-Cash Risk Copilot. Read AGENTS.md and the privacy, data-model, state-machine, API/event/error, Phase 11, inventory repository, Prisma schema, and shared Revenue Twin contracts first. Map existing PostgreSQL trip_departures, active inventory_holds, confirmed reservations, and authoritative catalogue facts to RevenueTwinDepartureSnapshot[] with VND integers, observedAt, no PII, verified relation, and inventory-version decision order: existing field, updatedAt, aggregate sequence, minimal migration only if unavoidable. Add focused unit and TEST_DATABASE_URL-backed repository tests. Do not implement ranking, incentives, offers, inventory mutation, voice, dashboard, provider calls, Redis, or unrelated refactors. Update docs/contracts only if a real contract change is required. Report discovery, files, authority/privacy, migration, exact tests, failures, remaining work, and verdict. Do not commit or push.
```

### 11.2 — Deterministic Overflow Recommendation Engine

Input/output: `demand context + primary snapshot + candidate snapshots → RevenueTwinEvaluationResult`. A primary with capacity produces `PRIMARY_AVAILABLE`; otherwise return `OVERFLOW_OFFERS_AVAILABLE`, `NO_ELIGIBLE_ALTERNATIVE`, `GROUP_CAPACITY_UNAVAILABLE`, or `POLICY_DISABLED` truthfully.

Apply candidate filters in this exact order: (1) same route; (2) allowed and verified operator; (3) complete group fits; (4) inside customer flexibility; (5) pickup compatibility when the server has a validated pickup; (6) schedule eligibility; (7) valid fare; (8) fresh snapshot; (9) not requested departure. MVP group policy is `KEEP_TOGETHER`.

Rank lexicographically: (1) `OWN_FLEET` before `VERIFIED_PARTNER`; (2) lower absolute time shift; (3) lower required discount; (4) higher remaining capacity; (5) higher potential net recovered revenue; (6) earlier schedule; (7) stable departure ID. This is a deterministic multi-criteria comparator, not an LLM ranker. Filter is `O(n)`, sort is `O(n log n)`, and top three selection is `O(1)` after sort.

```text
eligible = candidates.filter(inExactOrder)
scored = eligible.map(c => calculatePolicyBoundedTerms(c))
sorted = scored.sort(lexicographicComparator)
return evaluation(statusFor(primary, sorted, policy), offers: sorted.slice(0, 3))
```

Tests: each ordered exclusion, no split group, no unverified partner, fixed/preferred/flexible windows, stable tie breaks, permutation invariance, max three offers, and all output schemas. Property invariants: no selected candidate violates a filter; identical input gives identical result; output does not mutate snapshots; primary availability does not manufacture overflow offers.

#### Codex prompt — 11.2

```text
Implement only Phase 11.2 after confirming 11.1 snapshot evidence. Read governing docs and current shared/domain Revenue Twin contracts. Build a pure deterministic evaluation engine with the documented filter order, KEEP_TOGETHER policy, five statuses, lexicographic comparator, top-three limit, and no LLM ranking. Add exhaustive unit/property-style tests including permutation and tie-break cases. Do not add persistence, routes, offers, holds, voice, dashboard, providers, Redis, or migration unless a contract correction is unavoidable. Keep current authority boundaries and report the standard slice evidence; do not commit or push.
```

### 11.3 — Incentive Policy Engine

All tier values are server-owned policy, configurable by time shift, alternative fill rate, and operator relation. The deterministic calculation is:

```text
amountCap = maxDiscountAmountMinor
percentageCap = floor(originalFareAmountMinor × maxDiscountBasisPoints ÷ 10,000)
policyCap = min(amountCap, percentageCap)
proposedDiscount = timeShiftTierDiscount + occupancyTierDiscount + operatorAdjustment
discountAmountMinor = min(proposedDiscount, policyCap)
finalFareAmountMinor = max(minimumFinalFareAmountMinor, originalFareAmountMinor - discountAmountMinor)
```

The engine must reconcile the minimum-fare floor with the cap (never create a negative fare or claim a discount that does not produce the stated final fare), fail closed for disabled/invalid policy, and attach only allowed reason codes. Revenue calculations are:

```text
potentialGrossRevenue = originalFare × passengerCount
potentialDiscountCost = discount × passengerCount
potentialNetRevenueRecovered = finalFare × passengerCount
```

Tests cover each tier, floor/caps/rounding, disabled policy, relation restrictions, zero values, large integer bounds, reason codes, and deterministic version behavior. Acceptance requires reproducible terms from a policy version and no GPT-5 mini/browser-controlled discount.

#### Codex prompt — 11.3

```text
Implement only Phase 11.3. Use existing Revenue Twin schemas and document any minimal policy-contract extension before code. Create a pure deterministic server-owned incentive engine with exact integer-VND formula, configurable time/fill/relation tiers, caps, floor reconciliation, allowed reasons, and potential revenue calculations. Add focused tests for caps, rounding, floors, policy disablement, and authority. GPT-5 mini and browser must not choose discounts. Do not add persistence/routes/holds/voice/dashboard/providers/Redis or commit/push. Return the standard slice report.
```

### 11.4 — Offer Persistence, Acceptance and Inventory Revalidation

This is the most safety-critical slice. Recommended entities are `revenue_twin_evaluations`, `revenue_twin_offers`, and `revenue_twin_offer_decisions`. At minimum persist IDs; call/booking ownership; policy/version and evaluated timestamp; input/snapshot provenance; safe offer terms/rank/expiry; decision status/time/idempotency; audit/outbox correlation; and created/updated times. Do not persist raw model prompt/response as offer authority.

Offer status: `OPEN`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `SUPERSEDED`, `REQUIRES_REEVALUATION`.

The acceptance transaction is indivisible:

```text
1. load evaluation and offer
2. validate call/booking ownership
3. validate idempotency
4. validate OPEN status
5. validate TTL
6. reload current incentive policy
7. validate policy version
8. reload current inventory
9. compare inventory version
10. verify full group still fits
11. create existing inventory hold
12. update booking departure and fare from stored offer
13. mark selected offer ACCEPTED
14. mark competing offers SUPERSEDED
15. append audit and outbox events
16. commit atomically
17. return next action
```

MVP stale rule: **any `inventoryVersion` mismatch → `REVENUE_TWIN_REEVALUATION_REQUIRED`**. Same idempotency key with same input replays the same result; same key with changed input conflicts. Acceptance body contains identifiers only.

Implement/document the four future routes in [Events, errors, and API behavior](#6-events-errors-and-api-behavior), complete API/event/error changes together, and reuse the existing hold transaction rather than creating a parallel reservation system. Tests include DB rollback/recovery, API envelope validation, stale expiry/policy/version paths, replay/conflict, outbox, refresh recovery, and concurrency: **two customers accept the last seat → at most one hold succeeds → no oversell**.

#### Codex prompt — 11.4

```text
Implement only Phase 11.4, the safety-critical persisted-offer slice. First read the privacy, data model, state machines, API/event/error contracts, existing inventory/idempotency/outbox services, and Phase 11 handbook. Add documented entities/migration only as necessary; persist evaluations/offers/decisions; implement identifier-only routes with shared schemas; and execute the specified acceptance transaction atomically using existing inventory holds. Enforce any-version mismatch => REVENUE_TWIN_REEVALUATION_REQUIRED and durable idempotent replay/conflict. Add DB/API/concurrency tests proving two customers cannot oversell the last seat. Do not add voice/dashboard/Redis/provider changes or commit/push. Give the standard evidence report.
```

### 11.5 — Voice Negotiation Runtime Directive

Create a server-approved `RevenueTwinVoiceDirective` projection with action, call/evaluation/offer identifiers, safe offer display facts, directive expiry/version, and a safe fallback. Actions are `PRESENT_OVERFLOW_OFFERS`, `ASK_TIME_FLEXIBILITY`, `CONFIRM_SELECTED_OFFER`, `EXPLAIN_REEVALUATION`, and `EXPLAIN_NO_ALTERNATIVE`.

Voice rules: concise natural Vietnamese; one question per turn; at most two verbal offers; never claim a seat is held before acceptance or payment success before verification; never invent discount/departure; distinguish offer from confirmed booking; handle silence/interruption/expiry; and preserve original booking when declined.

Example:

> Dạ chuyến 7 giờ hiện đã hết chỗ. Hệ thống có chuyến 7 giờ 30 cùng tuyến, còn chỗ và được giảm 30.000 đồng, giá còn 170.000 đồng. Anh/chị có muốn chuyển sang chuyến 7 giờ 30 không ạ?

Only final `CUSTOMER` turns may create selection intent. Map “Chốt chuyến đầu tiên.” to ordinal; “Đi chuyến 7 giờ 30.” to departure time; “Được.” to acceptance only with exactly one unambiguous offer; and “Chuyến nào cũng được.” to clarification when multiple offers exist. Tests cover stale/silence/interruption, ambiguity, no overclaim, two-offer limit, Vietnamese templates, final-turn-only intent, and a live validation where server state—not agent prose—drives acceptance.

#### Codex prompt — 11.5

```text
Implement only Phase 11.5 after 11.4 persistence/acceptance is proven. Define a shared safe server-approved RevenueTwinVoiceDirective contract and integrate it into the authoritative call path. Support the five documented actions and Vietnamese rules, selection mapping, final-CUSTOMER-turn-only intent, ambiguity, expiry, interruption, and no-overclaim behavior. Add directive/unit/integration tests and one controlled live validation plan. Do not let the agent create offers, holds, price, payment status, or inventory; do not add dashboard/Redis or commit/push. Report standard slice evidence.
```

### 11.6 — Revenue Recovery Dashboard

Show: overflow evaluations; offers generated/accepted/declined/expired; reevaluations; recoverable/accepted passengers; potential gross revenue; potential discount cost; potential net recovered revenue; accepted-offer revenue; secured recovered revenue; acceptance rate; discount efficiency; fleet fill-rate impact; and lost-demand reduction.

Definitions:

```text
offer acceptance rate = accepted offers ÷ presented offers
discount efficiency = secured recovered revenue ÷ discount cost
secured recovered revenue = revenue associated with an accepted Revenue Twin offer
only after the existing authoritative booking/payment condition succeeds
```

The four primary cards are **Revenue Recovered**, **Bookings Saved**, **Fleet Fill Rate**, and **Offer Acceptance Rate**. Show before/after departure occupancy and a privacy-safe activity timeline. Read APIs must use safe aggregates/projections and existing ownership/authorization boundaries—no raw transcript, phone, wallet, full signature, or model data.

No-double-counting rules: one accepted offer has one canonical decision; the same booking/payment may contribute once; retry/replay/outbox events deduplicate by durable identifiers; potential, accepted, and secured facts remain separate; a refund/failure/reversal follows authoritative booking/payment state rather than dashboard inference. Responsive/mobile UI must retain readable labels and values, keyboard navigation, semantic headings/tables, contrast, screen-reader names, and no color-only meaning.

Tests: aggregation, deduplication, potential-vs-secured separation, filters/time windows, before/after occupancy, empty/loading/error states, privacy projection, responsive/accessibility checks, and API contract tests. Acceptance requires no secured number before authoritative verification.

#### Codex prompt — 11.6

```text
Implement only Phase 11.6 after persisted Revenue Twin lifecycle evidence exists. Add documented safe read APIs and a responsive accessible dashboard showing the specified metrics/cards, before/after occupancy, and safe timeline. Build aggregates from canonical evaluation/offer/booking/payment records with deduplication and strict separation of potential, accepted, and secured revenue. Add API, aggregation, web, responsive, accessibility, and privacy tests. Do not expose PII/model/payment secrets, introduce new pricing/inventory authority, add Redis, or commit/push. Report standard slice evidence.
```

### 11.7 — Multi-demand Simulation

The deterministic demo fixture is: 07:00 capacity 20/available 5; 07:30 capacity 20/available 12; 08:00 capacity 20/available 15; ten requests target 07:00. Allowed persona inputs are passenger count, time flexibility, deposit readiness, urgency, pickup compatibility, and request timestamp—never protected attributes.

MVP allocation: (1) preserve FCFS primary capacity; (2) do not preempt holds; (3) overflow remaining requests; (4) create ranked alternatives per customer; (5) simulate acceptance; (6) calculate recovered revenue and fill-rate changes. A transparent optional Booking Commitment Assessment may use completeness 0–30, deposit readiness 0–25, time constraint 0–20, group integrity 0–15, and request age 0–10. It may affect presentation only; it cannot revoke a hold.

Prohibited: income inference, wallet balance, device value, neighborhood, gender, ethnicity, social class, and predicted ability to pay. Every run has a deterministic seed and explicit mode: `DRY_RUN`, `DEMO_FIXTURE`, or `ISOLATED_TEST_DATABASE`; no real provider calls by default.

Tests cover seed reproducibility, FCFS, no hold preemption/oversell/group split, scenario isolation, prohibited attribute absence, simulated acceptance determinism, and reconciliation of request/offer/acceptance/revenue/fill-rate totals. Acceptance requires a visible simulation label and metrics that reconcile to the fixture.

#### Codex prompt — 11.7

```text
Implement only Phase 11.7 after the prior lifecycle is complete. Add a deterministic seeded simulation using DRY_RUN, DEMO_FIXTURE, and ISOLATED_TEST_DATABASE modes, the documented 07:00/07:30/08:00 fixture, allowed persona fields, FCFS primary allocation, no preemption, ranked alternatives, simulated acceptance, and reconciled metrics. Never call real providers by default or use prohibited attributes. Add deterministic, invariant, isolation, and reconciliation tests. Do not alter production-like inventory outside the explicit isolated mode and do not commit/push. Report standard slice evidence.
```

## 8. Advanced algorithm roadmap

MVP algorithms are deterministic eligibility filtering, lexicographic ranking, policy-tier incentive calculation, transactional revalidation, FCFS primary allocation, and seeded demand simulation.

Future candidates are greedy multi-customer allocation, bipartite matching, integer linear programming, stochastic demand optimization, robust optimization, DURO research, acceptance-probability prediction, and historical incentive calibration. None is implemented, proven best, or required for MVP. Poisson is not universally the best transport-demand model, and DURO is a research candidate, not a shipping claim.

All advanced optimizers remain behind the same contracts and authorities. Their conceptual objective is:

```text
maximize: secured revenue + accepted passengers - discount cost - time-deviation penalty
subject to: departure capacity, group integrity, customer flexibility, existing holds,
operator eligibility, fairness constraints
```

## 9. Testing and quality gates

Test pyramid: shared schema tests; pure domain tests; repository tests; DB integration tests; concurrency tests; API tests; web tests; voice-directive tests; simulation tests; and manual provider smoke. Global invariants:

- [ ] No oversell.
- [ ] No hold preemption.
- [ ] No group splitting.
- [ ] No unverified partner.
- [ ] No browser price/capacity authority.
- [ ] No LLM price/inventory authority.
- [ ] No stale offer acceptance.
- [ ] No duplicate hold.
- [ ] No potential revenue reported as secured.
- [ ] No PII in events or dashboard.
- [ ] Existing Phase 0–10 behavior remains green.

Standard checks:

```powershell
corepack pnpm format:check
corepack pnpm db:validate
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

DB-backed work must use an isolated database URL, e.g. set `TEST_DATABASE_URL` for the test process, run the documented test schema/migrations only against it, seed deterministic fixture rows, then run the relevant repository/concurrency suite. Never put a real secret in docs. Existing baseline debt must be reported exactly, not hidden by Phase 11 work.

## 10. Judge demo and pitch

### Demo script

Fleet state: route **Đà Nẵng → Nha Trang** on **2026-06-28**. 07:00 has 2 available seats for a 3-passenger request; 07:30 has 12 available seats; 08:00 has 15 available seats. Base fare is 420,000 VND per seat. Policy maximum discount is 30,000 VND per seat; offer TTL is 120 seconds.

1. Customer: “Alo, tôi muốn đặt 3 vé từ Đà Nẵng đi Nha Trang ngày 28 tháng 6 lúc 7 giờ.”
2. The final customer turn enters the existing Phase 10 strict-schema path; server resolves requested 07:00.
3. Snapshot reports 07:00 has only 2 seats for a 3-passenger group; deterministic engine selects eligible 07:30 and calculates the policy-safe incentive.
4. The agent presents the server directive for 07:30, never saying it is held.
5. Customer explicitly accepts; server reloads offer, policy, and inventory, then creates the existing hold transactionally.
6. Existing agreement/payment gate proceeds. The server creates a Solana Pay Devnet request → customer signs → server verifies transaction → proof and Trust Receipt continue. No smart-contract escrow is claimed.
7. Dashboard shows booking saved 1, potential revenue, discount cost, secured recovered revenue only after the existing authority succeeds, and fill-rate improvement.

### Pitch narrative

> Call-to-Cash is not only an AI booking chatbot.
>
> It is a real-time Fleet Revenue Twin.
>
> When a hot departure is full, it does not reject demand. It reads live fleet inventory, creates a policy-safe alternative, negotiates through low-latency voice, secures the seat transactionally, verifies the deposit on Solana, and measures recovered revenue.

Judge proof points: **business impact** (otherwise-lost demand is measured); **technical safety** (server authority, idempotency, no oversell, privacy); and **low-friction user experience** (one natural voice decision, truthful alternatives).

## 11. Risks and mitigations

| Risk                                     | Mitigation                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Invented capacity                        | Snapshot only from authoritative DB/catalogue; browser/LLM cannot supply it.      |
| Stale offers                             | TTL, policy/version checks, any-version-mismatch reevaluation, atomic hold.       |
| Discount margin damage                   | Integer caps/floors, versioned server policy, dashboard separation.               |
| Customer discrimination                  | Allowed inputs only; prohibited-attribute tests and audit.                        |
| Overselling                              | Existing lock/hold transaction and last-seat concurrency test.                    |
| Voice overclaim                          | Server-approved directive, final-turn intent, template tests.                     |
| Double counting                          | Canonical persisted IDs and payment-condition reconciliation.                     |
| Provider outage                          | Truthful no-alternative/fallback; no invented provider success.                   |
| Partner trust                            | Authoritative verified-partner relation only; no unverified partner.              |
| PII leakage                              | Shared safe schemas/events, projection reviews, no transcript/phone in dashboard. |
| Simulation accidentally using production | Explicit mode/seed/isolation; no real provider calls by default.                  |

## 12. Commit and completion strategy

Recommended focused commits:

```text
feat(revenue-twin): add authoritative departure snapshots
feat(revenue-twin): implement deterministic overflow ranking
feat(revenue-twin): add incentive policy engine
feat(revenue-twin): persist and accept overflow offers
feat(revenue-twin): add voice negotiation directives
feat(revenue-twin): add revenue recovery dashboard
test(revenue-twin): add multi-demand simulation
docs(revenue-twin): close phase 11
```

Do not mix unrelated dirty files. Phase 11 may be recorded **COMPLETE / PASS** only when:

- [ ] 11.0 contracts complete.
- [ ] 11.1 authoritative snapshots complete.
- [ ] 11.2 deterministic overflow engine complete.
- [ ] 11.3 incentive policy complete.
- [ ] 11.4 offer persistence and acceptance complete.
- [ ] 11.5 voice directive complete.
- [ ] 11.6 dashboard complete.
- [ ] 11.7 simulation complete.
- [ ] DB-backed tests pass.
- [ ] Concurrency test proves no oversell.
- [ ] Root quality gates pass or approved baseline debt is explicit.
- [ ] Real Agora voice negotiation works.
- [ ] Solana verification remains server-authoritative.
- [ ] Refresh recovery restores Revenue Twin state.
- [ ] Dashboard separates potential and secured revenue.
- [ ] No secrets or PII are exposed.

The implementation and automated gates are complete locally. A controlled Agora provider smoke remains an external operational proof; it is not substituted by replay/demo evidence.

## 13. Umbrella Codex Prompt — Execute Remaining Phase 11

```text
Execute the remaining Call-to-Cash Risk Copilot Phase 11 roadmap in controlled slices: 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7. Read AGENTS.md, this handbook, and all affected governing documentation before each slice; inspect the current repository state instead of assuming a prior slice landed. Implement one slice at a time, verify it, report it, and wait for approval before starting the next.

Do not implement every slice in one uncontrolled change. Do not change Phase 0–10 authority. Do not add Redis/queue prematurely. Do not give LLM ownership of pricing, inventory, or payment. Do not commit or push without explicit approval.

For every slice report exactly:
1. Discovery
2. Slice status
3. Files changed
4. Architecture
5. Authority and privacy
6. Database and migration
7. Tests and exact counts
8. Failures and skipped checks
9. Remaining work
10. Verdict

Use shared schemas before API/web code; update API, event, error, state-machine, data-model, privacy, and operations documentation whenever the slice changes their governed behavior. Preserve existing inventory holds, agreement gates, payment verification, Solana server authority, and truthful demo/live boundaries.
```
