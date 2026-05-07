import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { optimizeAgentWithAi } from "@/lib/services/agent-generation";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { assertEntitlement } from "@/lib/services/entitlements";
import {
  EXTENSION_TOKEN_HEADER,
  verifyExtensionAccessToken,
} from "@/lib/services/extension-tokens";

const payloadSchema = z.object({
  content: z.string().min(1),
  targetPlatform: z.enum(["codex", "claude_code", "claude_agents", "cursor"]),
  fileName: z.string().trim().max(512).optional(),
  repoContext: z.string().trim().max(8000).optional(),
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
      select: { organizationId: true },
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
        return forbidden("Xupra AI optimization requires a Pro plan.");
      }

      throw error;
    }

    const optimized = await optimizeAgentWithAi(parsed.data);

    return ok({ optimized });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Invalid extension token") {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to optimize file");
  }
}
