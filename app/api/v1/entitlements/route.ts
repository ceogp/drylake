import { internalError, ok, unauthorized } from "@/lib/api/http";
import { requireCurrentAppContext } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireCurrentAppContext();
    const { resolved } = await getEntitlementsForOrganization(context.organization.id);

    return ok({
      userId: context.user.id,
      teamId: resolved.subjectType === "team" ? context.organization.id : undefined,
      plan: resolved.plan,
      entitlementVersion: resolved.entitlementVersion,
      capabilities: {
        canUseHostedPlanning: resolved.canUseHostedPlanning,
        canUseFixWithAI: resolved.canUseFixWithAI,
        canUseApprovedUpload: resolved.canUseApprovedUpload,
        canUseDeepCloudAnalysis: resolved.canUseDeepCloudAnalysis,
        canUseSuspiciousArtifactScan: resolved.canUseSuspiciousArtifactScan,
        canUseLocalWatchdog: resolved.canUseLocalWatchdog,
        canCreateTeam: resolved.canCreateTeam,
        canUseTeamBaseline: resolved.canUseTeamBaseline,
        canUseContinuousWatch: resolved.canUseContinuousWatch,
        canManageTeamPolicy: resolved.canManageTeamPolicy,
      },
      billing: {
        status: resolved.billingStatus,
        currentPeriodEnd: resolved.currentPeriodEnd,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    console.error(error);
    return internalError("Failed to resolve entitlements");
  }
}
