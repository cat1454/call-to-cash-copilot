import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evaluationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

type PatternCheck = {
  label: string;
  pattern: RegExp;
};

const checks: PatternCheck[] = [
  {
    label: "raw phone number",
    pattern: /\b(?:03|05|07|08|09)\d{8}\b/g
  },
  {
    label: "raw email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },
  {
    label: "bank account-like number",
    pattern: /\b\d{9,16}\b/g
  },
  {
    label: "identity-card-like number",
    pattern: /\b\d{12}\b/g
  },
  {
    label: "private-key-like string",
    pattern: /\b[A-Za-z0-9+/=]{48,}\b|\b[1-9A-HJ-NP-Za-km-z]{48,}\b/g
  },
  {
    label: "private address phrase",
    pattern: /\b(?:so nha|ngo|phuong|quan)\s+\d+\b/gi
  }
];

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }
      if (
        entry.isFile() &&
        (entry.name.endsWith(".json") || entry.name.endsWith(".md"))
      ) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

function mask(value: string): string {
  if (value.length <= 7) {
    return `${value.slice(0, 1)}***${value.slice(-1)}`;
  }
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

async function main(): Promise<void> {
  const scanRoots = ["scenarios", "reports"].map((directory) =>
    path.join(evaluationRoot, directory)
  );
  const files = (await Promise.all(scanRoots.map(listFiles))).flat();
  let findings = 0;

  for (const check of checks) {
    let checkFindings = 0;

    for (const file of files) {
      const content = await readFile(file, "utf8");
      const matches = content.match(check.pattern) ?? [];
      for (const match of matches) {
        checkFindings += 1;
        findings += 1;
        console.log(
          `FAIL possible ${check.label} in ${path.relative(
            evaluationRoot,
            file
          )}: ${mask(match)}`
        );
      }
    }

    if (checkFindings === 0) {
      console.log(`PASS no ${check.label}`);
    }
  }

  if (findings > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
