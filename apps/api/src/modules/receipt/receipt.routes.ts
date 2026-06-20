import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ReceiptIdSchema } from "@call-to-cash/shared";

import type { ApiDependencies } from "../../bootstrap/types.js";
import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { successEnvelope } from "../../platform/http/api-response.js";
import { parseWithSchema } from "../../platform/http/validation.js";
import { createReceiptHandlers } from "./receipt.handlers.js";

const ReceiptParamsSchema = z.object({ receiptId: ReceiptIdSchema }).strict();
const ReceiptVerifyQuerySchema = z
  .object({
    candidateDepositAmountMinor: z.coerce.number().int().positive().optional()
  })
  .strict();

export function registerReceiptRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  const handlers = createReceiptHandlers(dependencies.databaseClient);

  app.get("/v1/receipts/:receiptId", async (request) => {
    const params = parseWithSchema(ReceiptParamsSchema, request.params);
    return successEnvelope(request.id, await handlers.get(params.receiptId));
  });

  app.get("/v1/receipts/:receiptId/verify", async (request) => {
    const params = parseWithSchema(ReceiptParamsSchema, request.params);
    const query = parseWithSchema(ReceiptVerifyQuerySchema, request.query);
    if (query.candidateDepositAmountMinor !== undefined && !dependencies.config.demoMode) {
      throw new ApiCommandError(
        403,
        "AUTH_FORBIDDEN",
        "Candidate agreement verification is available only in demo mode."
      );
    }
    return successEnvelope(request.id, await handlers.verify(params.receiptId, query, request.id));
  });
}
