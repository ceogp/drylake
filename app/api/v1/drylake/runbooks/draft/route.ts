import { fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import {
  buildRunbookDraftPrompt,
  runbookGenerationInputSchema,
} from "@/lib/services/runbook-generation";
import { resolveRunbookPlanningAccess } from "@/lib/services/runbook-planning-access";
import { recordRunbookPlanningUsage } from "@/lib/services/extension-usage-events";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = runbookGenerationInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);

    const access = await resolveRunbookPlanningAccess(context.organizationId);
    await recordRunbookPlanningUsage({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      promptKind: "planning_draft",
      promptText: parsed.data.prompt,
      metadata: {
        endpoint: "draft",
        mode: parsed.data.mode,
        requestedStageCount: parsed.data.requestedStageCount,
        modelTier: access.tier,
        model: access.model,
      },
    });
    const result = await buildRunbookDraftPrompt(parsed.data, { model: access.model });

    return ok({ ...result, modelTier: access.tier });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to generate DryLake runbook draft");
  }
}
