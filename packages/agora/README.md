# Agora integration

This package is the server-only Agora boundary: RTC token issuance, Conversation AI Engine start/stop requests, provider event validation, and transcript normalization. It owns no booking, risk, payment, receipt, or Solana policy.

Final transcript events retain the stable provider turn id for durable database idempotency. Interim turns are UI-only and never persisted through this package.
