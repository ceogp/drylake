import { z } from "zod";

import { forbidden, fromZodError, internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const updateVersionSchema = z.object({
  manifestName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  tools: z.array(z.string()).optional(),
  targetPlatforms: z.array(z.string()).optional(),
});

export async function GET(_: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    await requireVersionAccess(versionId);
    const version = await prisma.packageVersion.findUnique({
      where: { id: versionId },
      include: {
        files: true,
        subagents: true,
        skillRules: true,
        transformJobs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!version) {
      return notFound("Version not found");
    }

    return ok({ version });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to fetch version");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = await request.json();
    const parsed = updateVersionSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { version } = await requireVersionAccess(versionId);

    if (!version) {
      return notFound("Version not found");
    }

    const manifest = (version.manifestJson as Record<string, unknown>) ?? {};
    const agentDefinition = (version.agentDefinitionJson as Record<string, unknown>) ?? {};

    const updatedVersion = await prisma.packageVersion.update({
      where: { id: versionId },
      data: {
        manifestJson: {
          ...manifest,
          ...(parsed.data.manifestName ? { name: parsed.data.manifestName } : {}),
          ...(parsed.data.targetPlatforms ? { targetPlatforms: parsed.data.targetPlatforms } : {}),
        },
        agentDefinitionJson: {
          ...agentDefinition,
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.instructions !== undefined ? { instructions: parsed.data.instructions } : {}),
          ...(parsed.data.tools ? { tools: parsed.data.tools } : {}),
        },
      },
    });

    return ok({ version: updatedVersion });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to update that package version.");
    }

    console.error(error);
    return internalError("Failed to update version");
  }
}
