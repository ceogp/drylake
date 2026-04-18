import { forbidden, internalError, ok, unauthorized } from "@/lib/api/http";
import { requireOrganizationAccess } from "@/lib/services/access";
import { getAuditEvents } from "@/lib/services/reports";

export async function GET() {
  try {
    const context = await requireOrganizationAccess();
    const organizationId = context.organization.id;

    if (!organizationId) {
      return ok({ auditEvents: [] });
    }

    return ok({
      auditEvents: await getAuditEvents(organizationId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to fetch audit events");
  }
}
