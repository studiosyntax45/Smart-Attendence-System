// `npm run doctor`: checks the local setup and prints what to fix.
// Plain Node, no dependencies, so it runs even when installs are broken.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
let problems = 0;

const ok = (msg) => console.log(`  [OK]   ${msg}`);
const warn = (msg, fix) => console.log(`  [WARN] ${msg}${fix ? `\n         Fix: ${fix}` : ""}`);
const bad = (msg, fix) => {
  problems++;
  console.log(`  [FAIL] ${msg}${fix ? `\n         Fix: ${fix}` : ""}`);
};
const section = (title) => console.log(`\n${title}`);

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

async function get(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, text: await res.text() };
  } catch {
    return null;
  }
}

function readEnv() {
  const file = path.join(root, ".env");
  if (!existsSync(file)) return null;
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

console.log("PES Smart Attendance - setup check");

// ---------------------------------------------------------------- tools
section("1. Tools");
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node} is too old`, "install Node.js 20 or 22 LTS from https://nodejs.org/");

// ---------------------------------------------------------------- code
section("2. Code version");
const branch = sh("git rev-parse --abbrev-ref HEAD");
const head = sh("git log -1 --oneline");
if (!branch) {
  warn("not a git checkout (downloaded as ZIP?) - cannot check the code version");
} else {
  ok(`branch ${branch}, commit ${head}`);
  if (branch !== "main") warn(`you are on "${branch}", not "main"`, "git checkout main && git pull");
  const dirty = sh("git status --porcelain --untracked-files=no");
  if (dirty) {
    warn(
      `files changed locally (these can block git pull):\n${dirty.split("\n").map((l) => `           ${l}`).join("\n")}`,
      'if you did not mean to change them: git stash, then git pull  (or "git checkout -- <file>" to discard one file)'
    );
  }
  if (sh("git fetch origin main --quiet") !== null) {
    const behind = Number(sh("git rev-list --count HEAD..origin/main") ?? 0);
    if (behind > 0) bad(`your code is ${behind} commit(s) behind GitHub's main`, "git pull   (read its output: it must not say 'error' or 'Aborting')");
    else ok("up to date with GitHub's main");
  } else {
    warn("could not reach GitHub to compare versions (offline?)");
  }
}

// ---------------------------------------------------------------- installs
section("3. Installed packages");
if (existsSync(path.join(root, "node_modules", "vite"))) ok("frontend packages installed");
else bad("frontend packages missing", "npm install");
if (!existsSync(path.join(root, "server", "node_modules", "express"))) {
  bad("backend packages missing", "npm --prefix server install");
} else if (!existsSync(path.join(root, "server", "node_modules", "dotenv-cli"))) {
  bad("backend packages are out of date (dotenv-cli missing, so the backend cannot start)", "npm --prefix server install");
} else {
  ok("backend packages installed");
}
const models = ["tiny_face_detector_model.bin", "face_landmark_68_model.bin", "face_recognition_model.bin"];
if (models.every((m) => existsSync(path.join(root, "public", "models", m)))) ok("browser face models downloaded");
else bad("browser face models missing (face enrolment and marking will fail)", "npm run download-models");

// ---------------------------------------------------------------- .env
section("4. Settings (.env)");
const env = readEnv();
if (!env) {
  bad(".env file not found in the project folder", "copy .env.example .env   then edit it (README step 6)");
} else {
  ok(".env found");
  const dbUrl = env.DATABASE_URL ?? "";
  if (!dbUrl) bad("DATABASE_URL is missing", "add it to .env (README step 6.3)");
  else if (dbUrl.includes("YOUR_MYSQL_PASSWORD")) bad("DATABASE_URL still has YOUR_MYSQL_PASSWORD", "put your MySQL root password in .env");
  else {
    const m = dbUrl.match(/^mysql:\/\/([^:]+):(.*)@([^@/]+)\/([^?]+)/);
    if (!m) bad("DATABASE_URL does not look like mysql://user:password@host:port/database");
    else if (/[@#/?]/.test(m[2])) bad("the MySQL password in DATABASE_URL contains @ # / or ? unencoded", "encode them (@ -> %40, # -> %23, / -> %2F, ? -> %3F), see README 6.3");
    else ok(`DATABASE_URL points at ${m[3]}/${m[4]}`);
  }
  for (const k of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!env[k] || env[k].startsWith("replace-me")) bad(`${k} is not set`, "generate one (README step 6.2)");
  }
  if (env.WEB_ORIGIN && env.WEB_ORIGIN !== "http://localhost:3000") warn(`WEB_ORIGIN is ${env.WEB_ORIGIN}; the browser must open exactly that address`);
}

// ---------------------------------------------------------------- running services
section("5. Running services");
const apiBase = (env?.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
const health = await get(`${apiBase}/health`);
if (!health) {
  bad(`backend not answering at ${apiBase}`, "start it: npm --prefix server run dev   (and read that window for errors)");
} else {
  let body = null;
  try {
    body = JSON.parse(health.text);
  } catch {}
  if (!body?.db) {
    bad("the backend running on this port is an OLD version (no database check in /health)", "stop every old backend window (Ctrl + C), then start it again: npm --prefix server run dev");
  } else if (body.db.error) {
    bad(`backend is up but cannot reach MySQL: ${body.db.error}`, "start MySQL (services.msc) and check DATABASE_URL");
  } else if (!body.db.ok) {
    bad(
      `database tables are out of date. Missing: ${[...body.db.missingTables, ...body.db.missingColumns].join(", ")}`,
      "stop the backend (Ctrl + C) and start it again with: npm --prefix server run dev"
    );
  } else {
    ok(`backend running at ${apiBase}, database OK`);
  }
}

const web = await get("http://localhost:3000/");
if (!web) bad("frontend not answering at http://localhost:3000", "start it: npm run dev");
else ok("frontend running at http://localhost:3000");

if (env?.VITE_FACE_VERIFICATION === "false") {
  ok("face service not needed (VITE_FACE_VERIFICATION=false)");
} else {
  const face = await get(`${(env?.FACE_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, "")}/health`);
  if (face?.status === 200) ok("face service running");
  else warn("face service not running (only needed while enrolling faces)", "start it (README step 10, window 1)");
}

if (env?.OLLAMA_ENABLED === "false") {
  ok("Ollama turned off (OLLAMA_ENABLED=false)");
} else {
  const base = (env?.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = env?.OLLAMA_MODEL || "qwen2.5:7b-instruct";
  const tags = await get(`${base}/api/tags`);
  if (!tags) warn("Ollama not running (AI advice falls back to rule-based advice)", "start the Ollama app, or set OLLAMA_ENABLED=false");
  else if (!tags.text.includes(`"${model}"`)) warn(`Ollama is running but model ${model} is not downloaded`, `ollama pull ${model}`);
  else ok(`Ollama running with ${model}`);
}

// ---------------------------------------------------------------- summary
console.log(
  problems === 0
    ? "\nNo problems found. If a page still fails, press Ctrl + Shift + R in the browser, then send the text shown under \"This page didn't load\"."
    : `\n${problems} problem(s) found. Fix them from the top down, then run  npm run doctor  again.`
);
process.exitCode = problems === 0 ? 0 : 1;
