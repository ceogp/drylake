import {
  CreateMalwareProtectionPlanCommand,
  GetMalwareProtectionPlanCommand,
  GuardDutyClient,
  ListMalwareProtectionPlansCommand,
  UpdateMalwareProtectionPlanCommand,
} from "@aws-sdk/client-guardduty";
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
  waitUntilRoleExists,
} from "@aws-sdk/client-iam";
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
const roleName = process.env.DRYLAKE_GUARDDUTY_ROLE_NAME || "DryLakeGuardDutyMalwareProtectionRole";
const policyName = "DryLakeGuardDutyMalwareProtectionPolicy";
const protectedPrefixes: string[] = [
  `${prefix}/guard/scans/`,
  `${prefix}/guard/quarantine/`,
];

const s3 = new S3Client({ region });
const sts = new STSClient({ region });
const iam = new IAMClient({ region });
const guardDuty = new GuardDutyClient({ region });

function trustPolicy() {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "malware-protection-plan.guardduty.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  });
}

function rolePolicy(input: { accountId: string; bucket: string }) {
  const objectResources = protectedPrefixes.map((item) => `arn:aws:s3:::${input.bucket}/${item}*`);
  const eventBridgeManagedRuleArn = `arn:aws:events:${region}:${input.accountId}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`;

  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowManagedRuleToSendS3EventsToGuardDuty",
        Effect: "Allow",
        Action: [
          "events:PutRule",
          "events:DeleteRule",
          "events:PutTargets",
          "events:RemoveTargets",
        ],
        Resource: eventBridgeManagedRuleArn,
        Condition: {
          StringLike: {
            "events:ManagedBy": "malware-protection-plan.guardduty.amazonaws.com",
          },
        },
      },
      {
        Sid: "AllowGuardDutyToMonitorEventBridgeManagedRule",
        Effect: "Allow",
        Action: [
          "events:DescribeRule",
          "events:ListTargetsByRule",
        ],
        Resource: eventBridgeManagedRuleArn,
      },
      {
        Sid: "AllowPostScanTag",
        Effect: "Allow",
        Action: [
          "s3:PutObjectTagging",
          "s3:GetObjectTagging",
          "s3:PutObjectVersionTagging",
          "s3:GetObjectVersionTagging",
        ],
        Resource: objectResources,
      },
      {
        Sid: "AllowEnableS3EventBridgeEvents",
        Effect: "Allow",
        Action: [
          "s3:PutBucketNotification",
          "s3:GetBucketNotification",
        ],
        Resource: `arn:aws:s3:::${input.bucket}`,
      },
      {
        Sid: "AllowPutValidationObject",
        Effect: "Allow",
        Action: [
          "s3:PutObject",
        ],
        Resource: `arn:aws:s3:::${input.bucket}/malware-protection-resource-validation-object`,
      },
      {
        Sid: "AllowCheckBucketOwnership",
        Effect: "Allow",
        Action: [
          "s3:ListBucket",
        ],
        Resource: `arn:aws:s3:::${input.bucket}`,
      },
      {
        Sid: "AllowMalwareScan",
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:GetObjectVersion",
        ],
        Resource: objectResources,
      },
    ],
  });
}

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

async function ensureGuardDutyRole(input: { accountId: string; bucket: string }) {
  let roleArn: string | undefined;
  const assumeRolePolicyDocument = trustPolicy();

  try {
    const existing = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    roleArn = existing.Role?.Arn;
    await iam.send(new UpdateAssumeRolePolicyCommand({
      RoleName: roleName,
      PolicyDocument: assumeRolePolicyDocument,
    }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name !== "NoSuchEntityException") {
      throw error;
    }

    const created = await iam.send(new CreateRoleCommand({
      RoleName: roleName,
      Description: "Allows Amazon GuardDuty Malware Protection for S3 to scan DryLake Guard artifacts.",
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
      Tags: [
        { Key: "Application", Value: "DryLake" },
        { Key: "Component", Value: "DryLakeGuard" },
        { Key: "ManagedBy", Value: "scripts/aws/provision-guard.ts" },
      ],
    }));
    roleArn = created.Role?.Arn;

    await waitUntilRoleExists(
      { client: iam, maxWaitTime: 60, minDelay: 2, maxDelay: 5 },
      { RoleName: roleName },
    );
  }

  await iam.send(new PutRolePolicyCommand({
    RoleName: roleName,
    PolicyName: policyName,
    PolicyDocument: rolePolicy(input),
  }));

  if (!roleArn) {
    const existing = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    roleArn = existing.Role?.Arn;
  }

  if (!roleArn) {
    throw new Error(`Unable to resolve IAM role ARN for ${roleName}`);
  }

  return roleArn;
}

async function findMalwareProtectionPlanForBucket(bucket: string) {
  let nextToken: string | undefined;

  do {
    const response = await guardDuty.send(new ListMalwareProtectionPlansCommand({
      NextToken: nextToken,
    }));

    for (const plan of response.MalwareProtectionPlans ?? []) {
      if (!plan.MalwareProtectionPlanId) {
        continue;
      }

      const detail = await guardDuty.send(new GetMalwareProtectionPlanCommand({
        MalwareProtectionPlanId: plan.MalwareProtectionPlanId,
      }));

      if (detail.ProtectedResource?.S3Bucket?.BucketName === bucket) {
        return {
          id: plan.MalwareProtectionPlanId,
          detail,
        };
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return null;
}

async function ensureMalwareProtectionPlan(input: { bucket: string; roleArn: string }) {
  const existing = await findMalwareProtectionPlanForBucket(input.bucket);
  const protectedResource = {
    S3Bucket: {
      BucketName: input.bucket,
      ObjectPrefixes: protectedPrefixes,
    },
  };
  const updateProtectedResource = {
    S3Bucket: {
      ObjectPrefixes: protectedPrefixes,
    },
  };
  const actions = {
    Tagging: {
      Status: "ENABLED" as const,
    },
  };

  if (existing) {
    await guardDuty.send(new UpdateMalwareProtectionPlanCommand({
      MalwareProtectionPlanId: existing.id,
      Role: input.roleArn,
      ProtectedResource: updateProtectedResource,
      Actions: actions,
    }));

    const detail = await guardDuty.send(new GetMalwareProtectionPlanCommand({
      MalwareProtectionPlanId: existing.id,
    }));

    return {
      id: existing.id,
      created: false,
      detail,
    };
  }

  const created = await guardDuty.send(new CreateMalwareProtectionPlanCommand({
    ClientToken: `drylake-${input.bucket}-${region}`,
    Role: input.roleArn,
    ProtectedResource: protectedResource,
    Actions: actions,
    Tags: {
      Application: "DryLake",
      Component: "DryLakeGuard",
      ManagedBy: "scripts/aws/provision-guard.ts",
    },
  }));

  if (!created.MalwareProtectionPlanId) {
    throw new Error("GuardDuty did not return a Malware Protection plan ID.");
  }

  const detail = await guardDuty.send(new GetMalwareProtectionPlanCommand({
    MalwareProtectionPlanId: created.MalwareProtectionPlanId,
  }));

  return {
    id: created.MalwareProtectionPlanId,
    created: true,
    detail,
  };
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
  const roleArn = await ensureGuardDutyRole({ accountId: identity.Account, bucket });
  const plan = await ensureMalwareProtectionPlan({ bucket, roleArn });

  console.log(`DryLake Guard AWS bucket ${existed ? "verified" : "created"}: ${bucket}`);
  console.log(`GuardDuty Malware Protection role: ${roleArn}`);
  console.log(`GuardDuty Malware Protection plan ${plan.created ? "created" : "verified"}: ${plan.id}`);
  console.log(`GuardDuty Malware Protection status: ${plan.detail.Status ?? "UNKNOWN"}`);
  if (plan.detail.StatusReasons?.length) {
    console.log("GuardDuty status reasons:");
    for (const reason of plan.detail.StatusReasons) {
      console.log(`- ${reason.Code ?? "UNKNOWN"}: ${reason.Message ?? ""}`);
    }
  }
  console.log("");
  console.log("Use these environment values for AWS-backed Guard artifacts:");
  console.log(`ARTIFACT_STORAGE_DRIVER=s3`);
  console.log(`AWS_REGION=${region}`);
  console.log(`AWS_S3_BUCKET=${bucket}`);
  console.log(`AWS_S3_PREFIX=${prefix}`);
  console.log("");
  console.log("Suspicious artifact scanning can use this bucket under:");
  for (const protectedPrefix of protectedPrefixes) {
    console.log(`- ${protectedPrefix}`);
  }
  console.log("");
  console.log("GuardDuty will add the GuardDutyMalwareScanStatus object tag after scans when AWS finishes processing each uploaded object.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
