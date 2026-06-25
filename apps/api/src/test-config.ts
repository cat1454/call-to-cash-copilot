import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true
});

const config = readRuntimeConfig();
console.log("aiProvider:", config.aiProvider);
console.log("apiKey length:", config.aiExtraction.apiKey.length);
console.log("apiKey:", config.aiExtraction.apiKey ? "PRESENT" : "MISSING");
