import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { assertEntitlement } from "@/lib/services/entitlements";
import { getRequestOrganizationId, INVALID_EXTENSION_TOKEN_ERROR, REQUEST_AUTHENTICATION_REQUIRED_ERROR } from "@/lib/services/request-organization";
import { generateSkillWithAi } from "@/lib/services/skill-generation";

const payloadSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  targetPlatform: z.string().trim().min(1),
  context: z.string().trim().optional(),
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
          return forbidden("Xupra AI skill creation requires a Pro plan.");
      }

      throw error;
    }

    const skill = await generateSkillWithAi(parsed.data);

    return ok({ skill });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to generate skill");
  }
}
