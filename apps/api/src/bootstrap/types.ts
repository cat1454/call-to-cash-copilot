import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";

export type BuildAppOptions = {
  databaseClient?: DatabaseClient;
};

export type ApiDependencies = {
  config: RuntimeConfig;
  databaseClient?: DatabaseClient;
  ownedDatabaseClient?: DatabaseClient;
};
