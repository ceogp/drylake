import { prisma } from "@/lib/prisma";

export async function resolveIntegrationActorUser(params: {
  organizationId: string;
  preferredUserId?: string | null;
}) {
  if (params.preferredUserId) {
    const preferred = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: params.organizationId,
        userId: params.preferredUserId,
      },
      include: {
        user: true,
      },
    });

    if (preferred?.user) {
      return preferred.user;
    }
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: params.organizationId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const preferredMembership =
    memberships.find((membership) => membership.role === "owner") ??
    memberships.find((membership) => membership.role === "admin") ??
    memberships[0];

  if (!preferredMembership?.user) {
    throw new Error("No organization user is available to execute integration commands.");
  }

  return preferredMembership.user;
}
