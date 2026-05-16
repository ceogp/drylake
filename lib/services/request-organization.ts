import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import {
  EXTENSION_TOKEN_HEADER,
  verifyExtensionAccessToken,
} from "@/lib/services/extension-tokens";

export const INVALID_EXTENSION_TOKEN_ERROR = "Invalid extension token";
export const REQUEST_AUTHENTICATION_REQUIRED_ERROR = "Authentication required";

export async function getRequestOrganizationId(request: Request) {
  const token = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (token) {
    const extensionSession = await verifyExtensionAccessToken(token);

    if (!extensionSession) {
      throw new Error(INVALID_EXTENSION_TOKEN_ERROR);
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: extensionSession.userId,
        organizationId: extensionSession.organizationId,
      },
      select: {
        organizationId: true,
      },
    });

    if (!membership) {
      throw new Error(INVALID_EXTENSION_TOKEN_ERROR);
    }

    return membership.organizationId;
  }

  const appContext = await getCurrentAppContext();

  if (!appContext) {
    throw new Error(REQUEST_AUTHENTICATION_REQUIRED_ERROR);
  }

  return appContext.organization.id;
}