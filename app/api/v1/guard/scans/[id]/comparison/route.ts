import { internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import {
  compareScanToBaseline,
  compareScanToPreviousPersonalScan,
} from "@/lib/services/team-security";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function GET(request: Request, context: RouteContext<"/api/v1/guard/scans/[id]/comparison">) {
  try {
    const [{ id }, authContext] = await Promise.all([
      context.params,
      getRequestOrganizationContext(request),
    ]);
    const { resolved } = await getEntitlementsForOrganization(authContext.organizationId);
    const [personalComparison, baselineComparison] = await Promise.all([
      resolved.canUseFixWithAI
        ? compareScanToPreviousPersonalScan({
            organizationId: authContext.organizationId,
            actorUserId: authContext.userId,
            guardScanId: id,
          })
        : Promise.resolve(null),
      resolved.canUseTeamBaseline
        ? compareScanToBaseline({
            organizationId: authContext.organizationId,
            guardScanId: id,
          })
        : Promise.resolve(null),
    ]);

    return ok({
      personalComparison,
      baselineComparison,
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    if (error instanceof Error && error.message === "Guard scan not found") {
      return notFound("Guard scan not found.");
    }

    console.error(error);
    return internalError("Failed to load Guard scan comparison.");
  }
}
