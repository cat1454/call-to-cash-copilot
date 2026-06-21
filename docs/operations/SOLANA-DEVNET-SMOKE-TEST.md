# Solana Devnet Payment Provider Smoke Test

> **Scope:** optional manual Phase 8 verification. Devnet is demonstration proof only, not real commercial settlement. This runbook does not use or request a server-held private key.

## Preconditions

- PostgreSQL is running and migrations/seed are current.
- A browser wallet is explicitly set to Solana Devnet and has Devnet SOL.
- `SOLANA_RECIPIENT_PUBLIC_KEY` is a public Devnet recipient address controlled for the demo.
- Never paste a seed phrase or private key into `.env`, the API, browser form, logs, or this runbook.

## Configure

```env
DEMO_MODE=true
PAYMENT_PROVIDER=solana_devnet
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_RECIPIENT_PUBLIC_KEY=<public-devnet-recipient>
SOLANA_DEMO_AMOUNT_LAMPORTS=1000000
SOLANA_PAYMENT_LABEL=Call-to-Cash Demo
```

Start the API/web applications and confirm readiness:

```powershell
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
Invoke-RestMethod http://127.0.0.1:3001/ready
```

`/ready` must report `payment: solana_devnet`. If the recipient is missing or invalid, readiness must fail; do not fall back silently.

## Execute

1. Run the normal replay flow until the agreement is locked and the payment gate opens.
2. Confirm the drawer says **Solana Devnet proof payment** and explicitly says it is not real commercial settlement.
3. Open the server-provided Solana Pay URL in the Devnet wallet.
4. Verify the wallet request shows the configured recipient, configured demo SOL amount, and opaque reference. Reject the request if it contains phone, email, name, route, transcript, or full agreement data.
5. Sign and submit the Devnet transfer in the wallet.
6. Return to the drawer. It polls the API automatically; no transaction signature is pasted into the browser.
7. Wait for server discovery by the opaque payment reference and authoritative verification. A not-found/unconfirmed result is non-final and polling continues until confirmation or intent expiry.

## Verify

- The API, not the wallet callback, moves payment to `CONFIRMED`.
- The transaction record has `chain=SOLANA_DEVNET`, the signature, slot/block time when available, observed lamports, recipient, reference, confirmation status, and minimized match metadata.
- Exactly one proof record and one Trust Receipt link to the verified transaction.
- The proof anchor type is `SOLANA_REFERENCE`.
- Receipt and SSE/browser projections contain masked contact only and no raw transcript/full agreement/provider RPC body.
- Reusing the signature for another payment intent returns `PAYMENT_TRANSACTION_REUSED` and creates no second receipt.

## Failure checks

- Random/missing signature → `PAYMENT_TRANSACTION_NOT_FOUND` or validation failure; no receipt.
- Processed but unconfirmed signature → `PAYMENT_TRANSACTION_UNCONFIRMED`; retryable, no receipt.
- Failed chain transaction → `PAYMENT_TRANSACTION_FAILED`; no receipt.
- Wrong recipient/lamports/reference → matching `PAYMENT_*_MISMATCH`; manual review, no verified receipt.
- RPC timeout/unavailable → `SOLANA_RPC_TIMEOUT`/`SOLANA_RPC_UNAVAILABLE`; retryable, never optimistic success.

Record the transaction signature and result in a private test log only when needed. Do not add wallet secrets or raw customer data. State “live Devnet executed” in a release report only after completing this runbook with an actual transaction.
