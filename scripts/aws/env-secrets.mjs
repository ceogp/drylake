#!/usr/bin/env node
import {
  CreateSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VALID_ENVS = new Set(["development", "staging", "production"]);
const DEFAULT_PREFIX = "xupra-drylake";

function usage() {
  return [
    "Usage:",
    "  node scripts/aws/env-secrets.mjs push --env <development|staging|production> [--file .env] [--secret-id <id>] [--region <region>] [--confirm production]",
    "  node scripts/aws/env-secrets.mjs pull --env <development|staging|production> [--file .env] [--secret-id <id>] [--region <region>] [--force]",
    "  node scripts/aws/env-secrets.mjs check --env <development|staging|production> [--file .env] [--secret-id <id>] [--from aws] [--region <region>]",
    "  node scripts/aws/env-secrets.mjs print --secret-id <id> [--region <region>]",
    "",
    "Environment:",
    "  AWS_REGION, AWS_DEFAULT_REGION, --region, ~/.aws/config region, or AWS_REGION in the pushed file must be set.",
    "  AWS_PROFILE, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS web identity auth may be used.",
  ].join("\n");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help" };
  }

  const flags = { command, _: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      flags._.push(item);
      continue;
    }

    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function applyPositionalFallbacks(flags) {
  const positional = flags._ || [];

  if (flags.command === "push" || flags.command === "pull" || flags.command === "check") {
    if (flags.command === "check" && positional[0] === "aws") {
      flags.from = flags.from || "aws";
      flags["secret-id"] = flags["secret-id"] || positional[1];
      flags.region = flags.region || positional[2];
      return flags;
    }

    flags.env = flags.env || positional[0];
    flags.file = flags.file || positional[1];

    if (flags.command === "push" && flags.env === "production" && positional[2] === "production") {
      flags.confirm = flags.confirm || "production";
    } else {
      flags["secret-id"] = flags["secret-id"] || positional[2];
    }

    flags.region = flags.region || positional[3];
    return flags;
  }

  if (flags.command === "print") {
    flags["secret-id"] = flags["secret-id"] || positional[0];
    flags.region = flags.region || positional[1];
  }

  return flags;
}

function npmConfig(name) {
  return process.env[`npm_config_${name.replace(/-/g, "_")}`] || process.env[`npm_config_${name}`] || "";
}

function applyNpmConfigFallbacks(flags) {
  for (const name of ["confirm", "env", "file", "from", "kms-key-id", "region", "secret-id"]) {
    const value = npmConfig(name);
    if (!flags[name] && value && value !== "true") {
      flags[name] = value;
    }
  }

  if (!flags.force && npmConfig("force") === "true") {
    flags.force = "true";
  }

  return flags;
}

function requiredFlag(flags, name) {
  const value = flags[name];
  if (!value || value === "true") {
    throw new Error(`Missing --${name}`);
  }

  return String(value);
}

function envName(flags) {
  const value = requiredFlag(flags, "env");
  if (!VALID_ENVS.has(value)) {
    throw new Error(`Invalid --env value: ${value}`);
  }

  return value;
}

function secretIdFor(flags) {
  if (flags["secret-id"] && flags["secret-id"] !== "true") {
    return String(flags["secret-id"]);
  }

  const env = envName(flags);
  const prefix = String(flags.prefix || process.env.AWS_SECRETS_PREFIX || DEFAULT_PREFIX).replace(/\/+$/, "");
  return `${prefix}/${env}/env`;
}

function sharedAwsConfigRegion() {
  const profile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || "default";
  const configPath = path.join(os.homedir(), ".aws", "config");
  if (!fs.existsSync(configPath)) {
    return "";
  }

  const expectedHeader = profile === "default" ? "default" : `profile ${profile}`;
  let activeSection = "";

  for (const line of fs.readFileSync(configPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    const header = trimmed.match(/^\[(.+)]$/);
    if (header) {
      activeSection = header[1].trim();
      continue;
    }

    if (activeSection === expectedHeader) {
      const match = trimmed.match(/^region\s*=\s*(.+)$/);
      if (match) {
        return stripQuotes(match[1]);
      }
    }
  }

  return "";
}

function region(flags = {}, values = {}) {
  const value = flags.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    values.AWS_REGION ||
    values.AWS_DEFAULT_REGION ||
    sharedAwsConfigRegion();
  if (!value) {
    throw new Error("AWS_REGION, AWS_DEFAULT_REGION, --region, or ~/.aws/config region is required.");
  }

  return value;
}

function client(flags = {}, values = {}) {
  return new SecretsManagerClient({ region: region(flags, values) });
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

function readEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file does not exist: ${resolved}`);
  }

  const content = fs.readFileSync(resolved, "utf8");
  if (!content.trim()) {
    throw new Error(`Env file is empty: ${resolved}`);
  }

  return { resolved, content: content.endsWith("\n") ? content : `${content}\n` };
}

function validateEnvBundle(content, env) {
  const values = parseDotenv(content);
  const required = ["DATABASE_URL", "APP_BASE_URL", "APP_ENCRYPTION_KEY", "AUTH_MODE"];
  const warnings = [];

  if (env === "production" || env === "staging") {
    required.push("ARTIFACT_STORAGE_DRIVER", "AWS_REGION", "AWS_S3_BUCKET");
  }

  if (values.AUTH_MODE === "clerk") {
    required.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET");
  }

  if (values.AI_PROVIDER === "openai" || !values.AI_PROVIDER) {
    required.push("OPENAI_API_KEY");
  }

  if (values.AI_PROVIDER === "bedrock_openai") {
    required.push("BEDROCK_OPENAI_API_KEY");
    if (!values.BEDROCK_OPENAI_REGION && !values.AWS_REGION && !values.BEDROCK_OPENAI_BASE_URL) {
      warnings.push("BEDROCK_OPENAI_REGION, AWS_REGION, or BEDROCK_OPENAI_BASE_URL is required for Bedrock OpenAI.");
    }
  }

  if (values.AI_PROVIDER === "bedrock_anthropic") {
    if (!values.BEDROCK_API_KEY && !values.AWS_BEARER_TOKEN_BEDROCK && !values.BEDROCK_OPENAI_API_KEY) {
      required.push("BEDROCK_API_KEY or AWS_BEARER_TOKEN_BEDROCK");
    }

    if (!values.BEDROCK_REGION && !values.BEDROCK_OPENAI_REGION && !values.AWS_REGION) {
      warnings.push("BEDROCK_REGION, BEDROCK_OPENAI_REGION, or AWS_REGION is required for Bedrock Anthropic.");
    }
  }

  if (values.BILLING_PROVIDER === "stripe" && values.BILLING_ENFORCEMENT_MODE === "strict") {
    required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID");
  }

  const missing = required.filter((key) => {
    if (key === "BEDROCK_API_KEY or AWS_BEARER_TOKEN_BEDROCK") {
      return !values.BEDROCK_API_KEY && !values.AWS_BEARER_TOKEN_BEDROCK && !values.BEDROCK_OPENAI_API_KEY;
    }

    return !values[key];
  });

  if (values.APP_ENCRYPTION_KEY && values.APP_ENCRYPTION_KEY.length < 32) {
    warnings.push("APP_ENCRYPTION_KEY should be at least 32 characters.");
  }

  if ((env === "production" || env === "staging") && values.ARTIFACT_STORAGE_DRIVER !== "s3") {
    warnings.push("ARTIFACT_STORAGE_DRIVER should be s3 for deployed environments.");
  }

  return {
    keys: Object.keys(values).sort(),
    missing,
    warnings,
  };
}

async function secretExists(secretsClient, secretId) {
  try {
    await secretsClient.send(new DescribeSecretCommand({ SecretId: secretId }));
    return true;
  } catch (error) {
    if (error?.name === "ResourceNotFoundException") {
      return false;
    }

    throw error;
  }
}

async function putSecret(secretsClient, secretId, content, flags, env) {
  const tags = [
    { Key: "Project", Value: "xupra-drylake" },
    { Key: "Environment", Value: env },
    { Key: "ManagedBy", Value: "scripts/aws/env-secrets.mjs" },
  ];
  const kmsKeyId = flags["kms-key-id"] || process.env.AWS_KMS_KEY_ID || undefined;

  if (await secretExists(secretsClient, secretId)) {
    await secretsClient.send(new PutSecretValueCommand({
      SecretId: secretId,
      SecretString: content,
    }));
    return "updated";
  }

  await secretsClient.send(new CreateSecretCommand({
    Name: secretId,
    SecretString: content,
    KmsKeyId: kmsKeyId,
    Tags: tags,
  }));
  return "created";
}

async function getSecret(secretsClient, secretId) {
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = result.SecretString ?? "";
  if (!value.trim()) {
    throw new Error(`Secret is empty: ${secretId}`);
  }

  return value.endsWith("\n") ? value : `${value}\n`;
}

async function commandPush(flags) {
  const env = envName(flags);
  if (env === "production" && flags.confirm !== "production") {
    throw new Error("Refusing production push without --confirm production.");
  }

  const file = String(flags.file || ".env");
  const { resolved, content } = readEnvFile(file);
  const validation = validateEnvBundle(content, env);
  if (validation.missing.length > 0) {
    throw new Error(`Refusing to push ${env} env bundle. Missing required keys: ${validation.missing.join(", ")}`);
  }

  const secretId = secretIdFor(flags);
  const status = await putSecret(client(flags, parseDotenv(content)), secretId, content, flags, env);

  console.log(`${status === "created" ? "Created" : "Updated"} AWS Secrets Manager env bundle.`);
  console.log(`SecretId: ${secretId}`);
  console.log(`Source: ${resolved}`);
  console.log(`Keys: ${validation.keys.length}`);
  for (const warning of validation.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

async function commandPull(flags) {
  const env = envName(flags);
  const file = String(flags.file || ".env");
  const resolved = path.resolve(file);
  if (fs.existsSync(resolved) && flags.force !== "true") {
    throw new Error(`Refusing to overwrite ${resolved} without --force.`);
  }

  const secretId = secretIdFor(flags);
  const content = await getSecret(client(flags), secretId);
  const validation = validateEnvBundle(content, env);

  fs.writeFileSync(resolved, content, { mode: 0o600 });
  console.log("Pulled AWS Secrets Manager env bundle.");
  console.log(`SecretId: ${secretId}`);
  console.log(`Target: ${resolved}`);
  console.log(`Keys: ${validation.keys.length}`);
  for (const warning of validation.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

async function commandCheck(flags) {
  const env = envName(flags);
  const shouldReadAws = Boolean(flags["secret-id"]) || flags.from === "aws";
  const secretId = shouldReadAws ? secretIdFor(flags) : "";
  const content = secretId
    ? await getSecret(client(flags), secretId)
    : readEnvFile(String(flags.file || ".env")).content;
  const validation = validateEnvBundle(content, env);

  console.log(`Env: ${env}`);
  if (secretId) {
    console.log(`SecretId: ${secretId}`);
  }
  console.log(`Keys: ${validation.keys.length}`);

  if (validation.missing.length > 0) {
    console.error(`Missing required keys: ${validation.missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Required keys: ok");
  }

  for (const warning of validation.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

async function commandPrint(flags) {
  const secretId = requiredFlag(flags, "secret-id");
  const content = await getSecret(client(flags), secretId);
  process.stdout.write(content);
}

async function main() {
  const flags = applyPositionalFallbacks(applyNpmConfigFallbacks(parseArgs(process.argv.slice(2))));

  if (flags.command === "help" || flags.help === "true" || flags.h === "true") {
    console.log(usage());
    return;
  }

  if (flags.command === "push") {
    await commandPush(flags);
  } else if (flags.command === "pull") {
    await commandPull(flags);
  } else if (flags.command === "check") {
    await commandCheck(flags);
  } else if (flags.command === "print") {
    await commandPrint(flags);
  } else {
    throw new Error(`Unknown command: ${flags.command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
