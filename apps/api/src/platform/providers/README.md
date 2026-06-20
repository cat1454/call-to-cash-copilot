# Platform providers

## Purpose

Own technical provider interfaces and runtime provider selection.

## Owns

Payment provider interfaces, the deterministic mock payment provider, and provider registry/factory behavior.

## Public routes / entry points

Provider interfaces and registry functions consumed by payment commands.

## Inputs and outputs

Inputs are server-created payment intents and provider observations. Outputs are normalized provider verification results.

## Allowed dependencies

Provider packages, `@call-to-cash/shared`, runtime config, and local platform helpers.

## Forbidden dependencies

No booking completeness, payment-gate, inventory, agreement lifecycle, or receipt policy decisions.

## Transaction and event rules

Providers return observations/results; payment module commands own transactions and event append.

## Privacy / security rules

Providers must not expose private keys, webhook secrets, raw PII, or raw transcript data to browser-facing projections.

## Invariants

- Mock provider remains deterministic under `DEMO_MODE`.
- Future Solana provider must feed the same payment command path.

## Tests that protect this module

Future mock provider and provider registry unit tests plus payment integration tests.

## Future extension points

`SolanaDevnetPaymentProvider` and later mainnet provider after explicit approval.

## Non-goals

No separate Solana business route and no bypass around locked agreements or open payment gate.
