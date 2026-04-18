import { internalError, ok } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const deploymentJobs = await prisma.deploymentJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        deploymentTarget: true,
        packageVersion: {
          include: {
            agentPackage: true,
          },
        },
      },
      take: 25,
    });

    return ok({ deploymentJobs });
  } catch (error) {
    console.error(error);
    return internalError("Failed to list deployments");
  }
}
