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
  "packages/config": "@call-to-cash/config"
};

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
  const legacyRootEntries = ["index.html", "vite.config.js", "eslint.config.js", "public", "src"];

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

  for (const script of ["dev", "build", "lint", "test", "preview"]) {
    assert.equal(typeof manifest.scripts[script], "string", `missing root ${script} script`);
  }
});

test("pnpm is the only committed dependency lock and Turbo cache is ignored", async () => {
  const gitignore = await readFile(path.join(repoRoot, ".gitignore"), "utf8");

  assert.equal(await exists("pnpm-lock.yaml"), true);
  assert.equal(await exists("package-lock.json"), false);
  assert.match(gitignore, /^\.turbo$/m);
});
