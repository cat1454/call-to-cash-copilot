# API application boundary

This directory contains the Fastify/TypeScript composition root for Call-to-Cash. Phase 5 implements PostgreSQL-backed readiness, replay call/transcript/risk/booking routes, durable SSE recovery, agreement locking, deterministic mock payment verification, proof creation, and Trust Receipt reads.

Business rules belong in `@call-to-cash/domain`, durable access belongs in `@call-to-cash/db`, and provider integrations remain adapters. The API must never treat browser state or provider callbacks as transaction authority.

The normal call-events endpoint is a long-lived SSE stream. `?snapshot=true` is reserved for finite diagnostic and recovery reads. Phase 5 deliberately uses replay extraction and a deterministic mock payment provider; Agora, Solana, optional LLM extraction, authentication, and the Phase 6 web adapter remain separate work.
