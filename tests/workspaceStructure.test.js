import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const workspacePackages = {
  "apps/web": "@call-to-cash/web",
  "apps/api": "@call-to-cash/api",
  "packages/shared": "@call-to-cash/shared",
  "packages/db": "@call-to-cash/db",
  "packages/agora": "@call-to-cash/agora",
  "packages/solana": "@call-to-cash/solana",
  "packages/ai": "@call-to-cash/ai",
  "packages/config": "@call-to-cash/config",
  "packages/domain": "@call-to-cash/domain"
};

const authoritativeDocs = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/architecture/DATA-MODEL.md",
  "docs/architecture/DECISIONS.md",
  "docs/architecture/PIPELINE.md",
  "docs/architecture/STATE-MACHINES.md",
  "docs/contracts/API-CONTRACT.md",
  "docs/contracts/ERROR-CODES.md",
  "docs/contracts/EVENT-CONTRACT.md",
  "docs/operations/DEPLOYMENT.md",
  "docs/operations/LOCAL-SETUP.md",
  "docs/product/BOOKING-CONTRACT.md",
  "docs/product/RISK-SCORING.md"
];

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("pnpm workspace contains the planned apps and package boundaries", async () => {
  const workspaceConfig = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");

  assert.match(workspaceConfig, /- ['"]apps\/\*['"]/);
  assert.match(workspaceConfig, /- ['"]packages\/\*['"]/);
  assert.doesNotMatch(workspaceConfig, /ECC/);

  for (const [relativePath, packageName] of Object.entries(workspacePackages)) {
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, relativePath, "package.json"), "utf8")
    );

    assert.equal(manifest.name, packageName);
    assert.equal(manifest.private, true);
  }
});

test("Vite application lives under apps/web and no legacy root app remains", async () => {
  const expectedWebEntries = [
    "apps/web/index.html",
    "apps/web/vite.config.js",
    "apps/web/eslint.config.js",
    "apps/web/public/manifest.json",
    "apps/web/public/sw.js",
    "apps/web/src/main.jsx"
  ];
  const legacyRootEntries = ["index.html", "vite.config.js", "public", "src"];

  for (const relativePath of expectedWebEntries) {
    assert.equal(await exists(relativePath), true, `${relativePath} should exist`);
  }

  for (const relativePath of legacyRootEntries) {
    assert.equal(await exists(relativePath), false, `${relativePath} should move out of the root`);
  }
});

test("root manifest exposes the monorepo command surface", async () => {
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(manifest.name, "call-to-cash-risk-copilot");
  assert.equal(manifest.packageManager, "pnpm@10.34.4");
  assert.equal(manifest.engines.node, "^20.19.0 || ^22.12.0 || >=24.0.0");
  assert.equal(manifest.devDependencies.pnpm, "10.34.4");
  assert.equal(manifest.devDependencies.turbo, "2.9.18");
  assert.equal(manifest.scripts.prebuild, "pnpm install --frozen-lockfile");

  for (const script of [
    "dev",
    "dev:api",
    "dev:web",
    "build",
    "lint",
    "typecheck",
    "test",
    "format",
    "format:check",
    "preview"
  ]) {
    assert.equal(typeof manifest.scripts[script], "string", `missing root ${script} script`);
  }
});

test("pnpm is the only committed dependency lock and Turbo cache is ignored", async () => {
  const gitignore = await readFile(path.join(repoRoot, ".gitignore"), "utf8");

  assert.equal(await exists("pnpm-lock.yaml"), true);
  assert.equal(await exists("package-lock.json"), false);
  assert.equal(await exists("apps/web/package-lock.json"), false);
  assert.match(gitignore, /^\.turbo$/m);
  assert.match(gitignore, /^\.pnpm-store\/$/m);
});

test("Phase 1 exposes TypeScript package entrypoints and API health skeleton", async () => {
  const expectedFiles = [
    ".env.example",
    ".github/workflows/ci.yml",
    ".nvmrc",
    "eslint.config.js",
    "prettier.config.mjs",
    "packages/config/tsconfig.base.json",
    "apps/api/src/app.ts",
    "apps/api/src/app.test.ts",
    "apps/api/src/server.ts",
    ...Object.keys(workspacePackages)
      .filter((relativePath) => relativePath.startsWith("packages/"))
      .map((relativePath) => `${relativePath}/src/index.ts`)
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(await exists(relativePath), true, `${relativePath} should exist`);
  }

  for (const relativePath of [
    "apps/api",
    ...Object.keys(workspacePackages).filter((path) => path.startsWith("packages/"))
  ]) {
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, relativePath, "package.json"), "utf8")
    );

    for (const script of ["build", "lint", "typecheck", "test"]) {
      assert.equal(
        typeof manifest.scripts?.[script],
        "string",
        `${relativePath} should expose ${script}`
      );
    }
  }
});

test("Phase 4 exposes reviewed PostgreSQL and Prisma durable-state tooling", async () => {
  const requiredFiles = [
    "compose.yaml",
    "prisma.config.ts",
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "prisma/migrations/migration_lock.toml",
    "prisma/migrations/20260620131142_phase4_durable_state/migration.sql",
    "packages/db/src/client.ts",
    "packages/db/src/inventory-repository.ts",
    "packages/db/src/receipt-trace-repository.ts"
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(await exists(relativePath), true, `${relativePath} should exist`);
  }

  const manifest = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  for (const script of [
    "db:generate",
    "db:validate",
    "db:migrate:dev",
    "db:migrate:deploy",
    "db:migrate:status",
    "db:seed"
  ]) {
    assert.equal(typeof manifest.scripts[script], "string", `missing root ${script} script`);
  }

  const envTemplate = await readFile(path.join(repoRoot, ".env.example"), "utf8");
  assert.match(envTemplate, /^DATABASE_URL=postgresql:\/\//m);
  assert.doesNotMatch(envTemplate, /^VITE_.*DATABASE_URL/m);

  const schema = await readFile(path.join(repoRoot, "prisma/schema.prisma"), "utf8");
  for (const model of [
    "TripDeparture",
    "InventoryHold",
    "Booking",
    "Agreement",
    "PaymentIntent",
    "PaymentTransaction",
    "ProofRecord",
    "TrustReceipt",
    "AuditLog"
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  const migration = await readFile(
    path.join(repoRoot, "prisma/migrations/20260620131142_phase4_durable_state/migration.sql"),
    "utf8"
  );
  assert.match(migration, /inventory_holds_one_active_per_booking/);
  assert.match(migration, /agreements_protect_locked_terms/);
  assert.match(migration, /audit_logs_append_only/);
});

test("Phase 0 canonical names and refund policy stay normalized", async () => {
  const docsText = (
    await Promise.all(
      authoritativeDocs.map((relativePath) => readFile(path.join(repoRoot, relativePath), "utf8"))
    )
  ).join("\n");

  assert.doesNotMatch(docsText, /RISK_SCORING\.md/);
  assert.doesNotMatch(docsText, /@(ctc|repo)\//);
  assert.doesNotMatch(docsText, /HTTP \/ WebSocket/);

  const refundPolicy = await readFile(
    path.join(repoRoot, "apps/web/src/data/refundPolicy.js"),
    "utf8"
  );
  assert.match(refundPolicy, /BUS-V1/);
  assert.match(refundPolicy, /refundPercent:\s*80/);
  assert.match(refundPolicy, /minimumNoticeHours:\s*12/);

  const scenarioCopy = await readFile(
    path.join(repoRoot, "apps/web/src/data/scenarios.js"),
    "utf8"
  );
  const drawerCopy = await readFile(
    path.join(repoRoot, "apps/web/src/features/payment/components/PhonePaymentDrawer.jsx"),
    "utf8"
  );
  assert.doesNotMatch(`${scenarioCopy}\n${drawerCopy}`, /hoàn 100%|2 tiếng/);
});
