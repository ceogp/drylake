import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { assertEntitlement } from "@/lib/services/entitlements";
import {
  EXTENSION_TOKEN_HEADER,
  verifyExtensionAccessToken,
} from "@/lib/services/extension-tokens";
import { generateSkillWithAi } from "@/lib/services/skill-generation";

const payloadSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  targetPlatform: z.string().trim().min(1),
  context: z.string().trim().optional(),
});

async function getRequestOrganizationId(request: Request) {
  const token = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (token) {
    const extensionSession = await verifyExtensionAccessToken(token);

    if (!extensionSession) {
      throw new Error("Invalid extension token");
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
      throw new Error("Invalid extension token");
    }

    return membership.organizationId;
  }

  const appContext = await getCurrentAppContext();

  if (!appContext) {
    throw new Error("Authentication required");
  }

  return appContext.organization.id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const organizationId = await getRequestOrganizationId(request);

    try {
      await assertEntitlement(organizationId, "manual_export");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Organization is not entitled to use manual_export"
      ) {
        return forbidden("AI skill creation requires a Pro plan.");
      }

      throw error;
    }

    const skill = await generateSkillWithAi(parsed.data);

    return ok({ skill });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Invalid extension token") {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to generate skill");
  }
}
