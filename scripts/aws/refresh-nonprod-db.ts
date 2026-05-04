import { loadEnvConfig } from "@next/env";
import {
  CreateDBSnapshotCommand,
  DBInstance,
  DescribeDBInstancesCommand,
  DescribeDBSnapshotsCommand,
  RDSClient,
  RestoreDBInstanceFromDBSnapshotCommand,
  waitUntilDBInstanceAvailable,
  waitUntilDBSnapshotAvailable,
} from "@aws-sdk/client-rds";
import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

loadEnvConfig(process.cwd());

type TargetEnvironment = "development" | "staging";

type GitLabVariable = {
  key: string;
  value: string;
  variable_type?: string;
};

type ParsedEnv = Record<string, string>;

type AwsManifest = {
  environment: TargetEnvironment;
  publicIp: string;
  sshUser: string;
  sshKeyPath: string;
};

type RefreshOptions = {
  environment: TargetEnvironment;
  execute: boolean;
  sanitizeUsers: boolean;
  syncS3: boolean;
  sourceSnapshot?: string;
  restoredIdentifier?: string;
};

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const rds = new RDSClient({ region });
const s3 = new S3Client({ region });

function usage() {
  return `
Usage:
  npx tsx scripts/aws/refresh-nonprod-db.ts --environment development --execute
  npx tsx scripts/aws/refresh-nonprod-db.ts --environment staging --execute

Options:
  --environment <development|staging>  Non-production environment to refresh.
  --execute                           Actually create/restore/update. Without this, runs a dry-run.
  --source-snapshot <id|arn>           Reuse an existing production snapshot.
  --restored-identifier <id>           Override the new restored RDS identifier.
  --sanitize-users                     Also anonymize User/Profile emails, auth subjects, and names.
  --no-s3-sync                         Do not copy production artifacts into the target S3 prefix.
`.trim();
}

function parseArgs(argv: string[]): RefreshOptions {
  const options: RefreshOptions = {
    environment: "development",
    execute: false,
    sanitizeUsers: false,
    syncS3: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (arg === "--execute") {
      options.execute = true;
      continue;
    }

    if (arg === "--sanitize-users") {
      options.sanitizeUsers = true;
      continue;
    }

    if (arg === "--no-s3-sync") {
      options.syncS3 = false;
      continue;
    }

    if (arg === "--environment") {
      if (next !== "development" && next !== "staging") {
        throw new Error("--environment must be development or staging.");
      }
      options.environment = next;
      index += 1;
      continue;
    }

    if (arg === "--source-snapshot") {
      if (!next) throw new Error("--source-snapshot requires a value.");
      options.sourceSnapshot = next;
      index += 1;
      continue;
    }

    if (arg === "--restored-identifier") {
      if (!next) throw new Error("--restored-identifier requires a value.");
      options.restoredIdentifier = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").toLowerCase();
}

function randomPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function parseEnvFile(value: string) {
  const parsed: ParsedEnv = {};

  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const rawValue = match[2].trim();
    parsed[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }

  return parsed;
}

function updateEnvValue(raw: string, key: string, value: string) {
  const escaped = value.replace(/\r?\n/g, "");
  const lines = raw.split(/\r?\n/);
  let found = false;

  const nextLines = lines.map((line) => {
    if (line.match(new RegExp(`^${key}=`))) {
      found = true;
      return `${key}=${escaped}`;
    }

    return line;
  });

  if (!found) {
    nextLines.push(`${key}=${escaped}`);
  }

  return nextLines.join("\n").replace(/\n*$/, "\n");
}

function requireUrl(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return new URL(value);
}

function databaseEndpointFromUrl(value: string | undefined, label: string) {
  return requireUrl(value, label).hostname.toLowerCase();
}

function databaseUrlWithHost(value: string, host: string) {
  const url = new URL(value);
  url.hostname = host;
  url.port = url.port || "5432";
  return url.toString();
}

function databaseUrlWithPassword(value: string, password: string) {
  const url = new URL(value);
  url.password = password;
  return url.toString();
}

function prefixFor(environment: TargetEnvironment) {
  return environment === "development" ? "DEVELOPMENT" : "STAGING";
}

function projectId() {
  return process.env.GITLAB_PROJECT_ID || "81471775";
}

async function gitlabRequest<T>(apiPath: string, init: RequestInit = {}) {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error("GITLAB_TOKEN is required to read and update GitLab env file variables.");
  }

  const response = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId())}${apiPath}`, {
    ...init,
    headers: {
      "PRIVATE-TOKEN": token,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitLab API ${apiPath} failed with ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function getGitLabVariable(key: string) {
  return gitlabRequest<GitLabVariable>(`/variables/${encodeURIComponent(key)}`);
}

async function updateGitLabVariableValue(key: string, value: string) {
  const body = new URLSearchParams();
  body.set("value", value);

  await gitlabRequest<GitLabVariable>(`/variables/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function describeAllDbInstances() {
  const instances: DBInstance[] = [];
  let marker: string | undefined;

  do {
    const response = await rds.send(
      new DescribeDBInstancesCommand({
        Marker: marker,
        MaxRecords: 100,
      }),
    );

    instances.push(...(response.DBInstances ?? []));
    marker = response.Marker;
  } while (marker);

  return instances;
}

async function findDbByEndpoint(endpoint: string) {
  const instances = await describeAllDbInstances();
  return (
    instances.find((instance) => instance.Endpoint?.Address?.toLowerCase() === endpoint.toLowerCase()) ?? null
  );
}

async function snapshotProduction(source: DBInstance, providedSnapshot?: string) {
  if (providedSnapshot) {
    await rds.send(new DescribeDBSnapshotsCommand({ DBSnapshotIdentifier: providedSnapshot }));
    return providedSnapshot;
  }

  if (!source.DBInstanceIdentifier) {
    throw new Error("Unable to resolve source production DB instance identifier.");
  }

  const snapshotIdentifier = `${source.DBInstanceIdentifier}-refresh-${timestamp()}`;

  await rds.send(
    new CreateDBSnapshotCommand({
      DBInstanceIdentifier: source.DBInstanceIdentifier,
      DBSnapshotIdentifier: snapshotIdentifier,
      Tags: [
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "SourceEnvironment", Value: "production" },
        { Key: "Purpose", Value: "nonprod-refresh" },
      ],
    }),
  );

  await waitUntilDBSnapshotAvailable(
    { client: rds, maxWaitTime: 3600 },
    { DBSnapshotIdentifier: snapshotIdentifier },
  );

  return snapshotIdentifier;
}

async function restoreTargetDb(params: {
  targetEnvironment: TargetEnvironment;
  targetCurrent: DBInstance;
  snapshotIdentifier: string;
  restoredIdentifier: string;
}) {
  const target = params.targetCurrent;
  const subnetGroupName = target.DBSubnetGroup?.DBSubnetGroupName;
  const securityGroupIds = target.VpcSecurityGroups?.map((group) => group.VpcSecurityGroupId).filter(Boolean) as
    | string[]
    | undefined;

  if (!subnetGroupName) {
    throw new Error("Target DB subnet group could not be resolved.");
  }

  if (!securityGroupIds?.length) {
    throw new Error("Target DB security group could not be resolved.");
  }

  await rds.send(
    new RestoreDBInstanceFromDBSnapshotCommand({
      DBInstanceIdentifier: params.restoredIdentifier,
      DBSnapshotIdentifier: params.snapshotIdentifier,
      DBInstanceClass: target.DBInstanceClass,
      DBSubnetGroupName: subnetGroupName,
      VpcSecurityGroupIds: securityGroupIds,
      PubliclyAccessible: false,
      DeletionProtection: true,
      CopyTagsToSnapshot: true,
      Tags: [
        { Key: "Name", Value: params.restoredIdentifier },
        { Key: "Project", Value: "xupra-drylake" },
        { Key: "Environment", Value: params.targetEnvironment },
        { Key: "SourceEnvironment", Value: "production" },
        { Key: "Purpose", Value: "nonprod-refresh" },
      ],
    }),
  );

  await waitUntilDBInstanceAvailable(
    { client: rds, maxWaitTime: 5400 },
    { DBInstanceIdentifier: params.restoredIdentifier },
  );

  const restored = await rds.send(
    new DescribeDBInstancesCommand({
      DBInstanceIdentifier: params.restoredIdentifier,
    }),
  );

  const instance = restored.DBInstances?.[0];
  if (!instance?.Endpoint?.Address) {
    throw new Error("Restored DB instance is available but has no endpoint.");
  }

  return instance;
}

async function copyS3Prefix(params: {
  sourceBucket: string;
  sourcePrefix: string;
  targetBucket: string;
  targetPrefix: string;
}) {
  if (params.sourceBucket === params.targetBucket) {
    throw new Error("Refusing to sync artifacts into the production bucket.");
  }

  const sourcePrefix = params.sourcePrefix.replace(/^\/+|\/+$/g, "");
  const targetPrefix = params.targetPrefix.replace(/^\/+|\/+$/g, "");
  let continuationToken: string | undefined;
  let copied = 0;

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: params.sourceBucket,
        Prefix: sourcePrefix ? `${sourcePrefix}/` : undefined,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of listed.Contents ?? []) {
      if (!object.Key) continue;
      const suffix = sourcePrefix ? object.Key.slice(`${sourcePrefix}/`.length) : object.Key;
      if (!suffix) continue;

      await s3.send(
        new CopyObjectCommand({
          Bucket: params.targetBucket,
          Key: targetPrefix ? `${targetPrefix}/${suffix}` : suffix,
          CopySource: encodeURI(`${params.sourceBucket}/${object.Key}`),
          MetadataDirective: "COPY",
        }),
      );

      copied += 1;
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);

  return copied;
}

async function readManifest(environment: TargetEnvironment) {
  const manifestPath = path.join(process.cwd(), "storage", "environments", environment, "aws-manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as AwsManifest;
}

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: "inherit" });
}

async function runRemoteSanitizer(params: {
  manifest: AwsManifest;
  connectionUrl: string;
  newDatabasePassword: string;
  environment: TargetEnvironment;
  sanitizeUsers: boolean;
}) {
  const nonce = crypto.randomBytes(8).toString("hex");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "xupra-db-refresh-"));
  const localScript = path.join(tempDir, "sanitize.js");
  const localEnv = path.join(tempDir, "sanitize.env");
  const remoteScript = `/tmp/xupra-refresh-${nonce}.js`;
  const remoteEnv = `/tmp/xupra-refresh-${nonce}.env`;

  const script = String.raw`
const { Client } = require("pg");

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function scalar(client, sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const before = {
    credentials: await scalar(client, 'SELECT COUNT(*) AS count FROM "Credential"'),
    extensionAuthRequests: await scalar(client, 'SELECT COUNT(*) AS count FROM "ExtensionAuthRequest"'),
    stripeReferences: await scalar(client, 'SELECT COUNT(*) AS count FROM "Subscription" WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL OR "stripePriceId" IS NOT NULL'),
  };

  await client.query('DELETE FROM "ExtensionAuthRequest"');
  await client.query('DELETE FROM "CredentialAccessLog"');
  await client.query('DELETE FROM "Credential"');
  await client.query('UPDATE "Integration" SET "credentialId" = NULL, "configJson" = NULL, "status" = $1, "lastVerifiedAt" = NULL', ["pending"]);
  await client.query('UPDATE "DeploymentTarget" SET "configJson" = NULL');
  await client.query('UPDATE "Subscription" SET "stripeCustomerId" = NULL, "stripeSubscriptionId" = NULL, "stripePriceId" = NULL, "tier" = $1, "status" = $2, "currentPeriodEndsAt" = NULL, "cancelAtPeriodEnd" = false', ["free", "trial"]);
  await client.query('UPDATE "Organization" SET "tier" = $1', ["free"]);
  await client.query('UPDATE "AuditEvent" SET "metadataJson" = NULL');
  await client.query('UPDATE "TransformJob" SET "status" = $1, "errorJson" = $2::jsonb, "finishedAt" = COALESCE("finishedAt", now()) WHERE "status" IN ($3, $4, $5)', ["failed", JSON.stringify({ message: "Reset during non-production refresh." }), "queued", "running", "processing"]);
  await client.query('UPDATE "DeploymentJob" SET "status" = $1, "errorJson" = $2::jsonb, "finishedAt" = COALESCE("finishedAt", now()) WHERE "status" IN ($3, $4, $5)', ["failed", JSON.stringify({ message: "Reset during non-production refresh." }), "queued", "running", "processing"]);

  if (process.env.SANITIZE_USERS === "true") {
    await client.query('UPDATE "User" SET "email" = concat($1, left(md5("id"), 16), $2), "authProvider" = $3, "authSubject" = NULL', ["user+", "@example.invalid", "sanitized"]);
    await client.query('UPDATE "Profile" SET "displayName" = concat($1, left(md5("userId"), 8)), "avatarUrl" = NULL', ["Sanitized User "]);
  }

  const databaseUser = decodeURIComponent(new URL(process.env.DATABASE_URL).username);
  await client.query('ALTER USER ' + quoteIdent(databaseUser) + ' WITH PASSWORD $1', [process.env.NEW_DATABASE_PASSWORD]);

  const after = {
    credentials: await scalar(client, 'SELECT COUNT(*) AS count FROM "Credential"'),
    extensionAuthRequests: await scalar(client, 'SELECT COUNT(*) AS count FROM "ExtensionAuthRequest"'),
    stripeReferences: await scalar(client, 'SELECT COUNT(*) AS count FROM "Subscription" WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL OR "stripePriceId" IS NOT NULL'),
  };

  await client.end();
  console.log(JSON.stringify({ environment: process.env.TARGET_ENV, before, after }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

  await fs.writeFile(localScript, script, "utf8");
  await fs.writeFile(
    localEnv,
    [
      `DATABASE_URL=${params.connectionUrl}`,
      `NEW_DATABASE_PASSWORD=${params.newDatabasePassword}`,
      `TARGET_ENV=${params.environment}`,
      `SANITIZE_USERS=${params.sanitizeUsers ? "true" : "false"}`,
      "",
    ].join("\n"),
    "utf8",
  );

  const sshArgs = [
    "-i",
    params.manifest.sshKeyPath,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=NUL",
  ];
  const remote = `${params.manifest.sshUser}@${params.manifest.publicIp}`;

  try {
    run("scp", [...sshArgs, localScript, `${remote}:${remoteScript}`]);
    run("scp", [...sshArgs, localEnv, `${remote}:${remoteEnv}`]);
    run("ssh", [
      ...sshArgs,
      remote,
      `set -euo pipefail; chmod 600 ${remoteEnv}; set -a; . ${remoteEnv}; set +a; cd /srv/xupra-drylake/current; node ${remoteScript}; rm -f ${remoteScript} ${remoteEnv}`,
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetPrefix = prefixFor(options.environment);
  const productionEnvVariable = await getGitLabVariable("PRODUCTION_ENV_FILE");
  const targetEnvVariable = await getGitLabVariable(`${targetPrefix}_ENV_FILE`);
  const productionEnv = parseEnvFile(productionEnvVariable.value);
  const targetEnv = parseEnvFile(targetEnvVariable.value);
  const productionDbHost = databaseEndpointFromUrl(productionEnv.DATABASE_URL, "PRODUCTION_ENV_FILE DATABASE_URL");
  const targetDbHost = databaseEndpointFromUrl(targetEnv.DATABASE_URL, `${targetPrefix}_ENV_FILE DATABASE_URL`);
  const productionBucket = productionEnv.AWS_S3_BUCKET;
  const targetBucket = targetEnv.AWS_S3_BUCKET;
  const productionPrefix = productionEnv.AWS_S3_PREFIX ?? "";
  const targetArtifactPrefix = targetEnv.AWS_S3_PREFIX ?? "";

  if (!productionBucket || !targetBucket) {
    throw new Error("Both production and target env files must set AWS_S3_BUCKET.");
  }

  if (productionDbHost === targetDbHost) {
    throw new Error("Refusing refresh because production and target DATABASE_URL hosts match.");
  }

  if (productionBucket === targetBucket) {
    throw new Error("Refusing refresh because production and target AWS_S3_BUCKET values match.");
  }

  const productionDb = await findDbByEndpoint(productionDbHost);
  const targetCurrentDb = await findDbByEndpoint(targetDbHost);

  if (!productionDb?.DBInstanceIdentifier) {
    throw new Error(`Could not resolve production RDS instance for endpoint ${productionDbHost}.`);
  }

  if (!targetCurrentDb?.DBInstanceIdentifier) {
    throw new Error(`Could not resolve target RDS instance for endpoint ${targetDbHost}.`);
  }

  const restoredIdentifier =
    options.restoredIdentifier ?? `${targetCurrentDb.DBInstanceIdentifier}-refresh-${timestamp()}`;

  const summary = {
    mode: options.execute ? "execute" : "dry-run",
    environment: options.environment,
    region,
    sourceDb: productionDb.DBInstanceIdentifier,
    currentTargetDb: targetCurrentDb.DBInstanceIdentifier,
    restoredIdentifier,
    sourceArtifacts: `${productionBucket}/${productionPrefix}`,
    targetArtifacts: `${targetBucket}/${targetArtifactPrefix}`,
    sanitizeUsers: options.sanitizeUsers,
    syncS3: options.syncS3,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!options.execute) {
    console.log("Dry-run only. Re-run with --execute to refresh the target environment.");
    return;
  }

  const manifest = await readManifest(options.environment);
  const snapshotIdentifier = await snapshotProduction(productionDb, options.sourceSnapshot);
  console.log(`Production snapshot ready: ${snapshotIdentifier}`);

  const restored = await restoreTargetDb({
    targetEnvironment: options.environment,
    targetCurrent: targetCurrentDb,
    snapshotIdentifier,
    restoredIdentifier,
  });

  const restoredEndpoint = restored.Endpoint?.Address;
  if (!restoredEndpoint) {
    throw new Error("Restored DB endpoint missing.");
  }

  const rotatedPassword = randomPassword();
  const initialConnectionUrl = databaseUrlWithHost(productionEnv.DATABASE_URL, restoredEndpoint);
  const targetUrlWithRestoredHost = databaseUrlWithHost(targetEnv.DATABASE_URL, restoredEndpoint);
  const rotatedTargetDatabaseUrl = databaseUrlWithPassword(targetUrlWithRestoredHost, rotatedPassword);

  await runRemoteSanitizer({
    manifest,
    connectionUrl: initialConnectionUrl,
    newDatabasePassword: rotatedPassword,
    environment: options.environment,
    sanitizeUsers: options.sanitizeUsers,
  });

  let nextTargetEnv = updateEnvValue(targetEnvVariable.value, "DATABASE_URL", rotatedTargetDatabaseUrl);
  nextTargetEnv = updateEnvValue(nextTargetEnv, "DATABASE_REFRESH_SOURCE_SNAPSHOT", snapshotIdentifier);
  nextTargetEnv = updateEnvValue(nextTargetEnv, "DATABASE_REFRESHED_AT", new Date().toISOString());

  await updateGitLabVariableValue(`${targetPrefix}_ENV_FILE`, nextTargetEnv);
  console.log(`${targetPrefix}_ENV_FILE updated to the restored RDS endpoint.`);

  if (options.syncS3) {
    const copied = await copyS3Prefix({
      sourceBucket: productionBucket,
      sourcePrefix: productionPrefix,
      targetBucket,
      targetPrefix: targetArtifactPrefix,
    });
    console.log(`Copied ${copied} artifact object(s) into ${options.environment} S3.`);
  }

  console.log("Refresh complete. Redeploy the target environment so the app picks up the new DATABASE_URL.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
