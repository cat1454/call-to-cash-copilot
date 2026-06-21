# Solana integration

Phase 8 Devnet-only provider boundary for:

- random base58 32-byte payment references;
- privacy-safe versioned memos;
- Solana Pay transfer URLs;
- Devnet JSON-RPC signature discovery by opaque payment reference plus transaction/status lookup;
- native SOL recipient, lamport amount, reference, execution, and confirmation verification.

This package owns no booking, risk, state-transition, persistence, proof, or receipt policy. It accepts no private key and has no mainnet/trading/token behavior. RPC tests use deterministic fixtures and do not require live Devnet.
