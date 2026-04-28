import { z } from "zod";

import { created, forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireOrganizationRole, requireProjectAccess } from "@/lib/services/access";
import { createDeploymentTarget } from "@/lib/services/deployments";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

const createTargetSchema = z.object({
  name: z.string().min(1),
  platform: z.string().min(1),
  deliveryMode: z.string().min(1),
  repository: z.string().optional(),
  repositoryPath: z.string().optional(),
  baseBranch: z.string().optional(),
  exportPath: z.string().optional(),
  credentialId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(_: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await requireProjectAccess(projectId);
    const deploymentTargets = await prisma.deploymentTarget.findMany({
      where: { projectId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return ok({ deploymentTargets });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to list deployment targets");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = createTargetSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext, project } = await requireProjectAccess(projectId);
    await requireOrganizationRole(["owner", "admin", "member"], project.organizationId);
    const target = await createDeploymentTarget({
      projectId: project.id,
      createdByUserId: appContext.user.id,
      name: parsed.data.name,
      platform: parsed.data.platform,
      deliveryMode: parsed.data.deliveryMode,
      repository: parsed.data.repository,
      repositoryPath: parsed.data.repositoryPath,
      baseBranch: parsed.data.baseBranch,
      exportPath: parsed.data.exportPath,
      credentialId: parsed.data.credentialId,
      isDefault: parsed.data.isDefault,
    });

    return created({ deploymentTarget: target });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage deployment targets for that project.");
    }

    console.error(error);
    return internalError("Failed to create deployment target");
  }
}
