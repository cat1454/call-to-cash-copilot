# Domain boundary

Pure deterministic booking validation/extraction, risk and payment-gate evaluation, inventory guards, agreement canonicalization, and state transitions live here. It depends only on `@call-to-cash/shared` and must not import Fastify, Prisma, React, provider SDKs, environment variables, network I/O, or cryptographic provider code.

The agreement serializer emits a versioned, privacy-safe canonical JSON string. Hashing, persistence, payment verification, and proof anchoring belong to later server-owned phases.
