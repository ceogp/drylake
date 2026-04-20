import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { STARTER_VERSION_ORIGIN } from "@/lib/services/dev-session";

async function getLatestWorkspaceVersionPath(organizationId: string) {
  const latestVersion = await prisma.packageVersion.findFirst({
    where: {
      agentPackage: {
        project: {
          organizationId,
          archivedAt: null,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { versionNumber: "desc" }],
    select: {
      id: true,
    },
  });

  if (!latestVersion) {
    return null;
  }

  return `/versions/${latestVersion.id}`;
}

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

export async function getStarterWorkspaceRedirectPath() {
  const context = await getCurrentAppContext();

  if (!context) {
    return null;
  }

  const versionCount = await prisma.packageVersion.count({
    where: {
      agentPackage: {
        project: {
          organizationId: context.organization.id,
          archivedAt: null,
        },
      },
    },
  });

  if (versionCount !== 1) {
    return null;
  }

  const starterVersion = await prisma.packageVersion.findFirst({
    where: {
      origin: STARTER_VERSION_ORIGIN,
      agentPackage: {
        project: {
          organizationId: context.organization.id,
          archivedAt: null,
        },
      },
      files: {
        none: {},
      },
      subagents: {
        none: {},
      },
      skillRules: {
        none: {},
      },
      transformJobs: {
        none: {},
      },
      deploymentJobs: {
        none: {},
      },
    },
    select: {
      id: true,
    },
  });

  if (!starterVersion) {
    return null;
  }

  return `/versions/${starterVersion.id}`;
}

export async function getImportWorkspacePath() {
  const context = await getCurrentAppContext();

  if (!context) {
    return null;
  }

  const starterVersion = await prisma.packageVersion.findFirst({
    where: {
      origin: STARTER_VERSION_ORIGIN,
      agentPackage: {
        project: {
          organizationId: context.organization.id,
          archivedAt: null,
        },
      },
    },
    orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
    },
  });

  if (!starterVersion) {
    return getLatestWorkspaceVersionPath(context.organization.id);
  }

  return `/versions/${starterVersion.id}`;
}

export async function getPrimaryWorkspacePath() {
  const context = await getCurrentAppContext();

  if (!context) {
    return null;
  }

  const latestImportedVersion = await prisma.transformJob.findFirst({
    where: {
      organizationId: context.organization.id,
      jobType: "import_parse",
      status: "succeeded",
      packageVersionId: {
        not: null,
      },
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      packageVersionId: true,
    },
  });

  if (latestImportedVersion?.packageVersionId) {
    return `/versions/${latestImportedVersion.packageVersionId}`;
  }

  const importWorkspacePath = await getImportWorkspacePath();

  if (importWorkspacePath) {
    return importWorkspacePath;
  }

  return getLatestWorkspaceVersionPath(context.organization.id);
}
