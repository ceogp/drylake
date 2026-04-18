import { forbidden, internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requirePackageAccess } from "@/lib/services/access";

type Context = {
  params: Promise<{
    packageId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { packageId } = await context.params;
    await requirePackageAccess(packageId);
    const agentPackage = await prisma.agentPackage.findUnique({
      where: { id: packageId },
      include: {
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
        },
      },
    });

    if (!agentPackage) {
      return notFound("Package not found");
    }

    return ok({ package: agentPackage });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    console.error(error);
    return internalError("Failed to fetch package");
  }
}
