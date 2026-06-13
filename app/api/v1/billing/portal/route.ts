import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole } from "@/lib/services/access";
import { createBillingPortalSession } from "@/lib/services/billing";

const portalSchema = z.object({
  organizationId: z.string().min(1).optional(),
  billingContext: z.enum(["user", "team"]).default("user"),
  returnPath: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = portalSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const session = await createBillingPortalSession({
      organizationId: context.organization.id,
      returnPath: parsed.data.returnPath,
    });

    return created(session);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage billing for that organization.");
    }

    console.error(error);
    return internalError("Failed to create billing portal session");
  }
}
