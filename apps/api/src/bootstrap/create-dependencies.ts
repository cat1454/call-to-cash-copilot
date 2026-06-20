import type { RuntimeConfig } from "@call-to-cash/config";
import { createPrismaClientFromEnvironment } from "@call-to-cash/db";

import type { ApiDependencies, BuildAppOptions } from "./types.js";

export function createDependencies(
  config: RuntimeConfig,
  options: BuildAppOptions = {}
): ApiDependencies {
  const ownedDatabaseClient =
    options.databaseClient === undefined && process.env.DATABASE_URL !== undefined
      ? createPrismaClientFromEnvironment()
      : undefined;
  const databaseClient = options.databaseClient ?? ownedDatabaseClient;
  return {
    config,
    ...(databaseClient === undefined ? {} : { databaseClient }),
    ...(ownedDatabaseClient === undefined ? {} : { ownedDatabaseClient })
  };
}
