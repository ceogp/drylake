import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { recordAuditEvent } from "@/lib/services/audit";
import { readCredentialForJob } from "@/lib/services/credentials";
import { assertEntitlement } from "@/lib/services/entitlements";
import { buildExportPreview, type SupportedTarget } from "@/lib/services/import-export";
import { notifyOrganizationIntegrations } from "@/lib/services/integrations";
import { saveArtifactText } from "@/lib/storage/artifacts";

const execFileAsync = promisify(execFile);

type DeploymentTargetConfig = {
  repository?: string;
  repositoryPath?: string;
  baseBranch?: string;
  exportPath?: string;
  credentialId?: string;
};

function asTargetConfig(value: unknown) {
  return (value ?? {}) as DeploymentTargetConfig;
}

function sourceFormatFromPath(logicalPath: string) {
  return path.extname(logicalPath).replace(".", "") || "text";
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function maybeCreateGitBranch(params: {
  repositoryPath: string;
  branchName: string;
  commitMessage: string;
}) {
  const gitDir = path.join(params.repositoryPath, ".git");

  if (!(await pathExists(gitDir))) {
    return {
      branchName: null,
      committed: false,
      message: "Repository path is not a Git repository.",
    };
  }

  await execFileAsync("git", ["-C", params.repositoryPath, "checkout", "-B", params.branchName]);
  await execFileAsync("git", ["-C", params.repositoryPath, "add", "."]);

  try {
    await execFileAsync("git", ["-C", params.repositoryPath, "commit", "-m", params.commitMessage]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No changes committed";
    return {
      branchName: params.branchName,
      committed: false,
      message,
    };
  }

  return {
    branchName: params.branchName,
    committed: true,
    message: "Committed generated deployment files to a local Git branch.",
  };
}

export async function createDeploymentTarget(params: {
  projectId: string;
  createdByUserId: string;
  name: string;
  platform: string;
  deliveryMode: string;
  repository?: string;
  repositoryPath?: string;
  baseBranch?: string;
  exportPath?: string;
  credentialId?: string;
  isDefault?: boolean;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
  });

  await assertEntitlement(project.organizationId, "xupra_pro_ai");

  if (params.isDefault) {
    await prisma.deploymentTarget.updateMany({
      where: { projectId: params.projectId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const target = await prisma.deploymentTarget.create({
    data: {
      projectId: params.projectId,
      createdByUserId: params.createdByUserId,
      name: params.name,
      platform: params.platform,
      deliveryMode: params.deliveryMode,
      isDefault: Boolean(params.isDefault),
      configJson: {
        repository: params.repository ?? null,
        repositoryPath: params.repositoryPath ?? null,
        baseBranch: params.baseBranch ?? null,
        exportPath: params.exportPath ?? null,
        credentialId: params.credentialId ?? null,
      },
    },
  });

  await recordAuditEvent({
    organizationId: project.organizationId,
    actorUserId: params.createdByUserId,
    entityType: "deployment_target",
    entityId: target.id,
    action: "deployment_target.create",
    metadata: {
      platform: params.platform,
      deliveryMode: params.deliveryMode,
      name: params.name,
    },
  });

  return target;
}

export async function runDeploymentJob(params: {
  versionId: string;
  deploymentTargetId: string;
  createdByUserId: string;
  triggerSource?: string;
}) {
  const version = await prisma.packageVersion.findUniqueOrThrow({
    where: { id: params.versionId },
    include: {
      agentPackage: {
        include: {
          project: true,
        },
      },
    },
  });

  const target = await prisma.deploymentTarget.findUniqueOrThrow({
    where: { id: params.deploymentTargetId },
  });

  await assertEntitlement(version.agentPackage.project.organizationId, "xupra_pro_ai");

  const config = asTargetConfig(target.configJson);
  const deploymentJob = await prisma.deploymentJob.create({
    data: {
      organizationId: version.agentPackage.project.organizationId,
      projectId: version.agentPackage.projectId,
      packageVersionId: version.id,
      deploymentTargetId: target.id,
      status: "queued",
      triggerSource: params.triggerSource ?? "ui",
      gitRef: config.baseBranch ?? null,
      createdByUserId: params.createdByUserId,
    },
  });

  if (env.JOB_EXECUTION_MODE === "worker") {
    return {
      job: deploymentJob,
    };
  }

  return processDeploymentJob(deploymentJob.id);
}

export async function processDeploymentJob(deploymentJobId: string) {
  const currentJob = await prisma.deploymentJob.findUniqueOrThrow({
    where: { id: deploymentJobId },
  });

  if (currentJob.status === "succeeded" || currentJob.status === "failed") {
    return {
      job: currentJob,
      manifest: (currentJob.outputJson as Record<string, unknown> | null) ?? undefined,
      error: (currentJob.errorJson as Record<string, unknown> | null) ?? undefined,
    };
  }

  if (currentJob.status === "queued") {
    await prisma.deploymentJob.update({
      where: { id: deploymentJobId },
      data: {
        status: "running",
        startedAt: currentJob.startedAt ?? new Date(),
      },
    });
  }

  const deploymentJob = await prisma.deploymentJob.findUniqueOrThrow({
    where: { id: deploymentJobId },
    include: {
      packageVersion: {
        include: {
          agentPackage: {
            include: {
              project: true,
            },
          },
        },
      },
      deploymentTarget: true,
    },
  });

  const version = deploymentJob.packageVersion;
  const target = deploymentJob.deploymentTarget;
  const config = asTargetConfig(target.configJson);

  try {
    if (config.credentialId) {
      await readCredentialForJob({
        credentialId: config.credentialId,
        actorUserId: deploymentJob.createdByUserId,
        jobId: deploymentJob.id,
      });
    }

    const exportResult = await buildExportPreview({
      versionId: version.id,
      targetPlatform: target.platform as SupportedTarget,
      createdByUserId: deploymentJob.createdByUserId,
    });

    const deployedPaths: string[] = [];
    let gitResult:
      | {
          branchName: string | null;
          committed: boolean;
          message: string;
        }
      | undefined;

    if (config.repositoryPath) {
      const basePath = path.resolve(/* turbopackIgnore: true */ config.repositoryPath);
      const exportRoot = path.resolve(basePath, /* turbopackIgnore: true */ config.exportPath ?? ".");

      for (const file of exportResult.generatedFiles) {
        const fullPath = path.resolve(exportRoot, /* turbopackIgnore: true */ file.logicalPath);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, file.preview, "utf8");
        deployedPaths.push(fullPath);
      }

      if (target.deliveryMode === "git_branch" || target.deliveryMode === "pull_request") {
        gitResult = await maybeCreateGitBranch({
          repositoryPath: basePath,
          branchName: `xupra/${version.agentPackage.slug}-v${version.versionNumber}-${Date.now()}`,
          commitMessage: `Xupra DryLake deploy ${version.agentPackage.name} v${version.versionNumber}`,
        });
      }
    }

    const manifest = {
      jobId: deploymentJob.id,
      deploymentTargetId: target.id,
      deploymentTargetName: target.name,
      platform: target.platform,
      deliveryMode: target.deliveryMode,
      repository: config.repository ?? null,
      repositoryPath: config.repositoryPath ?? null,
      exportPath: config.exportPath ?? null,
      deployedPaths,
      git: gitResult ?? null,
      generatedFiles: exportResult.generatedFiles.map((file) => ({
        logicalPath: file.logicalPath,
        storageKey: file.storageKey,
      })),
      compatibility: exportResult.compatibility,
      finishedAt: new Date().toISOString(),
    };

    const artifact = await saveArtifactText({
      versionId: version.id,
      kind: "deployment_output",
      logicalPath: path.posix.join("deployments", `${deploymentJob.id}.json`),
      text: JSON.stringify(manifest, null, 2),
      mimeType: "application/json",
    });

    await prisma.packageFile.create({
      data: {
        packageVersionId: version.id,
        kind: "deployment_output",
        logicalPath: path.posix.join("deployments", `${deploymentJob.id}.json`),
        storageKey: artifact.storageKey,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        sourceFormat: sourceFormatFromPath(`${deploymentJob.id}.json`),
      },
    });

    const finishedJob = await prisma.deploymentJob.update({
      where: { id: deploymentJob.id },
      data: {
        status: "succeeded",
        outputJson: manifest,
        finishedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organizationId: version.agentPackage.project.organizationId,
      actorUserId: deploymentJob.createdByUserId,
      entityType: "deployment_job",
      entityId: deploymentJob.id,
      action: "deployment_job.succeeded",
      metadata: manifest,
    });

    await notifyOrganizationIntegrations({
      organizationId: version.agentPackage.project.organizationId,
      event: "deployment_job",
      text: `${version.agentPackage.name} deployed to ${target.name} with status ${finishedJob.status}.`,
    });

    return {
      job: finishedJob,
      manifest,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deployment failed";

    const failedJob = await prisma.deploymentJob.update({
      where: { id: deploymentJob.id },
      data: {
        status: "failed",
        errorJson: {
          message,
        },
        finishedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organizationId: version.agentPackage.project.organizationId,
      actorUserId: deploymentJob.createdByUserId,
      entityType: "deployment_job",
      entityId: deploymentJob.id,
      action: "deployment_job.failed",
      metadata: {
        message,
      },
    });

    await notifyOrganizationIntegrations({
      organizationId: version.agentPackage.project.organizationId,
      event: "deployment_job",
      text: `${version.agentPackage.name} deployment to ${target.name} failed: ${message}`,
    });

    return {
      job: failedJob,
      error: {
        message,
      },
    };
  }
}

export async function processQueuedDeploymentJobs(params?: { limit?: number }) {
  const queuedJobs = await prisma.deploymentJob.findMany({
    where: {
      status: "queued",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: params?.limit ?? 5,
  });

  const results = [];

  for (const job of queuedJobs) {
    results.push(await processDeploymentJob(job.id));
  }

  return results;
}
