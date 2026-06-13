import { loadEnvConfig } from "@next/env";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const secrets = new SecretsManagerClient({ region });

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeEnvContent(content: string) {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function setEnvEntry(content: string, key: string, value: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextLine = `${key}=${shellQuote(value)}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, nextLine);
  }

  return `${normalizeEnvContent(content)}${nextLine}\n`;
}

function upsertEnvEntries(content: string, entries: Record<string, string>) {
  let next = normalizeEnvContent(content);

  for (const [key, value] of Object.entries(entries)) {
    next = setEnvEntry(next, key, value);
  }

  return next;
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function validateAppBaseUrl(appBaseUrl: string, requireHttps: string) {
  let parsed: URL;

  try {
    parsed = new URL(appBaseUrl);
  } catch {
    throw new Error(`APP_BASE_URL must be a valid URL. Received: ${appBaseUrl}`);
  }

  if (requireHttps === "true" && parsed.protocol !== "https:") {
    throw new Error(`APP_BASE_URL must use https. Received protocol: ${parsed.protocol}`);
  }

  if (requireHttps === "true" && /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) {
    throw new Error(`APP_BASE_URL must use a domain host, not a raw IP (${parsed.hostname}).`);
  }
}

function resolveSshBinary(name: "scp" | "ssh" | "ssh-keygen" | "ssh-keyscan") {
  if (process.platform !== "win32") {
    return name;
  }

  const gitBinary = path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "usr", "bin", `${name}.exe`);
  if (existsSync(gitBinary)) {
    return gitBinary;
  }

  return name;
}

const scpCommand = resolveSshBinary("scp");
const sshCommand = resolveSshBinary("ssh");
const sshKeygenCommand = resolveSshBinary("ssh-keygen");
const sshKeyscanCommand = resolveSshBinary("ssh-keyscan");

async function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: "inherit" | "ignore" } = {}) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function runQuiet(command: string, args: string[]) {
  try {
    await run(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function securePrivateKeyFile(targetPath: string) {
  if (process.platform === "win32") {
    const username = process.env.USERNAME;

    if (!username) {
      throw new Error("USERNAME is required to secure the SSH private key on Windows.");
    }

    const ok = await runQuiet("icacls", [
      targetPath,
      "/inheritance:r",
      "/grant:r",
      `${username}:(F)`,
      "/grant:r",
      "SYSTEM:(F)",
    ]);

    if (!ok) {
      throw new Error("Unable to secure the SSH private key ACLs on Windows.");
    }

    return;
  }

  await fs.chmod(targetPath, 0o600);
}

async function readSecret(secretId: string) {
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  const content = response.SecretString ?? "";

  if (!content.trim()) {
    throw new Error(`Secret ${secretId} is empty.`);
  }

  return content;
}

async function choosePrivateKey(secretContent: string, targetPath: string) {
  const raw = stripWrappingQuotes(secretContent).replace(/\r/g, "");
  const candidates = [raw, raw.replace(/\\n/g, "\n")];

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("PRIVATE KEY")) {
      candidates.push(decoded);
    }
  } catch {
    // Ignore base64 decode failures.
  }

  for (const candidate of candidates) {
    const normalized = candidate.endsWith("\n") ? candidate : `${candidate}\n`;
    await fs.writeFile(targetPath, normalized, { encoding: "utf8", mode: 0o600 });
    await securePrivateKeyFile(targetPath);

    if (await runQuiet(sshKeygenCommand, ["-y", "-f", targetPath])) {
      return;
    }
  }

  throw new Error("Unable to decode a valid SSH private key from Secrets Manager.");
}

async function captureHostKey(host: string) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(sshKeyscanCommand, ["-H", host], {
      stdio: ["ignore", "pipe", "inherit"],
      shell: false,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 && output.trim()) {
        resolve(output);
        return;
      }

      reject(new Error(`${sshKeyscanCommand} ${host} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  const targetEnv = requireEnv("TARGET_ENV");
  const deployHost = requireEnv("DEPLOY_HOST");
  const deploySshUser = requireEnv("DEPLOY_SSH_USER");
  const deploySshKeySecretId = requireEnv("DEPLOY_SSH_KEY_SECRET_ID");
  const deployEnvSecretId = requireEnv("DEPLOY_ENV_SECRET_ID");
  const appBaseUrl = requireEnv("APP_BASE_URL");
  const requireHttps = process.env.DEPLOY_REQUIRE_HTTPS ?? "true";
  const releaseSha =
    process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ||
    process.env.XUPRA_RELEASE_SHA ||
    new Date().toISOString().replace(/[:.]/g, "-");
  const releaseShortSha = releaseSha.slice(0, 8);
  const releaseRef = process.env.CODEBUILD_WEBHOOK_HEAD_REF || process.env.CODEBUILD_SOURCE_VERSION || targetEnv;
  const pipelineId = process.env.CODEBUILD_BUILD_ID || "local-ssh-deploy";
  const deployedAt = new Date().toISOString();

  validateAppBaseUrl(appBaseUrl, requireHttps);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `xupra-aws-deploy-${targetEnv}-`));
  const releaseTarPath = path.join(tempDir, "release.tar");
  const deployEnvPath = path.join(tempDir, "deploy.env");
  const knownHostsPath = path.join(tempDir, "known_hosts");
  const keyPath = path.join(tempDir, "deploy_key");
  const bootstrapPath = path.join(tempDir, "remote-bootstrap.sh");

  try {
    await run(
      "tar",
      [
        "--exclude=.git",
        "--exclude=.next",
        "--exclude=node_modules",
        "--exclude=storage/cicd",
        "-cf",
        releaseTarPath,
        ".",
      ],
      { cwd: process.cwd() },
    );

    const [sshKeySecret, deployEnvSecret] = await Promise.all([
      readSecret(deploySshKeySecretId),
      readSecret(deployEnvSecretId),
    ]);

    await choosePrivateKey(sshKeySecret, keyPath);

    const deployEnvContent = upsertEnvEntries(deployEnvSecret, {
      APP_BASE_URL: appBaseUrl,
      XUPRA_RELEASE_SHA: releaseSha,
      XUPRA_RELEASE_SHORT_SHA: releaseShortSha,
      XUPRA_RELEASE_REF: releaseRef,
      XUPRA_RELEASE_PIPELINE_ID: pipelineId,
      XUPRA_RELEASE_DEPLOYED_AT: deployedAt,
    });
    await fs.writeFile(deployEnvPath, deployEnvContent, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(deployEnvPath, 0o600);
    await fs.writeFile(
      bootstrapPath,
      (await fs.readFile(path.join(process.cwd(), "scripts", "deploy", "remote-bootstrap.sh"), "utf8")).replace(/\r\n/g, "\n"),
      "utf8",
    );

    await fs.writeFile(knownHostsPath, await captureHostKey(deployHost), "utf8");

    const sshOptions = [
      "-i",
      keyPath,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      `UserKnownHostsFile=${knownHostsPath}`,
    ];
    const remote = `${deploySshUser}@${deployHost}`;

    await run(scpCommand, [...sshOptions, releaseTarPath, `${remote}:/tmp/xupra-release.tar`]);
    await run(scpCommand, [...sshOptions, deployEnvPath, `${remote}:/tmp/xupra-deploy.env`]);
    await run(scpCommand, [...sshOptions, bootstrapPath, `${remote}:/tmp/xupra-bootstrap.sh`]);

    const remoteCommand = [
      "chmod +x /tmp/xupra-bootstrap.sh",
      `sudo APP_DIR=/srv/xupra-drylake APP_USER=xupra APP_GROUP=xupra RELEASE_TAR=/tmp/xupra-release.tar ENV_FILE=/tmp/xupra-deploy.env REQUIRE_HTTPS_URL=${shellQuote(requireHttps)} bash /tmp/xupra-bootstrap.sh`,
    ].join(" && ");

    await run(sshCommand, [...sshOptions, remote, remoteCommand]);

    console.log(
      JSON.stringify(
        {
          targetEnv,
          deployHost,
          deployEnvSecretId,
          deploySshKeySecretId,
          releaseSha,
        },
        null,
        2,
      ),
    );
    console.log(`Deployment succeeded for ${targetEnv} (${releaseShortSha}).`);
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
