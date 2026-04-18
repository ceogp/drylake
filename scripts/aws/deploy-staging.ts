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

async function writeStagingEnv(manifest: Manifest) {
  const baseUrl = `http://${manifest.publicIp}`;
  const envFilePath = path.join(workDir, "staging.env");

  const values: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_PROVIDER: "postgresql",
    DATABASE_URL: `postgresql://${manifest.database.user}:${manifest.database.password}@127.0.0.1:5432/${manifest.database.name}`,
    APP_BASE_URL: baseUrl,
    APP_ENCRYPTION_KEY: manifest.appEncryptionKey,
    AUTH_MODE: process.env.AUTH_MODE || "clerk",
    DEFAULT_DEV_USER_EMAIL: process.env.DEFAULT_DEV_USER_EMAIL || "owner@xupra.local",
    DEFAULT_DEV_USER_NAME: process.env.DEFAULT_DEV_USER_NAME || "Xupra Owner",
    PLATFORM_ADMIN_EMAILS:
      process.env.PLATFORM_ADMIN_EMAILS || "*",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
    CLERK_SIGN_IN_URL: process.env.CLERK_SIGN_IN_URL || "/",
    CLERK_SIGN_UP_URL: process.env.CLERK_SIGN_UP_URL || "/",
    ARTIFACT_STORAGE_DRIVER: "local",
    SECRETS_PROVIDER: "env",
    JOB_EXECUTION_MODE: "inline",
    AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1",
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "ap-northeast-1",
    AWS_S3_PREFIX: process.env.AWS_S3_PREFIX || "xupra-drylake",
    AWS_SECRETS_PREFIX: process.env.AWS_SECRETS_PREFIX || "xupra-drylake",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.4-mini",
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
  const remoteHost = `${manifest.sshUser}@${manifest.publicIp}`;
  const remoteBootstrapPath = "/tmp/xupra-bootstrap.sh";
  const remoteEnvPath = "/tmp/xupra-staging.env";
  const remoteReleasePath = "/tmp/xupra-release.tar";

  const { baseUrl, envFilePath } = await writeStagingEnv(manifest);

  await run("git", ["archive", "--format=tar", "HEAD", "-o", releaseTarPath], {
    cwd: process.cwd(),
  });

  const sshArgs = ["-i", manifest.sshKeyPath, "-o", "StrictHostKeyChecking=accept-new"];
  const scpArgs = ["-i", manifest.sshKeyPath, "-o", "StrictHostKeyChecking=accept-new"];

  await run("scp", [...scpArgs, releaseTarPath, `${remoteHost}:${remoteReleasePath}`]);
  await run("scp", [...scpArgs, envFilePath, `${remoteHost}:${remoteEnvPath}`]);
  await run("scp", [...scpArgs, bootstrapScriptPath, `${remoteHost}:${remoteBootstrapPath}`]);

  await run("ssh", [
    ...sshArgs,
    remoteHost,
    `chmod +x ${remoteBootstrapPath} && sudo APP_DIR=/srv/xupra-drylake APP_USER=xupra APP_GROUP=xupra RELEASE_TAR=${remoteReleasePath} ENV_FILE=${remoteEnvPath} DB_NAME=${manifest.database.name} DB_USER=${manifest.database.user} DB_PASSWORD=${manifest.database.password} bash ${remoteBootstrapPath}`,
  ]);

  console.log(`Staging deployment completed: ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
