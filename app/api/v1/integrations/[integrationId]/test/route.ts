import { created, forbidden, internalError, unauthorized } from "@/lib/api/http";
import { requireIntegrationAccess, requireOrganizationRole } from "@/lib/services/access";
import { sendTestIntegrationMessage } from "@/lib/services/integrations";

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
    const result = await sendTestIntegrationMessage({
      integrationId,
      actorUserId: appContext.user.id,
    });

    return created(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to send test messages for that integration.");
    }

    console.error(error);
    return internalError("Failed to send test integration message");
  }
}
