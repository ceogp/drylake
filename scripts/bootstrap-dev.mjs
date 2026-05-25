#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_ENV = "development";
const DEFAULT_ENV_FILE = ".env";

function usage() {
  return [
    "Usage:",
    "  node scripts/bootstrap-dev.mjs [--env development] [--file .env] [--secret-id <id>]",
    "",
    "Options:",
    "  --refresh-env      Pull the env bundle even when .env already exists.",
    "  --skip-install     Do not run npm ci when node_modules is missing.",
    "  --skip-machine-profile  Do not apply VS Code, Codex, and global CLI profile.",
    "  --skip-vscode      Do not apply the VS Code profile.",
    "  --skip-codex       Do not apply the Codex profile.",
    "  --skip-global-tools  Do not install global npm CLI tools.",
    "  --skip-db          Do not start or wait for local Postgres.",
    "  --skip-prisma      Do not run Prisma generate/migrate/seed.",
    "  --reset-db         Recreate the local Docker Postgres volume.",
    "  --validate         Run npm run validate:local after setup.",
    "  --start            Start npm run dev after setup.",
  ].join("\n");
}

function parseArgs(argv) {
  const flags = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--help" || item === "-h") {
      flags.help = "true";
      continue;
    }

    if (!item.startsWith("--")) {
      flags._.push(item);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function bin(name) {
  if (process.platform === "win32" && (name === "npm" || name === "npx")) {
    return `${name}.cmd`;
  }

  return name;
}

function run(command, args, options = {}) {
  const useShell = process.platform === "win32";
  const result = spawnSync(bin(command), args, {
    cwd: process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: useShell,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const detail = output ? `\n${output}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.${detail}`);
  }

  return result.stdout || "";
}

function canRun(command, args = ["--version"]) {
  const useShell = process.platform === "win32";
  const result = spawnSync(bin(command), args, {
    cwd: process.cwd(),
    stdio: "ignore",
    shell: useShell,
  });

  return !result.error && result.status === 0;
}

function parseDotenv(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    values[match[1]] = stripQuotes(match[2]);
  }

  return values;
}

function stripQuotes(value) {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function applyEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function replaceDotenvValue(content, key, value) {
  const quoted = JSON.stringify(value);
  const linePattern = new RegExp(`^${key}=.*$`, "m");

  if (linePattern.test(content)) {
    return content.replace(linePattern, `${key}=${quoted}`);
  }

  return `${content.replace(/\s*$/, "\n")}${key}=${quoted}\n`;
}

function step(message) {
  console.log(`\n==> ${message}`);
}

function repoRootGuard() {
  for (const file of ["package.json", "package-lock.json", "scripts/aws/env-secrets.mjs"]) {
    if (!fs.existsSync(path.resolve(file))) {
      throw new Error(`Run this command from the repository root. Missing ${file}.`);
    }
  }
}

function assertNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0] || "0", 10);
  if (major < 22) {
    throw new Error(`Node 22 or newer is required. Current Node is ${process.version}.`);
  }
}

function installDependencies(flags) {
  if (flags["skip-install"] === "true") {
    console.log("Skipping dependency install.");
    return;
  }

  if (fs.existsSync(path.resolve("node_modules"))) {
    console.log("node_modules exists. Skipping npm ci.");
    return;
  }

  step("Installing dependencies");
  run("npm", ["ci"]);
}

function applyMachineProfile(flags) {
  if (flags["skip-machine-profile"] === "true") {
    console.log("Skipping machine profile.");
    return;
  }

  step("Applying VS Code, Codex, and CLI profile");
  const args = ["scripts/machine-profile/apply.mjs"];
  for (const flag of ["skip-vscode", "skip-codex", "skip-global-tools"]) {
    if (flags[flag] === "true") {
      args.push(`--${flag}`);
    }
  }

  run("node", args);
}

function syncEnv(flags) {
  const env = flags.env || flags._[0] || DEFAULT_ENV;
  const file = flags.file || flags._[1] || DEFAULT_ENV_FILE;
  const envPath = path.resolve(file);
  const secretArgs = ["--", "--env", env, "--file", file];

  if (flags["secret-id"]) {
    secretArgs.push("--secret-id", flags["secret-id"]);
  }

  if (flags.region) {
    secretArgs.push("--region", flags.region);
  }

  if (fs.existsSync(envPath) && flags["refresh-env"] !== "true") {
    step(`Validating existing ${file}`);
    run("npm", ["run", "secrets:check", ...secretArgs]);
  } else {
    step(`Pulling ${env} env bundle into ${file}`);
    try {
      run("npm", ["run", "secrets:pull", ...secretArgs, "--force"]);
    } catch (error) {
      throw new Error([
        error.message,
        "",
        "Could not pull the env bundle automatically.",
        "Make sure this machine has AWS credentials with secretsmanager:GetSecretValue.",
        "Recommended one-time setup:",
        "  aws configure sso",
        "  aws sso login --profile xupra",
        "Or copy a working ~/.aws/config and ~/.aws/credentials profile to this machine.",
      ].join("\n"));
    }
  }

  const content = fs.readFileSync(envPath, "utf8");
  applyEnv(parseDotenv(content));

  return { env, file };
}

async function waitForPostgres(databaseUrl) {
  const pg = await import("pg");
  const Client = pg.Client || pg.default?.Client;
  if (!Client) {
    throw new Error("Unable to load pg Client.");
  }

  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("Postgres is ready.");
      return;
    } catch (error) {
      await client.end().catch(() => {});

      if (/password authentication failed|does not support SSL/i.test(error.message || "")) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(`Waiting for Postgres (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

function shouldUseLocalDocker(databaseUrl) {
  return /@(localhost|127\.0\.0\.1)(:|\/)/i.test(databaseUrl || "");
}

function localDatabaseSettings(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return {
      database: decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || "xupra_drylake",
      password: decodeURIComponent(parsed.password || "xupra_local"),
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username || "xupra_app"),
    };
  } catch {
    return {
      database: "xupra_drylake",
      password: "xupra_local",
      port: "5432",
      user: "xupra_app",
    };
  }
}

function normalizeLocalDatabaseEnv(file) {
  const envPath = path.resolve(file);
  const content = fs.readFileSync(envPath, "utf8");
  const values = parseDotenv(content);
  const databaseUrl = values.DATABASE_URL || "";

  if (!shouldUseLocalDocker(databaseUrl)) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return;
  }

  if (parsed.searchParams.get("sslmode") === "disable") {
    return;
  }

  parsed.searchParams.set("sslmode", "disable");
  const normalized = parsed.toString();
  fs.writeFileSync(envPath, replaceDotenvValue(content, "DATABASE_URL", normalized), { mode: 0o600 });
  process.env.DATABASE_URL = normalized;
  console.log("Updated local DATABASE_URL to use sslmode=disable for Docker Postgres.");
}

async function setupDatabase(flags) {
  if (flags["skip-db"] === "true") {
    console.log("Skipping database setup.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl.startsWith("postgres")) {
    console.log("DATABASE_URL is not PostgreSQL. Skipping database setup.");
    return;
  }

  if (shouldUseLocalDocker(databaseUrl)) {
    if (canRun("docker", ["compose", "version"])) {
      const settings = localDatabaseSettings(databaseUrl);
      const dockerEnv = {
        POSTGRES_DB: settings.database,
        POSTGRES_HOST_PORT: settings.port,
        POSTGRES_PASSWORD: settings.password,
        POSTGRES_USER: settings.user,
      };

      if (flags["reset-db"] === "true") {
        step("Resetting local Docker Postgres volume");
        run("docker", ["compose", "down", "-v"], { env: dockerEnv });
      }

      step("Starting local Postgres with Docker Compose");
      run("docker", ["compose", "up", "-d", "postgres"], { env: dockerEnv });
    } else {
      console.log("Docker Compose is not available. Assuming Postgres is already running.");
    }
  }

  step("Checking database connection");
  try {
    await waitForPostgres(databaseUrl);
  } catch (error) {
    if (shouldUseLocalDocker(databaseUrl) && /password authentication failed/i.test(error.message || "")) {
      throw new Error([
        error.message,
        "",
        "The existing local Docker Postgres volume was initialized with different credentials.",
        "Run bootstrap with --reset-db to recreate the local database volume from the restored .env.",
      ].join("\n"));
    }

    throw error;
  }
}

function setupPrisma(flags) {
  if (flags["skip-prisma"] === "true") {
    console.log("Skipping Prisma setup.");
    return;
  }

  step("Generating Prisma client");
  run("npx", ["prisma", "generate"]);

  step("Applying database migrations");
  run("npx", ["prisma", "migrate", "deploy"]);

  step("Seeding local database");
  run("npx", ["tsx", "prisma/seed.ts"]);
}

function optionalValidation(flags) {
  if (flags.validate !== "true") {
    return;
  }

  step("Running local validation");
  run("npm", ["run", "validate:local"]);
}

function optionalStart(flags) {
  if (flags.start !== "true") {
    return;
  }

  step("Starting development server");
  run("npm", ["run", "dev"]);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help === "true") {
    console.log(usage());
    return;
  }

  repoRootGuard();
  assertNodeVersion();

  step("Bootstrapping DryLake development environment");
  installDependencies(flags);
  applyMachineProfile(flags);
  const synced = syncEnv(flags);
  normalizeLocalDatabaseEnv(synced.file);
  await setupDatabase(flags);
  setupPrisma(flags);
  optionalValidation(flags);

  console.log("\nBootstrap complete.");
  console.log(`Environment: ${synced.env}`);
  console.log(`Env file: ${synced.file}`);
  console.log("Next command: npm run dev");

  optionalStart(flags);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
