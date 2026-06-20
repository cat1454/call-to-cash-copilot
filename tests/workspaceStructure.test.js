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
  const workspaceConfig = await readFile(
    path.join(repoRoot, "pnpm-workspace.yaml"),
    "utf8"
  );

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
  assert.equal(manifest.packageManager, "pnpm@11.1.1");
  assert.equal(manifest.devDependencies.pnpm, "11.1.1");
  assert.equal(manifest.devDependencies.turbo, "2.9.18");

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
  assert.match(gitignore, /^\.turbo$/m);
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

  for (const relativePath of ["apps/api", ...Object.keys(workspacePackages).filter((path) => path.startsWith("packages/"))]) {
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

test("Phase 0 canonical names and refund policy stay normalized", async () => {
  const docsText = (
    await Promise.all(
      authoritativeDocs.map((relativePath) =>
        readFile(path.join(repoRoot, relativePath), "utf8")
      )
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
