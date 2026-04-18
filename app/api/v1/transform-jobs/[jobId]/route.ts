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
    const transformJob = await prisma.transformJob.findUnique({
      where: { id: jobId },
      include: {
        organization: true,
        project: true,
        agentPackage: true,
        packageVersion: {
          include: {
            agentPackage: true,
          },
        },
      },
    });

    if (!transformJob) {
      return notFound("Transform job not found");
    }

    await requireOrganizationAccess(transformJob.organizationId);

    return ok({ transformJob });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that transform job.");
    }

    console.error(error);
    return internalError("Failed to fetch transform job");
  }
}
