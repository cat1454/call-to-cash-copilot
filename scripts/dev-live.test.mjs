import assert from "node:assert/strict";
import test from "node:test";

import {
  getLiveServiceCommands,
  getLiveServiceUrls,
  getProcessTreeTermination
} from "./dev-live.mjs";

test("live launcher starts API, strict-port web, and relay from the repository root", () => {
  assert.deepEqual(getLiveServiceCommands("win32"), [
    { label: "API", executable: "corepack.cmd", args: ["pnpm", "dev:api"] },
    {
      label: "Web demo",
      executable: "corepack.cmd",
      args: ["pnpm", "--filter", "@call-to-cash/web", "exec", "vite", "--strictPort"]
    },
    { label: "Agora RTM relay", executable: "corepack.cmd", args: ["pnpm", "dev:rtm-relay"] }
  ]);
});

test("live launcher derives readiness URLs from the selected server and browser config", () => {
  assert.deepEqual(
    getLiveServiceUrls(
      { AGORA_RTM_RELAY_URL: "http://127.0.0.1:4111" },
      { VITE_API_BASE_URL: "http://127.0.0.1:4101" }
    ),
    {
      apiReady: "http://127.0.0.1:4101/ready",
      relayHealth: "http://127.0.0.1:4111/health",
      web: "http://localhost:5173"
    }
  );
});

test("Windows launcher cleanup terminates the complete spawned process tree", () => {
  assert.deepEqual(getProcessTreeTermination(1234, "win32"), {
    executable: "taskkill",
    args: ["/PID", "1234", "/T", "/F"]
  });
  assert.equal(getProcessTreeTermination(1234, "linux"), null);
});
