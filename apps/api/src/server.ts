import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { readRuntimeConfig } from "@call-to-cash/config";

import { buildApp } from "./app.js";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true
});

const config = readRuntimeConfig();
const app = buildApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
