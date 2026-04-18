import { z } from "zod";

import { created, forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess, requireOrganizationRole } from "@/lib/services/access";
import { createCredential } from "@/lib/services/credentials";

const createCredentialSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  kind: z.string().min(1),
  secret: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  try {
    const context = await requireOrganizationAccess();
    const organizationId = context.organization.id;

    if (!organizationId) {
      return ok({ credentials: [] });
    }

    const credentials = await prisma.credential.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        provider: true,
        kind: true,
        keyVersion: true,
        metadataJson: true,
        lastVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ credentials });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to those credentials.");
    }

    console.error(error);
    return internalError("Failed to list credentials");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireOrganizationRole(["owner", "admin"], parsed.data.organizationId);
    const credential = await createCredential({
      organizationId: context.organization.id,
      createdByUserId: context.user.id,
      name: parsed.data.name,
      provider: parsed.data.provider,
      kind: parsed.data.kind,
      secret: parsed.data.secret,
      metadata: parsed.data.metadata,
    });

    return created({
      credential: {
        id: credential.id,
        name: credential.name,
        provider: credential.provider,
        kind: credential.kind,
        keyVersion: credential.keyVersion,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage credentials in that organization.");
    }

    console.error(error);
    return internalError("Failed to create credential");
  }
}
