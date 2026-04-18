import { forbidden, internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/services/access";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireProjectAccess(projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        packages: {
          include: {
            versions: {
              orderBy: {
                versionNumber: "desc",
              },
              take: 3,
            },
          },
        },
        deploymentTargets: true,
      },
    });

    if (!project) {
      return notFound("Project not found");
    }

    return ok({ project });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to fetch project");
  }
}
