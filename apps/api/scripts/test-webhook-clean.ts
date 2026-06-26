import { config as loadEnv } from "dotenv";
import { readRuntimeConfig } from "@call-to-cash/config";

loadEnv({ path: "d:/call-to-cash-copilot/.env" });
const config = readRuntimeConfig();

async function run() {
  const auth = "Bearer ";
  const body = {
    model: config.aiExtraction.model,
    messages: [{ role: "user", content: "Hello" }]
  };

  try {
    const res = await fetch("http://127.0.0.1:3001/v1/agora/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body)
    });
    console.log(res.status);
    console.log("Body:", await res.text());
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.error);
