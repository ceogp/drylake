import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { recordExtensionUsageEventBestEffort } from "@/lib/services/extension-usage-events";
import { resolveGuardFixAccess } from "@/lib/services/guard-fix-access";
import {
  generateGuardFixPlan,
  guardFixPlanInputSchema,
} from "@/lib/services/guard-remediation";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = guardFixPlanInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);
    const access = await resolveGuardFixAccess(context.organizationId);

    if (!access.paid) {
      return forbidden("DryLake Guard Fix with AI requires a paid Guard plan. Upgrade to continue.");
    }

    await recordExtensionUsageEventBestEffort({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      event: {
        eventName: "guard_fix_ai_requested",
        workspaceHash: parsed.data.workspaceHash,
        actionType: "guard_fix_ai",
        promptKind: "guard_fix_ai",
        promptText: JSON.stringify(parsed.data),
        metadata: {
          endpoint: "guard_fix_plan",
          modelTier: access.modelTier,
          model: access.model,
          sourceClient: parsed.data.sourceClient,
          score: parsed.data.scan.score,
          rank: parsed.data.scan.rank,
          findings: parsed.data.scan.findings.length,
          secrets: parsed.data.scan.secrets.length,
          mcpServers: parsed.data.scan.mcpServers.length,
          extensions: parsed.data.scan.extensions.length,
        },
      },
    });

    const plan = await generateGuardFixPlan(parsed.data, { model: access.model });

    return ok({
      plan,
      modelTier: access.modelTier,
      model: access.model,
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized("Register free before using DryLake Guard Fix with AI.");
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to generate DryLake Guard fix plan");
  }
}
