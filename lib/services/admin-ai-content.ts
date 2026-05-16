import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { readArtifactText } from "@/lib/storage/artifacts";

const defaultPageSize = 25;
const maxPageSize = 100;
const exportTargets = new Set([
  "codex",
  "claude_code",
  "claude_agents",
  "cursor",
  "windsurf",
  "cline",
  "roo",
  "copilot",
  "gemini",
  "junie",
  "warp",
  "generic",
]);

const userSummarySelect = {
  id: true,
  email: true,
  profile: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.UserSelect;

const versionContextSelect = {
  id: true,
  versionNumber: true,
  status: true,
  origin: true,
  manifestJson: true,
  agentDefinitionJson: true,
  compatibilityJson: true,
  validationJson: true,
  createdAt: true,
  createdByUser: {
    select: userSummarySelect,
  },
  agentPackage: {
    select: {
      id: true,
      name: true,
      slug: true,
      sourcePlatform: true,
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PackageVersionSelect;

type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
type VersionContext = Prisma.PackageVersionGetPayload<{ select: typeof versionContextSelect }>;

export type AdminAiContentRow = {
  id: string;
  dbId: string;
  createdAt: Date;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  projectId: string | null;
  projectName: string;
  packageId: string | null;
  packageName: string;
  versionId: string | null;
  versionNumber: number | null;
  sourcePlatform: string;
  targetPlatform: string;
  recordStage: "uploaded" | "imported" | "transformed" | "exported";
  recordType: string;
  itemName: string;
  logicalPath: string;
  content: string;
  metadata: unknown;
};

type PendingAdminAiContentRow = Omit<AdminAiContentRow, "content"> & {
  content?: string;
  resolveContent?: () => Promise<string>;
};

function normalizePage(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizePageSize(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return defaultPageSize;
  }

  return Math.min(Math.floor(value), maxPageSize);
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function userDisplayName(user: UserSummary) {
  return user.profile?.displayName ?? "";
}

function baseFromVersion(version: VersionContext, params: { id: string; dbId: string; createdAt: Date }) {
  const project = version.agentPackage.project;
  const organization = project.organization;

  return {
    id: params.id,
    dbId: params.dbId,
    createdAt: params.createdAt,
    userId: version.createdByUser.id,
    userEmail: version.createdByUser.email,
    userDisplayName: userDisplayName(version.createdByUser),
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    projectId: project.id,
    projectName: project.name,
    packageId: version.agentPackage.id,
    packageName: version.agentPackage.name,
    versionId: version.id,
    versionNumber: version.versionNumber,
    sourcePlatform: version.agentPackage.sourcePlatform,
  };
}

function canReadTextFile(file: { mimeType: string; logicalPath: string }) {
  if (file.mimeType.startsWith("text/")) {
    return true;
  }

  const lowerPath = file.logicalPath.toLowerCase();
  return (
    lowerPath.endsWith(".md") ||
    lowerPath.endsWith(".mdc") ||
    lowerPath.endsWith(".txt") ||
    lowerPath.endsWith(".json") ||
    lowerPath.endsWith(".json5") ||
    lowerPath.endsWith(".yaml") ||
    lowerPath.endsWith(".yml") ||
    lowerPath.endsWith(".toml") ||
    lowerPath.endsWith(".py")
  );
}

function fileStage(kind: string): AdminAiContentRow["recordStage"] {
  if (kind === "generated_export") {
    return "exported";
  }

  if (kind === "raw_source") {
    return "uploaded";
  }

  return "transformed";
}

function targetPlatformFromPath(kind: string, logicalPath: string) {
  if (kind !== "generated_export") {
    return "";
  }

  const [target] = logicalPath.split("/");
  return exportTargets.has(target) ? target : "";
}

function transformStage(jobType: string): AdminAiContentRow["recordStage"] {
  if (jobType === "export_build") {
    return "exported";
  }

  if (jobType === "import_parse") {
    return "imported";
  }

  return "transformed";
}

async function resolveRows(rows: PendingAdminAiContentRow[]) {
  return Promise.all(
    rows.map(async (row) => {
      const { content, resolveContent, ...rest } = row;

      return {
        ...rest,
        content: content ?? (resolveContent ? await resolveContent() : ""),
      };
    }),
  );
}

async function buildPendingAdminAiContentRows(userId?: string) {
  const versionWhere: Prisma.PackageVersionWhereInput | undefined = userId
    ? { createdByUserId: userId }
    : undefined;

  const [versions, skillRules, subagents, packageFiles, transformJobs] = await Promise.all([
    prisma.packageVersion.findMany({
      where: versionWhere,
      select: versionContextSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.skillRule.findMany({
      where: userId ? { packageVersion: { createdByUserId: userId } } : undefined,
      select: {
        id: true,
        name: true,
        kind: true,
        bodyMd: true,
        metadataJson: true,
        createdAt: true,
        packageVersion: {
          select: versionContextSelect,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subagent.findMany({
      where: userId ? { packageVersion: { createdByUserId: userId } } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        instructionsMd: true,
        toolsJson: true,
        modelHint: true,
        permissionMode: true,
        metadataJson: true,
        sortOrder: true,
        createdAt: true,
        packageVersion: {
          select: versionContextSelect,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.packageFile.findMany({
      where: userId ? { packageVersion: { createdByUserId: userId } } : undefined,
      select: {
        id: true,
        kind: true,
        logicalPath: true,
        storageKey: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        sourceFormat: true,
        createdAt: true,
        packageVersion: {
          select: versionContextSelect,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transformJob.findMany({
      where: userId ? { createdByUserId: userId } : undefined,
      select: {
        id: true,
        jobType: true,
        status: true,
        sourcePlatform: true,
        targetPlatform: true,
        inputJson: true,
        resultJson: true,
        errorJson: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        createdByUser: {
          select: userSummarySelect,
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        agentPackage: {
          select: {
            id: true,
            name: true,
            sourcePlatform: true,
          },
        },
        packageVersion: {
          select: {
            id: true,
            versionNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: PendingAdminAiContentRow[] = [];

  for (const version of versions) {
    rows.push({
      ...baseFromVersion(version, {
        id: `version:${version.id}`,
        dbId: version.id,
        createdAt: version.createdAt,
      }),
      targetPlatform: "",
      recordStage: "transformed",
      recordType: "agent_definition",
      itemName: `${version.agentPackage.name} v${version.versionNumber} agent definition`,
      logicalPath: "",
      content: stringifyJson(version.agentDefinitionJson),
      metadata: {
        status: version.status,
        origin: version.origin,
        manifestJson: version.manifestJson,
        compatibilityJson: version.compatibilityJson,
        validationJson: version.validationJson,
      },
    });
  }

  for (const rule of skillRules) {
    rows.push({
      ...baseFromVersion(rule.packageVersion, {
        id: `skill-rule:${rule.id}`,
        dbId: rule.id,
        createdAt: rule.createdAt,
      }),
      targetPlatform: "",
      recordStage: "transformed",
      recordType: rule.kind,
      itemName: rule.name,
      logicalPath: "",
      content: rule.bodyMd,
      metadata: rule.metadataJson,
    });
  }

  for (const subagent of subagents) {
    rows.push({
      ...baseFromVersion(subagent.packageVersion, {
        id: `subagent:${subagent.id}`,
        dbId: subagent.id,
        createdAt: subagent.createdAt,
      }),
      targetPlatform: "",
      recordStage: "transformed",
      recordType: "subagent",
      itemName: subagent.name,
      logicalPath: subagent.slug,
      content: subagent.instructionsMd,
      metadata: {
        description: subagent.description,
        toolsJson: subagent.toolsJson,
        modelHint: subagent.modelHint,
        permissionMode: subagent.permissionMode,
        sortOrder: subagent.sortOrder,
        metadataJson: subagent.metadataJson,
      },
    });
  }

  for (const file of packageFiles) {
    rows.push({
      ...baseFromVersion(file.packageVersion, {
        id: `package-file:${file.id}`,
        dbId: file.id,
        createdAt: file.createdAt,
      }),
      targetPlatform: targetPlatformFromPath(file.kind, file.logicalPath),
      recordStage: fileStage(file.kind),
      recordType: file.kind,
      itemName: file.logicalPath,
      logicalPath: file.logicalPath,
      metadata: {
        storageKey: file.storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
        sourceFormat: file.sourceFormat,
      },
      resolveContent: async () => {
        if (!canReadTextFile(file)) {
          return `[Binary artifact not displayed: ${file.mimeType}, ${file.sizeBytes} bytes]`;
        }

        try {
          return await readArtifactText(file.storageKey);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Artifact read failed";
          return `[Artifact content unavailable: ${message}]`;
        }
      },
    });
  }

  for (const job of transformJobs) {
    rows.push({
      id: `transform-job:${job.id}`,
      dbId: job.id,
      createdAt: job.createdAt,
      userId: job.createdByUser.id,
      userEmail: job.createdByUser.email,
      userDisplayName: userDisplayName(job.createdByUser),
      organizationId: job.organization.id,
      organizationName: job.organization.name,
      organizationSlug: job.organization.slug,
      projectId: job.project?.id ?? null,
      projectName: job.project?.name ?? "",
      packageId: job.agentPackage?.id ?? null,
      packageName: job.agentPackage?.name ?? "",
      versionId: job.packageVersion?.id ?? null,
      versionNumber: job.packageVersion?.versionNumber ?? null,
      sourcePlatform: job.sourcePlatform ?? job.agentPackage?.sourcePlatform ?? "",
      targetPlatform: job.targetPlatform ?? "",
      recordStage: transformStage(job.jobType),
      recordType: `transform_job:${job.jobType}`,
      itemName: `${job.jobType} ${job.status}`,
      logicalPath: "",
      content: stringifyJson({
        inputJson: job.inputJson,
        resultJson: job.resultJson,
        errorJson: job.errorJson,
      }),
      metadata: {
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
    });
  }

  return rows.sort((left, right) => {
    const timeDiff = right.createdAt.getTime() - left.createdAt.getTime();
    return timeDiff || left.id.localeCompare(right.id);
  });
}

export async function getAdminAiContentData(params: {
  userId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const pendingRows = await buildPendingAdminAiContentRows(params.userId);
  const totalCount = pendingRows.length;
  const start = (page - 1) * pageSize;
  const rows = await resolveRows(pendingRows.slice(start, start + pageSize));

  return {
    rows,
    totalCount,
    page,
    pageSize,
    hasNextPage: start + pageSize < totalCount,
    hasPrevPage: page > 1,
  };
}

export async function getAdminAiContentExportRows(params: { userId?: string } = {}) {
  return resolveRows(await buildPendingAdminAiContentRows(params.userId));
}

export async function getAdminUsersExportRows() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      authProvider: true,
      authSubject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          displayName: true,
          jobTitle: true,
          timezone: true,
          locale: true,
        },
      },
      memberships: {
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              tier: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          createdProjects: true,
          createdPackages: true,
          createdVersions: true,
          transformJobs: true,
          deploymentJobs: true,
        },
      },
    },
  });
}
