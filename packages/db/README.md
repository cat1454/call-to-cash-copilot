# Database boundary

Owns the Prisma 7 client, PostgreSQL repositories, transaction helpers, generated client boundary, and migration/seed commands.

Phase 4 provides:

- the production-shaped schema in `prisma/schema.prisma`;
- the reviewed initial migration in `prisma/migrations/`;
- a row-locked, serializable inventory repository with idempotent holds and server-time expiry;
- a privacy-safe receipt trace projection;
- a deterministic, idempotent demo provider/departure seed;
- PostgreSQL integration coverage enabled by `TEST_DATABASE_URL`.

Business rules and state-transition policy remain in `@call-to-cash/domain`. API/service orchestration arrives in Phase 5 and must call these repositories rather than issuing raw database queries.
