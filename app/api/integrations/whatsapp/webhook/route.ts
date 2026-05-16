import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runDeploymentJob } from "@/lib/services/deployments";
import { buildExportPreview, type SupportedTarget } from "@/lib/services/import-export";
import { resolveIntegrationActorUser } from "@/lib/services/integration-actor";

function twiml(message: string) {
  return new NextResponse(`<Response><Message>${message}</Message></Response>`, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const from = String(formData.get("From") ?? "");
    const body = String(formData.get("Body") ?? "").trim();

    const integrations = await prisma.integration.findMany({
      where: {
        provider: "twilio_whatsapp",
        status: "active",
      },
      orderBy: { updatedAt: "desc" },
    });

    const integration = integrations.find((item) => {
      const config = ((item.configJson as Record<string, unknown> | null) ?? {});
      return !config.toNumber || String(config.toNumber) === from;
    });

    if (!integration) {
      return twiml("No active WhatsApp integration matched this sender.");
    }

    const [command, arg1, arg2] = body.split(/\s+/);
    const config = ((integration.configJson as Record<string, unknown> | null) ?? {});
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

      return twiml(job ? `Job ${arg1} status: ${job.status}` : `Job ${arg1} was not found.`);
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
        return twiml("Version or deployment target was not found in this organization.");
      }

      const result = await runDeploymentJob({
        versionId: arg1,
        deploymentTargetId: arg2,
        createdByUserId: user.id,
        triggerSource: "whatsapp",
      });

      return twiml(`Deployment job ${result.job.id} finished with status ${result.job.status}.`);
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
        return twiml("That package version was not found in this organization.");
      }

      const result = await buildExportPreview({
        versionId: arg1,
        targetPlatform: arg2 as SupportedTarget,
        createdByUserId: user.id,
      });

      return twiml(`Export job ${result.job.id} created ${result.generatedFiles.length} files.`);
    }

    return twiml("Supported commands: status <jobId>, deploy <versionId> <deploymentTargetId>, export <versionId> <targetPlatform>");
  } catch (error) {
    console.error(error);
    return twiml("WhatsApp command processing failed.");
  }
}
