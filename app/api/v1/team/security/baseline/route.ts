import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole } from "@/lib/services/access";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { compareScanToBaseline, markGuardScanAsBaseline } from "@/lib/services/team-security";

const baselineSchema = z.object({
  organizationId: z.string().min(1).optional(),
  guardScanId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = baselineSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const { resolved } = await getEntitlementsForOrganization(context.organization.id);

    if (!resolved.canUseTeamBaseline) {
      return forbidden("Team Baseline requires Team Security.");
    }

    const baseline = await markGuardScanAsBaseline({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      guardScanId: parsed.data.guardScanId,
    });

    return ok({
      baseline: {
        id: baseline.id,
        guardScanId: baseline.guardScanId,
        workspaceHash: baseline.workspaceHash,
        createdAt: baseline.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage Team Baseline.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to mark baseline");
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const guardScanId = url.searchParams.get("guardScanId")?.trim();

    if (!guardScanId) {
      return ok({ baseline: null, diff: null });
    }

    const context = await requireOrganizationRole(["owner", "admin", "member", "viewer"]);
    const { resolved } = await getEntitlementsForOrganization(context.organization.id);

    if (!resolved.canUseTeamBaseline) {
      return forbidden("Team Baseline requires Team Security.");
    }

    const result = await compareScanToBaseline({
      organizationId: context.organization.id,
      guardScanId,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to compare baseline");
  }
}
