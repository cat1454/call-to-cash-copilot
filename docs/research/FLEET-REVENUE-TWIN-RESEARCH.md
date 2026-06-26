# Fleet Revenue Twin Research Boundary

## Verified repository facts

- `trip_departures` plus active/consumed `inventory_holds` are the authoritative source for capacity; the inventory repository uses a locked transactional hold path.
- Booking confirmation, payment creation, payment verification, proof, and Trust Receipt remain separate existing authorities.
- Currency uses VND integer minor units; public API/event schemas are strict Zod contracts.
- Solana remains: server creates a Solana Pay Devnet payment/deposit request, customer signs, server verifies on-chain, then the existing proof and Trust Receipt flow continues.

## Product hypotheses

- Same-route overflow offers may preserve demand that would otherwise be lost.
- A deterministic, explainable comparator is preferable to an opaque optimizer for the first MVP.
- Potential recovery is useful operationally but must never be reported as secured revenue.

## Demo assumptions

- Phase 11.0 contains contracts only. No live partner catalogue, provider status, offer persistence, route, dashboard, or voice integration exists.
- Any later multi-demand scenario is explicitly simulated and cannot mutate authoritative production-like inventory without a documented mode.

## Future research

- Forecasting quality, demand distributions, and optimization algorithms require evidence before adoption.
- No claim is made that Poisson, DURO, linear programming, or any model is universally best.
- No escrow program, DeFi integration, live partner-fleet integration, or autonomous priority allocation exists in the current product.
