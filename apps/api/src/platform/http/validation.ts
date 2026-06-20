import type { z, ZodType } from "zod";

import { ApiCommandError } from "./api-command-error.js";

export function parseWithSchema<T extends ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiCommandError(400, "VALIDATION_ERROR", "Request validation failed.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  return parsed.data;
}
