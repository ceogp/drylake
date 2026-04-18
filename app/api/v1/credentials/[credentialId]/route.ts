import { z } from "zod";

import { forbidden, fromZodError, internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireCredentialAccess, requireOrganizationRole } from "@/lib/services/access";
import { deleteCredential, updateCredential } from "@/lib/services/credentials";

type Context = {
  params: Promise<{
    credentialId: string;
  }>;
};

const updateCredentialSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  kind: z.string().min(1),
  secret: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_: Request, context: Context) {
  try {
    const { credentialId } = await context.params;
    await requireCredentialAccess(credentialId);
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
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

    if (!credential) {
      return notFound("Credential not found");
    }

    return ok({ credential });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to fetch credential");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { credentialId } = await context.params;
    const body = await request.json();
    const parsed = updateCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext, credential: existingCredential } = await requireCredentialAccess(credentialId);
    await requireOrganizationRole(["owner", "admin"], existingCredential.organizationId);
    const credential = await updateCredential({
      credentialId,
      actorUserId: appContext.user.id,
      name: parsed.data.name,
      provider: parsed.data.provider,
      kind: parsed.data.kind,
      secret: parsed.data.secret,
      metadata: parsed.data.metadata,
    });

    return ok({
      credential: {
        id: credential.id,
        name: credential.name,
        provider: credential.provider,
        kind: credential.kind,
        keyVersion: credential.keyVersion,
        lastVerifiedAt: credential.lastVerifiedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to update that credential.");
    }

    console.error(error);
    return internalError("Failed to update credential");
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { credentialId } = await context.params;
    const { context: appContext, credential } = await requireCredentialAccess(credentialId);
    await requireOrganizationRole(["owner", "admin"], credential.organizationId);

    await deleteCredential({
      credentialId,
      actorUserId: appContext.user.id,
    });

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to delete that credential.");
    }

    console.error(error);
    return internalError("Failed to delete credential");
  }
}
