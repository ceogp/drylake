import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runDeploymentJob } from "@/lib/services/deployments";
import { buildExportPreview, type SupportedTarget } from "@/lib/services/import-export";
import { resolveIntegrationActorUser } from "@/lib/services/integration-actor";

function slackText(message: string) {
  return NextResponse.json({
    response_type: "ephemeral",
    text: message,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = String(formData.get("token") ?? "");
    const text = String(formData.get("text") ?? "").trim();

    const integration = await prisma.integration.findFirst({
      where: {
        provider: "slack",
        status: "active",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!integration) {
      return slackText("No active Slack integration is configured.");
    }

    const config = ((integration.configJson as Record<string, unknown> | null) ?? {});

    if (config.verificationToken && token !== String(config.verificationToken)) {
      return slackText("Slack command token did not match the configured integration.");
    }

    const [command, arg1, arg2] = text.split(/\s+/);
    const actorUserId =
      typeof config.actorUserId === "string" ? String(config.actorUserId) : null;
    const user = await resolveIntegrationActorUser({
      organizationId: integration.organizationId,
      preferredUserId: actorUserId,
    });

    if (command === "status" && arg1) {
      const deploymentJob = await prisma.deploymentJob.findFirst({
        where: { id: arg1, organizationId: integration.organizationId },
      });
      const transformJob = await prisma.transformJob.findFirst({
        where: { id: arg1, organizationId: integration.organizationId },
      });
      const job = deploymentJob ?? transformJob;

      return slackText(job ? `Job ${arg1} status: ${job.status}` : `Job ${arg1} was not found.`);
    }

    if (command === "deploy" && arg1 && arg2) {
      const version = await prisma.packageVersion.findFirst({
        where: {
          id: arg1,
          agentPackage: {
            project: {
              organizationId: integration.organizationId,
            },
          },
        },
      });
      const target = await prisma.deploymentTarget.findFirst({
        where: {
          id: arg2,
          project: {
            organizationId: integration.organizationId,
          },
        },
      });

      if (!version || !target) {
        return slackText("Version or deployment target was not found in this organization.");
      }

      const result = await runDeploymentJob({
        versionId: arg1,
        deploymentTargetId: arg2,
        createdByUserId: user.id,
        triggerSource: "slack",
      });

      return slackText(`Deployment job ${result.job.id} finished with status ${result.job.status}.`);
    }

    if (command === "export" && arg1 && arg2) {
      const version = await prisma.packageVersion.findFirst({
        where: {
          id: arg1,
          agentPackage: {
            project: {
              organizationId: integration.organizationId,
            },
          },
        },
      });

      if (!version) {
        return slackText("That package version was not found in this organization.");
      }

      const result = await buildExportPreview({
        versionId: arg1,
        targetPlatform: arg2 as SupportedTarget,
        createdByUserId: user.id,
      });

      return slackText(`Export job ${result.job.id} created ${result.generatedFiles.length} files.`);
    }

    return slackText("Supported commands: status <jobId>, deploy <versionId> <deploymentTargetId>, export <versionId> <targetPlatform>");
  } catch (error) {
    console.error(error);
    return slackText("Slack command processing failed.");
  }
}
