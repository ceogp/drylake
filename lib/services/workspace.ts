import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";

export async function getActiveWorkspace() {
  const context = await getCurrentAppContext();

  if (!context) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: context.organization.id },
    include: {
      projects: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          packages: {
            orderBy: { createdAt: "desc" },
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  return {
    user: context.user,
    profile: context.user.profile,
    organization,
  };
}
