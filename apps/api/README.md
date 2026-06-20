# API application boundary

This directory contains the Fastify/TypeScript composition root for Call-to-Cash. Phase 1 implements only health/readiness endpoints and safe response envelopes.

Business rules belong in `@call-to-cash/domain`, durable access belongs in `@call-to-cash/db`, and provider integrations remain adapters. The API must never treat browser state or provider callbacks as transaction authority.
