import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import {
  EXTENSION_TOKEN_HEADER,
  verifyExtensionAccessToken,
} from "@/lib/services/extension-tokens";

export const INVALID_EXTENSION_TOKEN_ERROR = "Invalid extension token";
export const REQUEST_AUTHENTICATION_REQUIRED_ERROR = "Authentication required";

export type RequestOrganizationContext = {
  organizationId: string;
  userId: string;
};

export async function getRequestOrganizationContext(request: Request): Promise<RequestOrganizationContext> {
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
        userId: true,
      },
    });

    if (!membership) {
      throw new Error(INVALID_EXTENSION_TOKEN_ERROR);
    }

    return {
      organizationId: membership.organizationId,
      userId: membership.userId,
    };
  }

  const appContext = await getCurrentAppContext();

  if (!appContext) {
    throw new Error(REQUEST_AUTHENTICATION_REQUIRED_ERROR);
  }

  return {
    organizationId: appContext.organization.id,
    userId: appContext.user.id,
  };
}

export async function getRequestOrganizationId(request: Request) {
  const context = await getRequestOrganizationContext(request);
  return context.organizationId;
}
