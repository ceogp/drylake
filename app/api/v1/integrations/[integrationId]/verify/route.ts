import { created, forbidden, internalError, unauthorized } from "@/lib/api/http";
import { requireIntegrationAccess, requireOrganizationRole } from "@/lib/services/access";
import { verifyIntegration } from "@/lib/services/integrations";

type Context = {
  params: Promise<{
    integrationId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  try {
    const { integrationId } = await context.params;
    const { context: appContext } = await requireIntegrationAccess(integrationId);
    await requireOrganizationRole(["owner", "admin"], appContext.organization.id);
    const result = await verifyIntegration({
      integrationId,
      actorUserId: appContext.user.id,
    });

    return created(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to verify that integration.");
    }

    console.error(error);
    return internalError("Failed to verify integration");
  }
}
