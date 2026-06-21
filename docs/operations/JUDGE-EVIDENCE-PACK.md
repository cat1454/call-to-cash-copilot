# Judge Evidence Pack

Capture only the minimum proof below. Mask phone numbers, wallet addresses, transaction signatures, hashes, provider identifiers, and any transcript text not needed for the demonstration.

| Artifact | What it proves | Format | Redact |
|---|---|---|---|
| Browser permission + live badge | Microphone consent and honest Agora mode | live demo or short video | device names, browser profile |
| Customer and agent turns | Bidirectional live conversation and final transcript | short video | raw phone and unrelated transcript |
| Risk/gate update | Server-authoritative decision changes after final turns | screenshot/video | PII and internal evidence IDs |
| Agreement confirmation | One version is explicitly locked before payment | screenshot | full canonical payload |
| Solana request | Devnet-only payment request exists | live demo | full recipient/reference/QR in published images |
| Verified payment | Server, not wallet callback, confirms evidence | screenshot | full signature and wallet address |
| Trust Receipt | Proof and receipt are issued once after verification | screenshot | full hash/signature/PII |
| Refresh recovery | Durable state survives browser refresh | short video | local URLs containing sensitive query data |
| Optional mismatch | Candidate mismatch routes to manual review without mutating agreement | screenshot | candidate/full agreement payload |

Never capture `.env`, terminal secret values, Agora tokens, customer secrets, webhook signatures, database URLs, seed phrases, private keys, full wallet data, or raw provider payloads.
