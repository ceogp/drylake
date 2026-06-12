import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketEncryptionCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketTaggingCommand,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const prefix = (process.env.AWS_S3_PREFIX || "xupra-drylake").replace(/^\/+|\/+$/g, "");
const explicitBucket = process.env.DRYLAKE_GUARD_BUCKET || process.env.AWS_S3_BUCKET;

const s3 = new S3Client({ region });
const sts = new STSClient({ region });

async function bucketExists(bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function createBucket(bucket: string) {
  const createBucketInput: CreateBucketCommandInput =
    region === "us-east-1"
      ? { Bucket: bucket }
      : {
          Bucket: bucket,
          CreateBucketConfiguration: {
            LocationConstraint: region as BucketLocationConstraint,
          },
        };

  await s3.send(new CreateBucketCommand(createBucketInput));
}

async function configureBucket(bucket: string) {
  await s3.send(new PutPublicAccessBlockCommand({
    Bucket: bucket,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
    },
  }));

  await s3.send(new PutBucketEncryptionCommand({
    Bucket: bucket,
    ServerSideEncryptionConfiguration: {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256",
          },
          BucketKeyEnabled: true,
        },
      ],
    },
  }));

  await s3.send(new PutBucketVersioningCommand({
    Bucket: bucket,
    VersioningConfiguration: {
      Status: "Enabled",
    },
  }));

  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: "expire-guard-quarantine-artifacts",
          Status: "Enabled",
          Filter: {
            Prefix: `${prefix}/guard/quarantine/`,
          },
          Expiration: {
            Days: 14,
          },
          NoncurrentVersionExpiration: {
            NoncurrentDays: 14,
          },
        },
        {
          ID: "transition-guard-scan-history",
          Status: "Enabled",
          Filter: {
            Prefix: `${prefix}/guard/scans/`,
          },
          Transitions: [
            {
              Days: 30,
              StorageClass: "STANDARD_IA",
            },
          ],
          NoncurrentVersionExpiration: {
            NoncurrentDays: 90,
          },
        },
      ],
    },
  }));

  await s3.send(new PutBucketTaggingCommand({
    Bucket: bucket,
    Tagging: {
      TagSet: [
        { Key: "Application", Value: "DryLake" },
        { Key: "Component", Value: "DryLakeGuard" },
        { Key: "ManagedBy", Value: "scripts/aws/provision-guard.ts" },
      ],
    },
  }));
}

async function main() {
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  if (!identity.Account) {
    throw new Error("Unable to resolve AWS account ID.");
  }

  const bucket = explicitBucket || `xupra-drylake-guard-${identity.Account}-${region}`;
  const existed = await bucketExists(bucket);
  if (!existed) {
    await createBucket(bucket);
  }

  await configureBucket(bucket);

  console.log(`DryLake Guard AWS bucket ${existed ? "verified" : "created"}: ${bucket}`);
  console.log("");
  console.log("Use these environment values for AWS-backed Guard artifacts:");
  console.log(`ARTIFACT_STORAGE_DRIVER=s3`);
  console.log(`AWS_REGION=${region}`);
  console.log(`AWS_S3_BUCKET=${bucket}`);
  console.log(`AWS_S3_PREFIX=${prefix}`);
  console.log("");
  console.log("Suspicious artifact scanning can use this bucket under:");
  console.log(`${prefix}/guard/quarantine/`);
  console.log("");
  console.log("GuardDuty Malware Protection for S3 still needs account-level enablement for this bucket before malware verdicts are available.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
