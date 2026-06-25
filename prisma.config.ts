import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import { defineConfig } from "prisma/config";

// Prisma runs this config while pnpm's filtered package is the working
// directory. Resolve the canonical repository-root .env instead.
loadEnv({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const fallbackDatabaseUrl =
  "postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx ../../prisma/seed.ts"
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl
  }
});
