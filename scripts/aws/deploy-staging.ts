import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

type Manifest = {
  publicIp: string;
  sshUser: string;
  sshKeyPath: string;
  database: {
    name: string;
    user: string;
    password: string;
  };
  rdsDatabase?: {
    endpointAddress?: string;
    endpointPort?: number;
    name: string;
    user: string;
    password: string;
  };
  appEncryptionKey: string;
};

const manifestPath = path.join(process.cwd(), "storage", "staging", "staging-manifest.json");
const workDir = path.join(process.cwd(), "storage", "staging", "deploy");

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function readManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isIpv4Hostname(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function encodeDatabaseUrlPart(value: string) {
  return encodeURIComponent(value);
}

function databaseUrlFromManifest(manifest: Manifest) {
  if (manifest.rdsDatabase?.endpointAddress) {
    const database = manifest.rdsDatabase;
    const port = database.endpointPort ?? 5432;

    return `postgresql://${encodeDatabaseUrlPart(database.user)}:${encodeDatabaseUrlPart(database.password)}@${database.endpointAddress}:${port}/${encodeDatabaseUrlPart(database.name)}?uselibpqcompat=true&sslmode=require`;
  }

  return `postgresql://${encodeDatabaseUrlPart(manifest.database.user)}:${encodeDatabaseUrlPart(manifest.database.password)}@127.0.0.1:5432/${encodeDatabaseUrlPart(manifest.database.name)}`;
}

async function writeStagingEnv(manifest: Manifest) {
  const baseUrl = requireEnv("APP_BASE_URL");
  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error(`APP_BASE_URL must be a valid URL. Received: ${baseUrl}`);
  }

  if (isIpv4Hostname(parsedBaseUrl.hostname)) {
    throw new Error(
      `APP_BASE_URL must use your domain host, not a raw IP (${parsedBaseUrl.hostname}).`,
    );
  }

  if (parsedBaseUrl.protocol !== "https:") {
    throw new Error(`APP_BASE_URL must use https. Received protocol: ${parsedBaseUrl.protocol}`);
  }

  const envFilePath = path.join(workDir, "staging.env");

  const values: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL: databaseUrlFromManifest(manifest),
    APP_BASE_URL: baseUrl,
    OPERATOR_PORTAL_INTERNAL_HOST:
      process.env.OPERATOR_PORTAL_INTERNAL_HOST || process.env.ADMIN_INTERNAL_HOST || "",
    OPERATOR_PORTAL_INTERNAL_ORIGIN:
      process.env.OPERATOR_PORTAL_INTERNAL_ORIGIN || process.env.ADMIN_INTERNAL_ORIGIN || "",
    OPERATOR_PORTAL_BASIC_AUTH_USERNAME:
      process.env.OPERATOR_PORTAL_BASIC_AUTH_USERNAME ||
      process.env.ADMIN_INTERNAL_BASIC_AUTH_USERNAME ||
      "",
    OPERATOR_PORTAL_BASIC_AUTH_PASSWORD:
      process.env.OPERATOR_PORTAL_BASIC_AUTH_PASSWORD ||
      process.env.ADMIN_INTERNAL_BASIC_AUTH_PASSWORD ||
      "",
    ADMIN_INTERNAL_HOST:
      process.env.ADMIN_INTERNAL_HOST || process.env.OPERATOR_PORTAL_INTERNAL_HOST || "",
    ADMIN_INTERNAL_ORIGIN:
      process.env.ADMIN_INTERNAL_ORIGIN || process.env.OPERATOR_PORTAL_INTERNAL_ORIGIN || "",
    ADMIN_INTERNAL_BASIC_AUTH_USERNAME:
      process.env.ADMIN_INTERNAL_BASIC_AUTH_USERNAME ||
      process.env.OPERATOR_PORTAL_BASIC_AUTH_USERNAME ||
      "",
    ADMIN_INTERNAL_BASIC_AUTH_PASSWORD:
      process.env.ADMIN_INTERNAL_BASIC_AUTH_PASSWORD ||
      process.env.OPERATOR_PORTAL_BASIC_AUTH_PASSWORD ||
      "",
    APP_ENCRYPTION_KEY: manifest.appEncryptionKey,
    AUTH_MODE: process.env.AUTH_MODE || "cognito",
    DEFAULT_DEV_USER_EMAIL: process.env.DEFAULT_DEV_USER_EMAIL || "owner@xupra.local",
    DEFAULT_DEV_USER_NAME: process.env.DEFAULT_DEV_USER_NAME || "Xupra Owner",
    PLATFORM_ADMIN_EMAILS:
      process.env.PLATFORM_ADMIN_EMAILS || process.env.DEFAULT_DEV_USER_EMAIL || "owner@xupra.local",
    AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION || "",
    AWS_COGNITO_USER_POOL_ID: process.env.AWS_COGNITO_USER_POOL_ID || "",
    AWS_COGNITO_CLIENT_ID: process.env.AWS_COGNITO_CLIENT_ID || "",
    AWS_COGNITO_CLIENT_SECRET: process.env.AWS_COGNITO_CLIENT_SECRET || "",
    AWS_COGNITO_DOMAIN: process.env.AWS_COGNITO_DOMAIN || "",
    AWS_COGNITO_ISSUER: process.env.AWS_COGNITO_ISSUER || "",
    AWS_COGNITO_CALLBACK_URL: process.env.AWS_COGNITO_CALLBACK_URL || "",
    AWS_COGNITO_LOGOUT_REDIRECT_URL: process.env.AWS_COGNITO_LOGOUT_REDIRECT_URL || "",
    ARTIFACT_STORAGE_DRIVER: "local",
    ARTIFACT_STORAGE_ROOT: "/srv/xupra-drylake/shared/storage",
    SECRETS_PROVIDER: "env",
    JOB_EXECUTION_MODE: "inline",
    AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1",
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "ap-northeast-1",
    AWS_S3_PREFIX: process.env.AWS_S3_PREFIX || "xupra-drylake",
    AWS_SECRETS_PREFIX: process.env.AWS_SECRETS_PREFIX || "xupra-drylake",
    DRYLAKE_GUARD_BUCKET: process.env.DRYLAKE_GUARD_BUCKET || "",
    AI_PROVIDER: process.env.AI_PROVIDER || "openai",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    ANTHROPIC_FREE_MODEL: process.env.ANTHROPIC_FREE_MODEL || "claude-haiku-4-5-20251001",
    KIMI_API_KEY: process.env.KIMI_API_KEY || "",
    KIMI_BASE_URL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
    KIMI_MODEL: process.env.KIMI_MODEL || "kimi-k2.6",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.4",
    OPENAI_FREE_MODEL: process.env.OPENAI_FREE_MODEL || "gpt-5.4-nano",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID || "",
    STRIPE_ENTERPRISE_PRICE_ID: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || "",
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || "",
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || "",
    TWILIO_WHATSAPP_TO: process.env.TWILIO_WHATSAPP_TO || "",
    BILLING_ENFORCEMENT_MODE: process.env.BILLING_ENFORCEMENT_MODE || "development",
  };

  const content = Object.entries(values)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join("\n");

  await fs.writeFile(envFilePath, `${content}\n`, "utf8");

  return { baseUrl, envFilePath };
}

async function main() {
  const manifest = await readManifest();
  if (!manifest.publicIp) {
    throw new Error("Missing staging public IP. Run npm run aws:provision-staging first.");
  }

  await fs.mkdir(workDir, { recursive: true });

  const releaseTarPath = path.join(workDir, "release.tar");
  const bootstrapScriptPath = path.join(process.cwd(), "scripts", "deploy", "remote-bootstrap.sh");
  const normalizedBootstrapScriptPath = path.join(workDir, "remote-bootstrap.sh");
  const remoteHost = `${manifest.sshUser}@${manifest.publicIp}`;
  const remoteBootstrapPath = "/tmp/xupra-bootstrap.sh";
  const remoteEnvPath = "/tmp/xupra-staging.env";
  const remoteReleasePath = "/tmp/xupra-release.tar";

  const { baseUrl, envFilePath } = await writeStagingEnv(manifest);

  await run("git", ["archive", "--format=tar", "HEAD", "-o", releaseTarPath], {
    cwd: process.cwd(),
  });
  await fs.writeFile(
    normalizedBootstrapScriptPath,
    (await fs.readFile(bootstrapScriptPath, "utf8")).replace(/\r\n/g, "\n"),
    "utf8",
  );

  const sshArgs = ["-i", manifest.sshKeyPath, "-o", "StrictHostKeyChecking=accept-new"];
  const scpArgs = ["-i", manifest.sshKeyPath, "-o", "StrictHostKeyChecking=accept-new"];

  await run("scp", [...scpArgs, releaseTarPath, `${remoteHost}:${remoteReleasePath}`]);
  await run("scp", [...scpArgs, envFilePath, `${remoteHost}:${remoteEnvPath}`]);
  await run("scp", [...scpArgs, normalizedBootstrapScriptPath, `${remoteHost}:${remoteBootstrapPath}`]);

  await run("ssh", [
    ...sshArgs,
    remoteHost,
    `chmod +x ${remoteBootstrapPath} && sudo APP_DIR=/srv/xupra-drylake APP_USER=xupra APP_GROUP=xupra RELEASE_TAR=${remoteReleasePath} ENV_FILE=${remoteEnvPath} LEGACY_IP_HOST=${manifest.publicIp} bash ${remoteBootstrapPath}`,
  ]);

  console.log(`Staging deployment completed: ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
