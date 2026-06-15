import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole } from "@/lib/services/access";
import { createKyaSurveyInvite } from "@/KYAregistry/services/surveys";

const requestSchema = z.object({
  organizationId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().max(320),
  expiresInDays: z.number().int().min(1).max(90).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const invite = await createKyaSurveyInvite({
      organizationId: context.organization.id,
      companyId: parsed.data.companyId,
      productId: parsed.data.productId,
      email: parsed.data.email,
      expiresInDays: parsed.data.expiresInDays,
    });

    return created({
      invite: {
        id: invite.invite.id,
        email: invite.invite.email,
        status: invite.invite.status,
        expiresAt: invite.invite.expiresAt.toISOString(),
        surveyUrl: invite.surveyUrl,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to create registry survey invites.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to create KYA survey invite");
  }
}
