import { forbidden, internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess } from "@/lib/services/access";

type Context = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const deploymentJob = await prisma.deploymentJob.findUnique({
      where: { id: jobId },
      include: {
        deploymentTarget: true,
        packageVersion: {
          include: {
            agentPackage: true,
          },
        },
      },
    });

    if (!deploymentJob) {
      return notFound("Deployment job not found");
    }

    await requireOrganizationAccess(deploymentJob.organizationId);

    return ok({ deploymentJob });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that deployment job.");
    }

    console.error(error);
    return internalError("Failed to fetch deployment job");
  }
}
