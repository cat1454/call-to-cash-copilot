import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".css"]);
const MAX_SOURCE_LINES = 300;
const CP1252_CONTINUATION =
  "[\\u0080-\\u00bf\\u2018-\\u201d\\u2020\\u2021\\u2026\\u2030\\u2039\\u203a\\u0152\\u0153\\u0160\\u0161\\u017d\\u017e\\u02c6\\u02dc\\u20ac\\u2122]";
const MOJIBAKE_PATTERN = new RegExp(
  `(?:[\\u00c2-\\u00c6]${CP1252_CONTINUATION}|\\u00e1[\\u00ba\\u00bb]|\\u00e2${CP1252_CONTINUATION})`,
  "u"
);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

test("source files stay below the 300-line guardrail", async () => {
  const files = await collectSourceFiles(srcRoot);
  const oversized = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lineCount = text.split(/\r?\n/).length;

    if (lineCount > MAX_SOURCE_LINES) {
      oversized.push({
        path: path.relative(repoRoot, file).replaceAll("\\", "/"),
        lineCount
      });
    }
  }

  assert.deepEqual(oversized, []);
});

test("source text stays free of mojibake signatures", async () => {
  const files = await collectSourceFiles(srcRoot);
  const offenders = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!MOJIBAKE_PATTERN.test(line)) return;

      offenders.push({
        path: path.relative(repoRoot, file).replaceAll("\\", "/"),
        line: index + 1,
        text: line.trim()
      });
    });
  }

  assert.deepEqual(offenders, []);
});
