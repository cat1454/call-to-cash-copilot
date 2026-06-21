# Voice session adapter

This module only orchestrates Agora Conversation AI Engine and hands final provider turns to the canonical `append-transcript-turn` command. It does not make booking, risk, payment, receipt, or Solana decisions.

`POST /provider-events` is server-to-server only and requires the configured HMAC signature. Interim turns are deliberately returned as non-persisted.
