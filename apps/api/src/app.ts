import Fastify, { type FastifyInstance } from "fastify";

import { readRuntimeConfig, type RuntimeConfig } from "@call-to-cash/config";

import { createDependencies } from "./bootstrap/create-dependencies.js";
import { registerPlugins } from "./bootstrap/register-plugins.js";
import { registerRoutes } from "./bootstrap/register-routes.js";
import type { BuildAppOptions } from "./bootstrap/types.js";

export function buildApp(
  config: RuntimeConfig = readRuntimeConfig(),
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Redact sensitive headers and fields before they reach log sinks.
      redact: ["req.headers.authorization", "req.headers.cookie"]
    }
  });

  const dependencies = createDependencies(config, options);
  registerPlugins(app, dependencies);
  registerRoutes(app, dependencies);

  return app;
}
