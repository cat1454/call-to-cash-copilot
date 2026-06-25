# Phase 11 — Fleet Revenue Twin

> **Current slice:** Phase 11 MVP — IMPLEMENTED / AUTOMATED VERIFICATION PASSED
> **Shipping capability:** Scenario-Robust Revenue Rebalancing Optimizer — Priority Allocation, Dynamic Incentive, and Overflow Routing

## Product boundary

Fleet Revenue Twin is a server-authoritative demand-orchestration layer. When a primary departure cannot satisfy demand, it may produce a bounded list of explainable alternatives. It is neither a chatbot capability nor an LLM-owned decision process.

`LLM interprets. Revenue Twin recommends. Domain validates. Inventory commits. Customer confirms. Payment verifies.`

The MVP supports same-route alternatives only, keeps the complete passenger group together, respects customer time flexibility, and may consider own-fleet or verified-partner departures. A recommendation never reserves capacity.

## Revenue meanings

- **Potential revenue** is calculated when a valid offer is generated. It is not confirmed or secured.
- **Accepted-offer revenue** exists only after the customer accepts and current policy plus inventory revalidation succeed.
- **Secured revenue** exists only after the existing authoritative booking and payment conditions succeed.

## Deterministic MVP ranking

Filter, in order: same route; allowed operator relation; verified-partner status where relevant; full group capacity; time flexibility; pickup compatibility; policy-permitted incentive; valid final fare.

Rank feasible alternatives by own fleet first, lower absolute time shift, lower discount, higher post-group capacity, higher potential net recovery, earlier departure, then departure ID. This is a versioned MVP policy, not a permanent optimizer rule.

## Safety invariants

- Existing holds are never revoked or preempted.
- Offer acceptance reloads server-owned offer data and rechecks inventory version and policy version.
- Stale, expired, or changed offers require reevaluation.
- No group splitting, customer-priority reallocation, forecasting, dynamic pricing, partner settlement, or autonomous preemption is in Phase 11.0.
- Voice may explain only server-approved offer facts.
- Revenue Twin cannot bypass agreement confirmation, payment gate, payment verification, proof, or Trust Receipt issuance.

## Implemented lane sequence

11.1 demand and departure snapshot; 11.2 deterministic recommendation; 11.3 incentive policy; 11.4 offer acceptance and inventory revalidation; 11.5 server-approved voice directive; 11.6 safe dashboard projection; 11.7 controlled multi-demand simulation. Demo mode is verified; controlled live Agora validation remains an operational follow-up.
