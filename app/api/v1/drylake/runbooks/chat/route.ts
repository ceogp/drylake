import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { assertEntitlement } from "@/lib/services/entitlements";
import {
  generatePlanningChatReply,
  runbookPlanningChatInputSchema,
} from "@/lib/services/runbook-generation";
import {
  getRequestOrganizationId,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = runbookPlanningChatInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const organizationId = await getRequestOrganizationId(request);

    try {
      await assertEntitlement(organizationId, "xupra_pro_ai");
    } catch (error) {
      if (error instanceof Error && error.message === "Organization is not entitled to use xupra_pro_ai") {
        return forbidden("Xupra AI requires a Pro plan.");
      }

      throw error;
    }

    try {
      const result = await generatePlanningChatReply(parsed.data);
      return ok(result);
    } catch (error) {
      // Hide config errors from user, log real error
      if (
        error instanceof Error &&
        (error.message.includes("OPENAI_API_KEY is missing") ||
         error.message.includes("OPENAI_MODEL is missing") ||
         error.message.includes("Xupra AI is not configured"))
      ) {
        console.error("[Xupra AI Planning Chat config error]", error);
        return internalError("Chat is unavailable. Please try again later.");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to run DryLake Planning Chat");
  }
}