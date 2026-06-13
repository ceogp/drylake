import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole } from "@/lib/services/access";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { getOrCreateTeamPolicy, updateTeamPolicy } from "@/lib/services/team-security";

const policySchema = z.object({
  organizationId: z.string().min(1).optional(),
  mcpAllowlist: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  mcpDenylist: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  extensionAllowlist: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  extensionDenylist: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
  retentionDays: z.number().int().min(7).max(3650).default(90),
});

export async function GET() {
  try {
    const context = await requireOrganizationRole(["owner", "admin", "member", "viewer"]);
    const { resolved } = await getEntitlementsForOrganization(context.organization.id);

    if (!resolved.canManageTeamPolicy && !resolved.canUseTeamBaseline) {
      return forbidden("Team policy requires Team Security.");
    }

    const policy = await getOrCreateTeamPolicy(context.organization.id);
    return ok({ policy });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    console.error(error);
    return internalError("Failed to load team policy");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = policySchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const { resolved } = await getEntitlementsForOrganization(context.organization.id);

    if (!resolved.canManageTeamPolicy) {
      return forbidden("Team policy management requires Team Security.");
    }

    const policy = await updateTeamPolicy({
      organizationId: context.organization.id,
      mcpAllowlist: parsed.data.mcpAllowlist,
      mcpDenylist: parsed.data.mcpDenylist,
      extensionAllowlist: parsed.data.extensionAllowlist,
      extensionDenylist: parsed.data.extensionDenylist,
      retentionDays: parsed.data.retentionDays,
    });

    return ok({ policy });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage team policy.");
    }

    console.error(error);
    return internalError("Failed to update team policy");
  }
}
