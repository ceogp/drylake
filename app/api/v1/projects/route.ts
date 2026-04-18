import { z } from "zod";

import { badRequest, created, forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess, requireOrganizationRole } from "@/lib/services/access";
import { toSlug } from "@/lib/utils/slug";

const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  createdByUserId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedOrganizationId = searchParams.get("organizationId");
    const context = await requireOrganizationAccess(requestedOrganizationId ?? undefined);
    const organizationId = context.organization.id;

    if (!organizationId) {
      return badRequest("No active organization was found for this session");
    }

    const projects = await prisma.project.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        packages: {
          select: {
            id: true,
            name: true,
            slug: true,
            latestVersionId: true,
            versions: {
              select: {
                id: true,
                versionNumber: true,
                status: true,
              },
              orderBy: { versionNumber: "desc" },
              take: 5,
            },
          },
        },
      },
    });

    return ok({ projects });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that organization.");
    }

    console.error(error);
    return internalError("Failed to list projects");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const slug = parsed.data.slug ? toSlug(parsed.data.slug) : toSlug(parsed.data.name);
    const context = await requireOrganizationRole(["owner", "admin", "member"], parsed.data.organizationId);

    const project = await prisma.project.create({
      data: {
        organizationId: context.organization.id,
        createdByUserId: parsed.data.createdByUserId || context.user.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
      },
    });

    return created({ project });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to create projects in that organization.");
    }

    console.error(error);
    return internalError("Failed to create project");
  }
}
