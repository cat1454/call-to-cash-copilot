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
  // Fastify's JSON parser owns the body. This passive listener copies bytes only
  // for the fixed provider webhook so its HMAC never verifies a reserialized body.
  app.addHook("onRequest", (request, _reply, done) => {
    if (request.raw.url?.split("?")[0] !== "/v1/webhooks/agora/conversation-ai") {
      done();
      return;
    }
    const chunks: Buffer[] = [];
    request.raw.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    request.raw.once("end", () => {
      (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
    });
    done();
  });

  const dependencies = createDependencies(config, options);
  registerPlugins(app, dependencies);
  registerRoutes(app, dependencies);

  return app;
}
