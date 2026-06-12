import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getS3Client } from "@/lib/aws/clients";
import { env } from "@/lib/env";

const STORAGE_ROOT = process.env.ARTIFACT_STORAGE_ROOT?.trim()
  ? path.resolve(process.env.ARTIFACT_STORAGE_ROOT)
  : path.join(process.cwd(), "storage");

function toRelativeLogicalPath(logicalPath: string) {
  return logicalPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "_");
}

function storagePathFromKey(storageKey: string) {
  return path.join(STORAGE_ROOT, storageKey.replace(/\//g, path.sep));
}

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function inferMimeType(logicalPath: string, fallback = "application/octet-stream") {
  const normalized = logicalPath.toLowerCase();

  if (normalized.endsWith(".md") || normalized.endsWith(".mdc")) {
    return "text/markdown";
  }

  if (normalized.endsWith(".json") || normalized.endsWith(".json5")) {
    return "application/json";
  }

  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) {
    return "application/yaml";
  }

  if (normalized.endsWith(".toml")) {
    return "application/toml";
  }

  if (normalized.endsWith(".py")) {
    return "text/x-python";
  }

  if (normalized.endsWith(".txt")) {
    return "text/plain";
  }

  if (normalized.endsWith(".zip")) {
    return "application/zip";
  }

  return fallback;
}

async function saveToS3(storageKey: string, buffer: Buffer, mimeType: string) {
  const s3Client = getS3Client();

  if (!s3Client || !env.AWS_S3_BUCKET) {
    throw new Error("S3 artifact storage is not configured");
  }

  const objectKey = path.posix.join(env.AWS_S3_PREFIX, storageKey);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      ...(env.AWS_KMS_KEY_ID
        ? {
            ServerSideEncryption: "aws:kms" as const,
            SSEKMSKeyId: env.AWS_KMS_KEY_ID,
          }
        : {}),
    }),
  );

  return objectKey;
}

async function readFromS3(storageKey: string) {
  const s3Client = getS3Client();

  if (!s3Client || !env.AWS_S3_BUCKET) {
    throw new Error("S3 artifact storage is not configured");
  }

  const objectKey = path.posix.join(env.AWS_S3_PREFIX, storageKey);
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error(`Artifact body missing for ${storageKey}`);
  }

  const text = await response.Body.transformToString();
  return Buffer.from(text, "utf8");
}

export async function saveArtifactBuffer(params: {
  versionId: string;
  kind:
    | "raw_source"
    | "generated_export"
    | "normalized_source"
    | "diff_preview"
    | "deployment_output";
  logicalPath: string;
  buffer: Buffer;
  mimeType?: string;
}) {
  const normalizedPath = toRelativeLogicalPath(params.logicalPath);
  const storageKey = path.posix.join("versions", params.versionId, params.kind, normalizedPath);
  const mimeType = params.mimeType ?? inferMimeType(normalizedPath);

  if (env.ARTIFACT_STORAGE_DRIVER === "s3") {
    await saveToS3(storageKey, params.buffer, mimeType);
  } else {
    const fullPath = storagePathFromKey(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, params.buffer);
  }

  return {
    storageKey,
    sizeBytes: params.buffer.byteLength,
    checksumSha256: checksum(params.buffer),
    mimeType,
  };
}

export async function saveArtifactText(params: {
  versionId: string;
  kind:
    | "raw_source"
    | "generated_export"
    | "normalized_source"
    | "diff_preview"
    | "deployment_output";
  logicalPath: string;
  text: string;
  mimeType?: string;
}) {
  return saveArtifactBuffer({
    ...params,
    buffer: Buffer.from(params.text, "utf8"),
    mimeType: params.mimeType ?? inferMimeType(params.logicalPath, "text/plain"),
  });
}

export async function saveGuardArtifactText(params: {
  guardScanId: string;
  logicalPath: string;
  text: string;
  mimeType?: string;
}) {
  const normalizedPath = toRelativeLogicalPath(params.logicalPath);
  const storageKey = path.posix.join("guard", "scans", params.guardScanId, "artifacts", normalizedPath);
  const buffer = Buffer.from(params.text, "utf8");
  const mimeType = params.mimeType ?? inferMimeType(params.logicalPath, "text/plain");

  if (env.ARTIFACT_STORAGE_DRIVER === "s3") {
    await saveToS3(storageKey, buffer, mimeType);
  } else {
    const fullPath = storagePathFromKey(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  }

  return {
    storageKey,
    sizeBytes: buffer.byteLength,
    checksumSha256: checksum(buffer),
    mimeType,
  };
}

export async function readArtifactText(storageKey: string) {
  const file =
    env.ARTIFACT_STORAGE_DRIVER === "s3"
      ? await readFromS3(storageKey)
      : await readFile(storagePathFromKey(storageKey));
  return file.toString("utf8");
}
