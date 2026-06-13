import { loadEnvConfig } from "@next/env";
import {
  BatchGetProjectsCommand,
  CodeBuildClient,
  CreateProjectCommand,
  UpdateProjectCommand,
} from "@aws-sdk/client-codebuild";
import {
  CodePipelineClient,
  CreatePipelineCommand,
  GetPipelineCommand,
  UpdatePipelineCommand,
} from "@aws-sdk/client-codepipeline";
import {
  AttachRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketEncryptionCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const codebuild = new CodeBuildClient({ region });
const codepipeline = new CodePipelineClient({ region });
const iam = new IAMClient({ region });
const s3 = new S3Client({ region });
const sts = new STSClient({ region });

const storageDir = path.join(process.cwd(), "storage", "cicd");
const manifestPath = path.join(storageDir, "cicd-manifest.json");
const validateProjectName = "xupra-drylake-validate";
const codebuildRoleName = "xupra-drylake-codebuild-role";
const codepipelineRoleName = "xupra-drylake-codepipeline-role";
const defaultRepositoryId = "gmkdigitalmedia1/drylake";

type PipelineTarget = {
  environment: "staging" | "production";
  branch: string;
  deployHost: string;
  deploySshUser: string;
  deploySshKeySecretId: string;
  appBaseUrl: string;
  deployEnvSecretId: string;
  pipelineName: string;
  deployProjectName: string;
  verifyProjectName: string;
};

type Manifest = {
  region: string;
  accountId: string;
  artifactBucket: string;
  connectionArn: string;
  repositoryId: string;
  codebuildRoleArn: string;
  codepipelineRoleArn: string;
  validateProjectName: string;
  targets: Array<{
    environment: string;
    pipelineName: string;
    deployProjectName: string;
    verifyProjectName: string;
    deployHost: string;
    deploySshUser: string;
    deploySshKeySecretId: string;
    appBaseUrl: string;
    deployEnvSecretId: string;
  }>;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalTarget(environment: "staging" | "production", branch: string): PipelineTarget | null {
  const upper = environment.toUpperCase();
  const deployHost = process.env[`${upper}_HOST`] || "";
  const deploySshUser = process.env[`${upper}_SSH_USER`] || "";
  const deploySshKeySecretId = process.env[`${upper}_SSH_KEY_SECRET_ID`] || "";
  const appBaseUrl = process.env[`${upper}_URL`] || "";
  const deployEnvSecretId = process.env[`${upper}_ENV_SECRET_ID`] || "";

  if (!deployHost || !deploySshUser || !deploySshKeySecretId || !appBaseUrl || !deployEnvSecretId) {
    return null;
  }

  return {
    environment,
    branch,
    deployHost,
    deploySshUser,
    deploySshKeySecretId,
    appBaseUrl,
    deployEnvSecretId,
    pipelineName: `xupra-drylake-${environment}`,
    deployProjectName: `xupra-drylake-deploy-${environment}`,
    verifyProjectName: `xupra-drylake-verify-${environment}`,
  };
}

async function writeManifest(manifest: Manifest) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function ensureBucket(bucketName: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch {
    if (region === "us-east-1") {
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    } else {
      await s3.send(
        new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: region as BucketLocationConstraint,
          },
        }),
      );
    }
  }

  await s3.send(
    new PutBucketVersioningCommand({
      Bucket: bucketName,
      VersioningConfiguration: {
        Status: "Enabled",
      },
    }),
  );
  await s3.send(
    new PutBucketEncryptionCommand({
      Bucket: bucketName,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256",
            },
          },
        ],
      },
    }),
  );
}

async function ensureRole(params: {
  roleName: string;
  assumeRolePolicyDocument: Record<string, unknown>;
  inlinePolicies?: Array<{ name: string; document: Record<string, unknown> }>;
  managedPolicyArns?: string[];
}) {
  let roleArn = "";

  try {
    const existing = await iam.send(new GetRoleCommand({ RoleName: params.roleName }));
    roleArn = existing.Role?.Arn ?? "";
  } catch {
    const created = await iam.send(
      new CreateRoleCommand({
        RoleName: params.roleName,
        AssumeRolePolicyDocument: JSON.stringify(params.assumeRolePolicyDocument),
      }),
    );
    roleArn = created.Role?.Arn ?? "";
  }

  if (!roleArn) {
    throw new Error(`Unable to resolve role ARN for ${params.roleName}.`);
  }

  for (const policy of params.inlinePolicies ?? []) {
    await iam.send(
      new PutRolePolicyCommand({
        RoleName: params.roleName,
        PolicyName: policy.name,
        PolicyDocument: JSON.stringify(policy.document),
      }),
    );
  }

  for (const managedPolicyArn of params.managedPolicyArns ?? []) {
    await iam.send(
      new AttachRolePolicyCommand({
        RoleName: params.roleName,
        PolicyArn: managedPolicyArn,
      }),
    );
  }

  return roleArn;
}

function secretResource(secretId: string, accountId: string) {
  if (secretId.startsWith("arn:")) {
    return secretId;
  }

  return `arn:aws:secretsmanager:${region}:${accountId}:secret:${secretId}*`;
}

async function upsertCodeBuildProject(params: {
  name: string;
  description: string;
  buildspec: string;
  serviceRoleArn: string;
  privilegedMode?: boolean;
  environmentVariables?: Array<{ name: string; value: string }>;
}) {
  const project = {
    name: params.name,
    description: params.description,
    serviceRole: params.serviceRoleArn,
    source: {
      type: "CODEPIPELINE" as const,
      buildspec: params.buildspec,
    },
    artifacts: {
      type: "CODEPIPELINE" as const,
    },
    environment: {
      type: "LINUX_CONTAINER" as const,
      computeType: params.privilegedMode ? ("BUILD_GENERAL1_MEDIUM" as const) : ("BUILD_GENERAL1_SMALL" as const),
      image: "aws/codebuild/standard:7.0",
      privilegedMode: Boolean(params.privilegedMode),
      environmentVariables: (params.environmentVariables ?? []).map((item) => ({
        name: item.name,
        value: item.value,
        type: "PLAINTEXT" as const,
      })),
    },
    timeoutInMinutes: 60,
    queuedTimeoutInMinutes: 120,
  };

  const existing = await codebuild.send(
    new BatchGetProjectsCommand({
      names: [params.name],
    }),
  );

  if (existing.projects?.length) {
    await codebuild.send(new UpdateProjectCommand(project));
    return;
  }

  await codebuild.send(new CreateProjectCommand(project));
}

async function upsertPipeline(params: {
  name: string;
  branch: string;
  repositoryId: string;
  connectionArn: string;
  artifactBucket: string;
  roleArn: string;
  validateProjectName: string;
  deployProjectName: string;
  verifyProjectName: string;
}) {
  const current = await codepipeline.send(new GetPipelineCommand({ name: params.name })).catch(() => null);

  const declaration = {
    name: params.name,
    roleArn: params.roleArn,
    artifactStore: {
      type: "S3" as const,
      location: params.artifactBucket,
    },
    stages: [
      {
        name: "Source",
        actions: [
          {
            name: "ApplicationSource",
            actionTypeId: {
              category: "Source" as const,
              owner: "AWS" as const,
              provider: "CodeStarSourceConnection" as const,
              version: "1",
            },
            configuration: {
              ConnectionArn: params.connectionArn,
              FullRepositoryId: params.repositoryId,
              BranchName: params.branch,
              OutputArtifactFormat: "CODE_ZIP",
            },
            outputArtifacts: [{ name: "SourceArtifact" }],
            inputArtifacts: [],
            runOrder: 1,
          },
        ],
      },
      {
        name: "Validate",
        actions: [
          {
            name: "Validate",
            actionTypeId: {
              category: "Build" as const,
              owner: "AWS" as const,
              provider: "CodeBuild" as const,
              version: "1",
            },
            configuration: {
              ProjectName: params.validateProjectName,
            },
            inputArtifacts: [{ name: "SourceArtifact" }],
            outputArtifacts: [],
            runOrder: 1,
          },
        ],
      },
      {
        name: "Deploy",
        actions: [
          {
            name: "Deploy",
            actionTypeId: {
              category: "Build" as const,
              owner: "AWS" as const,
              provider: "CodeBuild" as const,
              version: "1",
            },
            configuration: {
              ProjectName: params.deployProjectName,
            },
            inputArtifacts: [{ name: "SourceArtifact" }],
            outputArtifacts: [],
            runOrder: 1,
          },
        ],
      },
      {
        name: "Verify",
        actions: [
          {
            name: "Verify",
            actionTypeId: {
              category: "Build" as const,
              owner: "AWS" as const,
              provider: "CodeBuild" as const,
              version: "1",
            },
            configuration: {
              ProjectName: params.verifyProjectName,
            },
            inputArtifacts: [{ name: "SourceArtifact" }],
            outputArtifacts: [],
            runOrder: 1,
          },
        ],
      },
    ],
    version: current?.pipeline?.version,
  };

  if (current?.pipeline) {
    await codepipeline.send(new UpdatePipelineCommand({ pipeline: declaration }));
    return;
  }

  await codepipeline.send(new CreatePipelineCommand({ pipeline: declaration }));
}

async function main() {
  const connectionArn = requireEnv("AWS_CODECONNECTIONS_ARN");
  const repositoryId = process.env.AWS_CODECONNECTIONS_FULL_REPOSITORY_ID || defaultRepositoryId;
  const callerIdentity = await sts.send(new GetCallerIdentityCommand({}));
  const accountId = callerIdentity.Account;

  if (!accountId) {
    throw new Error("Unable to resolve AWS account id.");
  }

  const artifactBucket = process.env.AWS_CICD_ARTIFACT_BUCKET || `xupra-drylake-cicd-${accountId}-${region}`;
  const targets = [optionalTarget("staging", "staging"), optionalTarget("production", "main")].filter(
    (item): item is PipelineTarget => Boolean(item),
  );
  const secretResources = Array.from(
    new Set(
      targets.flatMap((target) => [
        secretResource(target.deployEnvSecretId, accountId),
        secretResource(target.deploySshKeySecretId, accountId),
      ]),
    ),
  );

  await ensureBucket(artifactBucket);

  const codebuildRoleArn = await ensureRole({
    roleName: codebuildRoleName,
    assumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "codebuild.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    inlinePolicies: [
      {
        name: "xupra-drylake-codebuild-inline",
        document: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
              Resource: "*",
            },
            {
              Effect: "Allow",
              Action: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
              Resource: [`arn:aws:s3:::${artifactBucket}`, `arn:aws:s3:::${artifactBucket}/*`],
            },
            {
              Effect: "Allow",
              Action: ["secretsmanager:GetSecretValue"],
              Resource: secretResources.length > 0 ? secretResources : ["*"],
            },
          ],
        },
      },
    ],
  });

  const codepipelineRoleArn = await ensureRole({
    roleName: codepipelineRoleName,
    assumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "codepipeline.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    inlinePolicies: [
      {
        name: "xupra-drylake-codepipeline-inline",
        document: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
              Resource: [`arn:aws:s3:::${artifactBucket}`, `arn:aws:s3:::${artifactBucket}/*`],
            },
            {
              Effect: "Allow",
              Action: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
              Resource: "*",
            },
            {
              Effect: "Allow",
              Action: ["codeconnections:UseConnection"],
              Resource: connectionArn,
            },
          ],
        },
      },
    ],
  });

  await upsertCodeBuildProject({
    name: validateProjectName,
    description: "Validate DryLake source before deployment.",
    buildspec: "buildspecs/validate.yml",
    serviceRoleArn: codebuildRoleArn,
    privilegedMode: true,
    environmentVariables: [
      { name: "NODE_ENV", value: "production" },
      { name: "DATABASE_URL", value: "postgresql://xupra_app:xupra_ci@127.0.0.1:5432/xupra_drylake" },
      { name: "POSTGRES_DB", value: "xupra_drylake" },
      { name: "POSTGRES_USER", value: "xupra_app" },
      { name: "POSTGRES_PASSWORD", value: "xupra_ci" },
      { name: "APP_BASE_URL", value: "http://localhost:3000" },
      { name: "APP_ENCRYPTION_KEY", value: "codebuild-dev-only-key-0000000000000000" },
      { name: "AUTH_MODE", value: "dev" },
      { name: "DEFAULT_DEV_USER_EMAIL", value: "owner@xupra.local" },
      { name: "DEFAULT_DEV_USER_NAME", value: "Xupra Owner" },
      { name: "PLATFORM_ADMIN_EMAILS", value: "owner@xupra.local" },
      { name: "ARTIFACT_STORAGE_DRIVER", value: "local" },
      { name: "SECRETS_PROVIDER", value: "env" },
      { name: "BILLING_ENFORCEMENT_MODE", value: "development" },
    ],
  });

  for (const target of targets) {
    await upsertCodeBuildProject({
      name: target.deployProjectName,
      description: `Deploy DryLake to ${target.environment} using CodeBuild SSH orchestration.`,
      buildspec: "buildspecs/deploy.yml",
      serviceRoleArn: codebuildRoleArn,
      environmentVariables: [
        { name: "TARGET_ENV", value: target.environment },
        { name: "DEPLOY_HOST", value: target.deployHost },
        { name: "DEPLOY_SSH_USER", value: target.deploySshUser },
        { name: "DEPLOY_SSH_KEY_SECRET_ID", value: target.deploySshKeySecretId },
        { name: "DEPLOY_ENV_SECRET_ID", value: target.deployEnvSecretId },
        { name: "APP_BASE_URL", value: target.appBaseUrl },
        { name: "DEPLOY_REQUIRE_HTTPS", value: "true" },
      ],
    });

    await upsertCodeBuildProject({
      name: target.verifyProjectName,
      description: `Verify DryLake deployment for ${target.environment}.`,
      buildspec: "buildspecs/verify.yml",
      serviceRoleArn: codebuildRoleArn,
      environmentVariables: [
        { name: "APP_BASE_URL", value: target.appBaseUrl },
        { name: "VERIFY_GUARD_SECURITY_GIF", value: "true" },
      ],
    });

    await upsertPipeline({
      name: target.pipelineName,
      branch: target.branch,
      repositoryId,
      connectionArn,
      artifactBucket,
      roleArn: codepipelineRoleArn,
      validateProjectName,
      deployProjectName: target.deployProjectName,
      verifyProjectName: target.verifyProjectName,
    });
  }

  const manifest: Manifest = {
    region,
    accountId,
    artifactBucket,
    connectionArn,
    repositoryId,
    codebuildRoleArn,
    codepipelineRoleArn,
    validateProjectName,
    targets: targets.map((target) => ({
      environment: target.environment,
      pipelineName: target.pipelineName,
      deployProjectName: target.deployProjectName,
      verifyProjectName: target.verifyProjectName,
      deployHost: target.deployHost,
      deploySshUser: target.deploySshUser,
      deploySshKeySecretId: target.deploySshKeySecretId,
      appBaseUrl: target.appBaseUrl,
      deployEnvSecretId: target.deployEnvSecretId,
    })),
  };

  await writeManifest(manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
