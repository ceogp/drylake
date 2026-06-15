import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getS3Client } from "@/lib/aws/clients";
import { env } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type TrustPublicationDriver = "database" | "local" | "s3";

export type TrustCertificatePublicationResult = {
  driver: Exclude<TrustPublicationDriver, "database">;
  publishedAt: string;
  signedCertificateObjectKey: string;
  canonicalObjectKey: string;
  manifestObjectKey: string;
  checksums: {
    signedCertificateSha256: string;
    canonicalSha256: string;
    manifestSha256: string;
  };
};

function trustPublicationRoot() {
  return process.env.XUPRA_TRUST_PUBLICATION_ROOT?.trim()
    ? path.resolve(process.env.XUPRA_TRUST_PUBLICATION_ROOT)
    : path.join(process.cwd(), "storage", "trust-publications");
}

function checksumSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function publicationDriver() {
  return env.XUPRA_TRUST_PUBLICATION_DRIVER as TrustPublicationDriver;
}

function publicationBucket() {
  return env.XUPRA_TRUST_PUBLICATION_BUCKET ?? env.AWS_S3_BUCKET ?? null;
}

function publicationPrefix() {
  return env.XUPRA_TRUST_PUBLICATION_PREFIX.trim().replace(/^\/+|\/+$/g, "");
}

function publicationRelativeKey(certificateId: string, fileName: string) {
  return path.posix.join("certificates", encodeURIComponent(certificateId), fileName);
}

function storageKey(relativeKey: string) {
  const prefix = publicationPrefix();
  return prefix ? path.posix.join(prefix, relativeKey) : relativeKey;
}

function localPathFor(relativeKey: string) {
  return path.join(trustPublicationRoot(), relativeKey.replace(/\//g, path.sep));
}

async function writeLocal(relativeKey: string, body: Buffer) {
  const destination = localPathFor(relativeKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

async function writeS3(relativeKey: string, body: Buffer, contentType: string) {
  const s3 = getS3Client();
  const bucket = publicationBucket();

  if (!s3 || !bucket) {
    throw new Error("S3 trust publication is not configured.");
  }

  const objectKey = storageKey(relativeKey);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
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

async function persistArtifact(params: {
  relativeKey: string;
  body: Buffer;
  contentType: string;
}) {
  const driver = publicationDriver();

  if (driver === "database") {
    return null;
  }

  if (driver === "local") {
    await writeLocal(params.relativeKey, params.body);
    return {
      driver,
      objectKey: params.relativeKey,
      checksumSha256: checksumSha256(params.body),
    };
  }

  const objectKey = await writeS3(params.relativeKey, params.body, params.contentType);
  return {
    driver,
    objectKey,
    checksumSha256: checksumSha256(params.body),
  };
}

export async function publishTrustCertificateArtifacts(input: {
  certificateId: string;
  publicUrl: string;
  badgeUrl: string;
  signedCertificateJson: JsonRecord;
  canonicalJson: JsonRecord;
  manifest?: JsonRecord;
}) {
  const driver = publicationDriver();

  if (driver === "database") {
    return null;
  }

  const publishedAt = new Date().toISOString();
  const signedCertificateRelativeKey = publicationRelativeKey(input.certificateId, "signed-certificate.json");
  const canonicalRelativeKey = publicationRelativeKey(input.certificateId, "canonical-certificate.json");
  const manifestRelativeKey = publicationRelativeKey(input.certificateId, "publication-manifest.json");

  const signedCertificateBody = Buffer.from(`${JSON.stringify(input.signedCertificateJson, null, 2)}\n`, "utf8");
  const canonicalBody = Buffer.from(`${JSON.stringify(input.canonicalJson, null, 2)}\n`, "utf8");
  const manifestBody = Buffer.from(`${JSON.stringify({
    certificateId: input.certificateId,
    publicUrl: input.publicUrl,
    badgeUrl: input.badgeUrl,
    publishedAt,
    archiveBackend: driver === "s3" ? "aws_s3" : "local_filesystem",
    ...input.manifest,
  }, null, 2)}\n`, "utf8");

  const [signedArtifact, canonicalArtifact, manifestArtifact] = await Promise.all([
    persistArtifact({
      relativeKey: signedCertificateRelativeKey,
      body: signedCertificateBody,
      contentType: "application/json",
    }),
    persistArtifact({
      relativeKey: canonicalRelativeKey,
      body: canonicalBody,
      contentType: "application/json",
    }),
    persistArtifact({
      relativeKey: manifestRelativeKey,
      body: manifestBody,
      contentType: "application/json",
    }),
  ]);

  if (!signedArtifact || !canonicalArtifact || !manifestArtifact) {
    return null;
  }

  return {
    driver,
    publishedAt,
    signedCertificateObjectKey: signedArtifact.objectKey,
    canonicalObjectKey: canonicalArtifact.objectKey,
    manifestObjectKey: manifestArtifact.objectKey,
    checksums: {
      signedCertificateSha256: signedArtifact.checksumSha256,
      canonicalSha256: canonicalArtifact.checksumSha256,
      manifestSha256: manifestArtifact.checksumSha256,
    },
  } satisfies TrustCertificatePublicationResult;
}
