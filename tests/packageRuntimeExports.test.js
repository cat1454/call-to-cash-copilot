import assert from "node:assert/strict";
import test from "node:test";

const REQUIRED_EXPORTS = {
  shared: ["VerifyPaymentRequestSchema", "EventEnvelopeSchema"],
  config: ["readRuntimeConfig"],
  domain: ["evaluatePaymentGate"],
  db: ["createPrismaClientFromEnvironment", "reserveInventory"],
  solana: ["SolanaDevnetPaymentProvider"],
  agora: ["AgoraAdapterError", "normalizeTranscriptEvent"],
  ai: []
};

for (const [packageName, exportNames] of Object.entries(REQUIRED_EXPORTS)) {
  test(`@call-to-cash/${packageName} runtime exports match API requirements`, async () => {
    const runtime = await import(`../packages/${packageName}/dist/index.js`);
    for (const exportName of exportNames) {
      assert.equal(
        exportName in runtime,
        true,
        `packages/${packageName}/dist is missing ${exportName}; rebuild the package before booting the API`
      );
    }
  });
}
