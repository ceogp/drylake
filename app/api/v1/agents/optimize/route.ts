import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { optimizeAgentWithAi } from "@/lib/services/agent-generation";
import { assertEntitlement } from "@/lib/services/entitlements";
import { EXPORT_TARGETS } from "@/lib/services/import-export";
import { getRequestOrganizationId, INVALID_EXTENSION_TOKEN_ERROR, REQUEST_AUTHENTICATION_REQUIRED_ERROR } from "@/lib/services/request-organization";

const payloadSchema = z.object({
  content: z.string().min(1),
  targetPlatform: z.enum([...EXPORT_TARGETS] as unknown as [string, ...string[]]),
  fileName: z.string().trim().max(512).optional(),
  repoContext: z.string().trim().max(8000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const organizationId = await getRequestOrganizationId(request);

    try {
      await assertEntitlement(organizationId, "xupra_pro_ai");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Organization is not entitled to use xupra_pro_ai"
      ) {
        return forbidden("Xupra Pro AI optimization requires a Pro plan.");
      }

      throw error;
    }

    const optimized = await optimizeAgentWithAi(parsed.data);

    return ok({ optimized });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to optimize file");
  }
}
