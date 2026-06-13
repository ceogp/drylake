import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import {
  guardScanUploadSchema,
  recordGuardScanUpload,
} from "@/lib/services/guard";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = guardScanUploadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);
    const { resolved } = await getEntitlementsForOrganization(context.organizationId);

    if (parsed.data.consentMode === "baseline_upload" && !resolved.canUseTeamBaseline) {
      return forbidden("Team Baseline requires Team Security.");
    }

    if (parsed.data.consentMode === "active_guard" && !resolved.canUseApprovedUpload) {
      return forbidden("Approved upload and Deep Cloud Analysis require Security Pro.");
    }

    const result = await recordGuardScanUpload({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      payload: parsed.data,
    });

    return ok({
      guardScan: {
        id: result.guardScan.id,
        createdAt: result.guardScan.createdAt.toISOString(),
      },
      artifacts: result.artifacts,
      uploadedArtifactCount: result.artifacts.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized("Register free to use DryLake Guard.");
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to record DryLake Guard scan");
  }
}
