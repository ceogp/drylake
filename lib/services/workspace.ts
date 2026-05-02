import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { ensureStarterWorkspace, STARTER_VERSION_ORIGIN } from "@/lib/services/dev-session";

const uploadPath = "/upload";

async function getLatestWorkspaceVersionId(organizationId: string) {
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

  return latestVersion.id;
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

  return uploadPath;
}

export async function getImportWorkspaceVersionId() {
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

  if (starterVersion) {
    return starterVersion.id;
  }

  const latestWorkspaceVersionId = await getLatestWorkspaceVersionId(context.organization.id);

  if (latestWorkspaceVersionId) {
    return latestWorkspaceVersionId;
  }

  await ensureStarterWorkspace({
    organizationId: context.organization.id,
    userId: context.user.id,
  });

  const ensuredStarterVersion = await prisma.packageVersion.findFirst({
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

  return ensuredStarterVersion?.id ?? null;
}

export async function getImportWorkspacePath() {
  const versionId = await getImportWorkspaceVersionId();
  return versionId ? uploadPath : null;
}

export async function getPrimaryWorkspaceVersionId() {
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
    return latestImportedVersion.packageVersionId;
  }

  const importWorkspaceVersionId = await getImportWorkspaceVersionId();

  if (importWorkspaceVersionId) {
    return importWorkspaceVersionId;
  }

  return getLatestWorkspaceVersionId(context.organization.id);
}

export async function getPrimaryWorkspacePath() {
  const versionId = await getPrimaryWorkspaceVersionId();
  return versionId ? uploadPath : null;
}
