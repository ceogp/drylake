import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole, requireVersionAccess } from "@/lib/services/access";
import { runDeploymentJob } from "@/lib/services/deployments";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const deploySchema = z.object({
  deploymentTargetId: z.string().min(1),
  triggerSource: z.enum(["ui", "api", "slack", "whatsapp"]).optional(),
});

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = await request.json();
    const parsed = deploySchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext } = await requireVersionAccess(versionId);
    await requireOrganizationRole(["owner", "admin", "member"], appContext.organization.id);
    const result = await runDeploymentJob({
      versionId,
      deploymentTargetId: parsed.data.deploymentTargetId,
      createdByUserId: appContext.user.id,
      triggerSource: parsed.data.triggerSource,
    });

    return created({
      job: {
        id: result.job.id,
        status: result.job.status,
      },
      manifest: "manifest" in result ? result.manifest : undefined,
      error: "error" in result ? result.error : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to deploy that package version.");
    }

    console.error(error);
    return internalError("Failed to run deployment job");
  }
}
