#!/usr/bin/env node
// One-shot Vercel setup: project, Neon database, public Blob store, env vars, tables, first deploy.
// Safe to run again: every step checks what already exists and skips it.
//
// Usage (from the repo root, after filling in lib/site.ts):
//   node scripts/setup.mjs --project my-sale --anthropic-key sk-ant-... [--admin-password ...] [--region fra1] [--scope my-team]
//
// Needs: the Vercel CLI, logged in (`vercel whoami`), and pnpm. The ANTHROPIC_API_KEY env var works instead of --anthropic-key.
// Prints the site URL and the admin password at the end.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);

const project = args.project;
const anthropicKey = args["anthropic-key"] || process.env.ANTHROPIC_API_KEY || "";
const region = args.region || "iad1"; // Blob store region; e.g. fra1 or cdg1 for Europe
const scope = args.scope ? ["--scope", args.scope] : [];

if (!project || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(project)) {
  fail("Pass --project <name>: lowercase letters, digits and dashes, e.g. --project alex-sale");
}

const step = (msg) => console.log(`\n▸ ${msg}`);
function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// Runs the Vercel CLI non-interactively. Returns stdout; throws with the CLI's output on failure.
function vercel(cmdArgs, { input, allowFail = false } = {}) {
  const r = spawnSync("vercel", [...cmdArgs, ...scope, "--non-interactive"], {
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
  });
  if (r.status !== 0 && !allowFail) {
    fail(`vercel ${cmdArgs.join(" ")} failed:\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
}

function envKeys() {
  const { out } = vercel(["env", "ls", "--json"]);
  const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  const keys = new Map();
  for (const e of json.envs) keys.set(e.key, new Set([...(keys.get(e.key) ?? []), ...e.target]));
  return keys;
}

// ── 0. Preflight ────────────────────────────────────────────────────────────
step("Checking tools");
const who = vercel(["whoami"], { allowFail: true });
if (!who.ok) fail("The Vercel CLI isn't logged in. Run `vercel login` (it opens the browser), then run this again.");
console.log(`  Vercel account: ${(who.stdout.trim() || who.out.trim()).split("\n").pop()}`);
if (spawnSync("pnpm", ["--version"]).status !== 0) fail("pnpm is missing. Install it with `npm i -g pnpm` (or `corepack enable`).");

const site = readFileSync("lib/site.ts", "utf8");
if (/SELLER = "Alex"/.test(site) || /Café Example/.test(site)) {
  fail("lib/site.ts still has the example values (Alex / Café Example). Fill in your details first.");
}

// ── 1. Project ──────────────────────────────────────────────────────────────
step(`Linking Vercel project "${project}"`);
if (!existsSync(".vercel/project.json")) {
  const exists = vercel(["projects", "inspect", project], { allowFail: true }).ok;
  if (!exists) vercel(["projects", "add", project]);
  vercel(["link", "--yes", "--project", project]);
} else {
  console.log("  Already linked.");
}

// ── 2. Git: deploy on every push to main ────────────────────────────────────
step("Connecting the GitHub repo (so pushes to main deploy)");
let remote = "";
try {
  remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {}
if (remote) {
  const git = vercel(["git", "connect", remote], { allowFail: true });
  console.log(git.ok || /already connected/i.test(git.out)
    ? "  Connected."
    : `  Couldn't connect (${git.out.trim().split("\n").pop()}).\n  Deploys still work from this script; to deploy on push, install the Vercel GitHub app for this repo: https://github.com/apps/vercel`);
} else {
  console.log("  No git remote; skipping. Deploys still work from this script.");
}

let keys = envKeys();

// ── 3. Database (Neon, via the Vercel Marketplace) ──────────────────────────
step("Database (Neon Postgres)");
if (keys.has("DATABASE_URL")) {
  console.log("  Already connected.");
} else {
  const neon = vercel(["integration", "add", "neon", "--name", `${project}-db`, "--no-env-pull"], { allowFail: true });
  if (!neon.ok) {
    fail(
      `Couldn't create the Neon database:\n${neon.out.trim()}\n\n` +
        "This usually means Neon's terms haven't been accepted on your Vercel team yet. Open\n" +
        "  https://vercel.com/marketplace/neon\n" +
        "click Install (free plan), then run this script again.",
    );
  }
  console.log("  Created and connected.");
}

// ── 4. Photo storage (Vercel Blob, public) ──────────────────────────────────
step("Photo storage (Vercel Blob)");
if (keys.has("BLOB_READ_WRITE_TOKEN")) {
  console.log("  Already connected.");
} else {
  vercel(["blob", "create-store", `${project}-photos`, "--access", "public", "--region", region, "--yes"]);
  console.log("  Created and connected.");
}

// ── 5. Secrets ──────────────────────────────────────────────────────────────
step("Environment variables");
keys = envKeys();
const adminPassword = args["admin-password"] || (keys.has("ADMIN_PASSWORD") ? null : randomBytes(9).toString("base64url"));
const values = {
  SESSION_SECRET: randomBytes(32).toString("hex"),
  ...(adminPassword ? { ADMIN_PASSWORD: adminPassword } : {}),
  ...(anthropicKey ? { ANTHROPIC_API_KEY: anthropicKey } : {}),
};
for (const [key, value] of Object.entries(values)) {
  let changed = false;
  for (const target of ["production", "preview", "development"]) {
    const has = keys.get(key)?.has(target);
    // Only overwrite when the caller passed a new value explicitly; never rotate SESSION_SECRET silently.
    const explicit = (key === "ADMIN_PASSWORD" && args["admin-password"]) || (key === "ANTHROPIC_API_KEY" && anthropicKey);
    if (has && !explicit) continue;
    const sensitive = target === "development" ? ["--no-sensitive"] : ["--sensitive"];
    vercel(["env", "add", key, target, "--value", value, "--yes", "--force", ...sensitive]);
    changed = true;
  }
  console.log(`  ${key} ${changed ? "set" : "already set"}.`);
}
if (!anthropicKey && !keys.has("ANTHROPIC_API_KEY")) {
  console.log("  ! ANTHROPIC_API_KEY not set: the site works, but the buyer chat won't answer until you add it\n    (node scripts/setup.mjs --project " + project + " --anthropic-key sk-ant-...).");
}

// ── 6. Tables ───────────────────────────────────────────────────────────────
step("Creating the database tables");
vercel(["env", "pull", ".env.local", "--yes", "--environment", "development"]);
const migrate = spawnSync("node", ["--env-file=.env.local", "scripts/migrate.mjs"], { stdio: "inherit" });
if (migrate.status !== 0) fail("pnpm migrate failed (see above).");

// ── 7. Deploy ───────────────────────────────────────────────────────────────
step("Deploying to production (takes about a minute)");
const deploy = vercel(["deploy", "--prod", "--yes"]);
const inspect = vercel(["projects", "inspect", project], { allowFail: true }).out;
const domain = inspect.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/)?.[0] || deploy.out.match(/https:\/\/\S+\.vercel\.app/g)?.pop();

console.log(`
✓ Done.

  Site:   ${domain ?? "(see the Vercel dashboard)"}
  Admin:  ${domain ? `${domain}/admin` : "/admin"}
  Admin password: ${adminPassword ?? "(unchanged; it's ADMIN_PASSWORD in .env.local and in the Vercel project settings)"}
`);
