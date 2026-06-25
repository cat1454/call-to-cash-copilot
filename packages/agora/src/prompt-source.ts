import { readFileSync } from "node:fs";

export const CTC_AGORA_PROMPT_ID = "CTC-AGORA-VI-V1";

const promptPath = new URL("../prompts/call-to-cash-vi-v1.md", import.meta.url);

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function loadCtcAgoraV1Prompt(): string {
  const prompt = readFileSync(promptPath, "utf8").trim();
  if (!prompt.includes(`Prompt ID: ${CTC_AGORA_PROMPT_ID}`)) {
    throw new Error(`Versioned Agora prompt is missing ${CTC_AGORA_PROMPT_ID}.`);
  }
  return prompt;
}

export function withCtcAgoraV1Prompt(properties: Record<string, unknown>): Record<string, unknown> {
  const asr = objectOrEmpty(properties.asr);
  return {
    ...properties,
    // The product currently supports Vietnamese booking calls only. Keep this
    // server-side default even when a deployed pipeline property only contains
    // its identifier, so ASR does not fall back to the provider's locale guess.
    asr: { ...asr, language: "vi-VN" },
    // Model, endpoint, and provider settings belong to the configured Agora pipeline.
    // The application supplies only its server-owned behavior prompt.
    llm: { system_messages: [{ role: "system", content: loadCtcAgoraV1Prompt() }] }
  };
}
