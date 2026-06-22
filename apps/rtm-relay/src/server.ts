import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import Fastify from "fastify";
import { z } from "zod";

import { readRelayConfig } from "./config.js";
import { AgoraRtmBrowserRelay } from "./rtm-browser-relay.js";
import { verifyJsonPayload } from "./signature.js";

const StartSessionSchema = z
  .object({
    callId: z.string().regex(/^call_[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/u),
    channelName: z.string().min(1).max(64),
    sessionId: z.string().min(1).max(256),
    agentUid: z.number().int().positive(),
    token: z.string().min(1)
  })
  .strict();

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true
});

const config = readRelayConfig();
const relay = new AgoraRtmBrowserRelay(config);
const app = Fastify({
  logger: { redact: ["req.headers.x-ctc-relay-signature", "req.body.token"] }
});

app.setErrorHandler((error, request, reply) => {
  const safeError = error instanceof Error ? error : new Error("Unknown relay error");
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === 401
      ? 401
      : 503;
  request.log.error(
    { errorName: safeError.name, errorMessage: safeError.message.slice(0, 300) },
    "RTM relay request failed"
  );
  return reply.code(statusCode).send({
    success: false,
    error: { code: "RELAY_UNAVAILABLE", message: "Live transcript relay is unavailable." }
  });
});

function requireControlSignature(payload: unknown, signature: string | undefined): void {
  if (!verifyJsonPayload(config.controlSecret, payload, signature)) {
    throw Object.assign(new Error("Relay command was rejected."), { statusCode: 401 });
  }
}

app.get("/health", async () => ({ status: "ok", transcript: relay.getStats() }));

app.post("/v1/relay/sessions", async (request, reply) => {
  requireControlSignature(
    request.body,
    typeof request.headers["x-ctc-relay-signature"] === "string"
      ? request.headers["x-ctc-relay-signature"]
      : undefined
  );
  const session = StartSessionSchema.parse(request.body);
  await relay.start(session);
  return reply.code(202).send({ accepted: true });
});

app.delete("/v1/relay/sessions/:callId", async (request, reply) => {
  const params = z
    .object({ callId: z.string().min(1) })
    .strict()
    .parse(request.params);
  requireControlSignature(
    { callId: params.callId },
    typeof request.headers["x-ctc-relay-signature"] === "string"
      ? request.headers["x-ctc-relay-signature"]
      : undefined
  );
  await relay.stop(params.callId);
  return reply.code(202).send({ accepted: true });
});

const shutdown = async () => {
  await relay.close();
  await app.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
