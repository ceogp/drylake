import { z } from "zod";

import { created, forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess, requireOrganizationRole } from "@/lib/services/access";
import { createIntegration } from "@/lib/services/integrations";

const createIntegrationSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.string().min(1),
  credentialId: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  try {
    const context = await requireOrganizationAccess();
    const organizationId = context.organization.id;

    const integrations = organizationId
      ? await prisma.integration.findMany({
          where: { organizationId },
          include: { credential: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return ok({ integrations });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to list integrations");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createIntegrationSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const integration = await createIntegration({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      provider: parsed.data.provider,
      credentialId: parsed.data.credentialId,
      config: parsed.data.config,
    });

    return created({ integration });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage integrations in that organization.");
    }

    console.error(error);
    return internalError("Failed to create integration");
  }
}
