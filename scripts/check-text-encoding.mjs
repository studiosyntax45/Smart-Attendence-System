import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const suspectMojibake = /[\u00c2-\u00f4][\u0080-\u00bf]/;
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

function collectTextFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...collectTextFiles(join(directory, entry.name)));
      continue;
    }

    const file = join(directory, entry.name);
    if (entry.name.startsWith(".env") || textExtensions.has(extname(entry.name))) files.push(file);
  }
  return files;
}

const offenders = collectTextFiles(".").filter((file) => {
  const contents = readFileSync(file, "utf8");
  return contents.includes("\ufffd") || suspectMojibake.test(contents);
});

if (offenders.length > 0) {
  console.error("Malformed UTF-8 text found in:");
  for (const file of offenders) console.error(`  ${file}`);
  process.exitCode = 1;
} else {
  console.log("Text encoding check passed.");
}
