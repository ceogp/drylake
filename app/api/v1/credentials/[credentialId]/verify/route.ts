import { created, forbidden, internalError, unauthorized } from "@/lib/api/http";
import { requireCredentialAccess, requireOrganizationRole } from "@/lib/services/access";
import { verifyCredential } from "@/lib/services/credentials";

type Context = {
  params: Promise<{
    credentialId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  try {
    const { credentialId } = await context.params;
    const { context: appContext, credential } = await requireCredentialAccess(credentialId);
    await requireOrganizationRole(["owner", "admin"], credential.organizationId);
    const result = await verifyCredential({
      credentialId,
      actorUserId: appContext.user.id,
    });

    return created({
      verification: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to verify that credential.");
    }

    console.error(error);
    return internalError("Failed to verify credential");
  }
}
