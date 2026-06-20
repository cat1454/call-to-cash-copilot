import type { RuntimeConfig } from "@call-to-cash/config";
import type { DatabaseClient } from "@call-to-cash/db";

import type { Phase5ReplayService } from "../phase5-service.js";

export type BuildAppOptions = {
  databaseClient?: DatabaseClient;
};

export type ApiDependencies = {
  config: RuntimeConfig;
  databaseClient?: DatabaseClient;
  ownedDatabaseClient?: DatabaseClient;
  phase5Service?: Phase5ReplayService;
};
