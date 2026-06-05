import { created, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import {
  extensionUsageEventInputSchema,
  recordExtensionUsageEvent,
} from "@/lib/services/extension-usage-events";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = extensionUsageEventInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);
    const event = await recordExtensionUsageEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      event: parsed.data,
    });

    return created({ event });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to record extension usage event");
  }
}
