import { z } from "zod";

import { created, fromZodError, internalError, ok } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{
    packageId: string;
  }>;
};

const createVersionSchema = z.object({
  createdByUserId: z.string().min(1),
  origin: z.string().trim().min(1).default("manual"),
});

export async function GET(_: Request, context: Context) {
  try {
    const { packageId } = await context.params;

    const versions = await prisma.packageVersion.findMany({
      where: { agentPackageId: packageId },
      orderBy: { versionNumber: "desc" },
      include: {
        subagents: true,
        skillRules: true,
      },
    });

    return ok({ versions });
  } catch (error) {
    console.error(error);
    return internalError("Failed to list versions");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { packageId } = await context.params;
    const body = await request.json();
    const parsed = createVersionSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const latestVersion = await prisma.packageVersion.findFirst({
      where: { agentPackageId: packageId },
      orderBy: { versionNumber: "desc" },
    });

    const version = await prisma.packageVersion.create({
      data: {
        agentPackageId: packageId,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        status: "draft",
        origin: parsed.data.origin,
        manifestJson: {
          name: "New Package Version",
          targetPlatforms: [],
        },
        agentDefinitionJson: {
          description: "",
          instructions: "",
          tools: [],
        },
        validationJson: {
          issues: [],
          warnings: [],
        },
        createdByUserId: parsed.data.createdByUserId,
      },
    });

    await prisma.agentPackage.update({
      where: { id: packageId },
      data: {
        latestVersionId: version.id,
      },
    });

    return created({ version });
  } catch (error) {
    console.error(error);
    return internalError("Failed to create package version");
  }
}
