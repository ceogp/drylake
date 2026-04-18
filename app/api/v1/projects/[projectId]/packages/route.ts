import { z } from "zod";

import { created, fromZodError, internalError, ok } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils/slug";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

const createPackageSchema = z.object({
  createdByUserId: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  sourcePlatform: z.string().trim().min(1).default("generic"),
  defaultTargetPlatform: z.string().trim().min(1).optional(),
});

export async function GET(_: Request, context: Context) {
  try {
    const { projectId } = await context.params;

    const packages = await prisma.agentPackage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
          take: 3,
        },
      },
    });

    return ok({ packages });
  } catch (error) {
    console.error(error);
    return internalError("Failed to list packages");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = createPackageSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const agentPackage = await prisma.agentPackage.create({
      data: {
        projectId,
        createdByUserId: parsed.data.createdByUserId,
        name: parsed.data.name,
        slug: parsed.data.slug ? toSlug(parsed.data.slug) : toSlug(parsed.data.name),
        description: parsed.data.description,
        sourcePlatform: parsed.data.sourcePlatform,
        defaultTargetPlatform: parsed.data.defaultTargetPlatform,
      },
    });

    return created({ package: agentPackage });
  } catch (error) {
    console.error(error);
    return internalError("Failed to create package");
  }
}
