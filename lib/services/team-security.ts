import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type Finding = {
  id?: string;
  category?: string;
  severity?: string;
  title?: string;
  path?: string;
};

type WatchSeverity = "critical" | "high" | "medium" | "low" | "info";

function asFindingArray(value: unknown): Finding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Finding => Boolean(item) && typeof item === "object");
}

function findingKey(finding: Finding) {
  return [
    finding.id,
    finding.category,
    finding.title,
    finding.path,
  ].filter(Boolean).join("|");
}

function normalizedCategory(finding: Finding) {
  return String(finding.category ?? "").replace(/_/g, "-").toLowerCase();
}

function findingPathKey(finding: Finding) {
  return [
    finding.path,
    finding.id,
    finding.title,
  ].filter(Boolean).join("|");
}

function severityWeight(value: string | undefined) {
  switch (value) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizePolicyValue(value: string) {
  return value.trim().toLowerCase();
}

function structuredInventoryValues(value: unknown, keys: string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    return keys
      .map((key) => record[key])
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      .map(normalizePolicyValue);
  });
}

function structuredInventoryEntities(value: unknown, identityKeys: string[], labelKeys: string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const identity = identityKeys
      .map((key) => record[key])
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      .map(normalizePolicyValue)
      .join("|");

    if (!identity) {
      return [];
    }

    const label = labelKeys
      .map((key) => record[key])
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

    return [{
      identity,
      label: normalizePolicyValue(label ?? identity),
    }];
  });
}

function structuredWorkspacePaths(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const groups = [
    record.deploymentFiles,
    record.iacFiles,
    record.ciWorkflowFiles,
    record.credentialLikeFiles,
    record.riskyPackageScripts,
  ];

  return groups.flatMap((group) => {
    if (!Array.isArray(group)) {
      return [];
    }

    return group.flatMap((item) => {
      if (typeof item === "string") {
        return [item];
      }

      if (!item || typeof item !== "object") {
        return [];
      }

      const recordItem = item as Record<string, unknown>;
      const value = recordItem.path ?? recordItem.name;
      return typeof value === "string" && value.trim() ? [value.trim()] : [];
    });
  });
}

function diffStrings(current: string[], baseline: string[]) {
  const baselineSet = new Set(baseline.map(normalizePolicyValue));
  return current
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !baselineSet.has(normalizePolicyValue(item)));
}

function diffStructuredEntities(
  current: unknown,
  baseline: unknown,
  identityKeys: string[],
  labelKeys: string[],
) {
  const baselineIdentities = new Set(
    structuredInventoryEntities(baseline, identityKeys, labelKeys).map((item) => item.identity),
  );
  const seenLabels = new Set<string>();

  return structuredInventoryEntities(current, identityKeys, labelKeys)
    .filter((item) => !baselineIdentities.has(item.identity))
    .map((item) => item.label)
    .filter((label) => {
      if (seenLabels.has(label)) {
        return false;
      }

      seenLabels.add(label);
      return true;
    });
}

function diffFindingCategory(currentFindings: Finding[], baselineFindings: Finding[], category: string) {
  const baselineKeys = new Set(
    baselineFindings
      .filter((finding) => normalizedCategory(finding) === category)
      .map(findingPathKey),
  );

  return currentFindings
    .filter((finding) => normalizedCategory(finding) === category)
    .filter((finding) => !baselineKeys.has(findingPathKey(finding)));
}

function buildScanDiff(currentScan: {
  score: number;
  findingsJson: unknown;
  mcpServersJson?: unknown;
  extensionsJson?: unknown;
  workspaceSurfaceJson?: unknown;
}, baselineScan: {
  score: number;
  findingsJson: unknown;
  mcpServersJson?: unknown;
  extensionsJson?: unknown;
  workspaceSurfaceJson?: unknown;
}) {
  const baselineFindings = asFindingArray(baselineScan.findingsJson);
  const currentFindings = asFindingArray(currentScan.findingsJson);
  const baselineByKey = new Map(baselineFindings.map((finding) => [findingKey(finding), finding]));
  const currentByKey = new Map(currentFindings.map((finding) => [findingKey(finding), finding]));
  const newRisks = currentFindings.filter((finding) => !baselineByKey.has(findingKey(finding)));
  const resolvedRisks = baselineFindings.filter((finding) => !currentByKey.has(findingKey(finding)));
  const worsenedRisks = currentFindings.filter((finding) => {
    const baselineFinding = baselineByKey.get(findingKey(finding));
    return baselineFinding && severityWeight(finding.severity) > severityWeight(baselineFinding.severity);
  });

  return {
    newRisks,
    resolvedRisks,
    worsenedRisks,
    newMcpTools: diffStructuredEntities(
      currentScan.mcpServersJson,
      baselineScan.mcpServersJson,
      ["name", "command", "configPath"],
      ["name", "command", "configPath"],
    ),
    newExtensions: diffStructuredEntities(
      currentScan.extensionsJson,
      baselineScan.extensionsJson,
      ["id", "displayName", "publisher"],
      ["id", "displayName", "publisher"],
    ),
    newSecrets: diffFindingCategory(currentFindings, baselineFindings, "secret-hygiene"),
    newDeploymentSurfaces: diffStrings(
      structuredWorkspacePaths(currentScan.workspaceSurfaceJson),
      structuredWorkspacePaths(baselineScan.workspaceSurfaceJson),
    ),
    newSuspiciousArtifacts: diffFindingCategory(currentFindings, baselineFindings, "suspicious-artifact"),
    currentScore: currentScan.score,
    baselineScore: baselineScan.score,
    scoreDelta: currentScan.score - baselineScan.score,
  };
}

function maxSeverity(findings: Finding[]): WatchSeverity {
  const ordered: WatchSeverity[] = ["critical", "high", "medium", "low", "info"];
  return ordered.find((severity) => findings.some((finding) => finding.severity === severity)) ?? "info";
}

async function createWatchEventOnce(input: {
  organizationId: string;
  actorUserId?: string | null;
  guardScanId?: string | null;
  workspaceHash?: string | null;
  eventType: "scheduled_scan" | "extension_check_in" | "baseline_drift" | "policy_violation";
  severity: WatchSeverity;
  logicalPath: string;
  metadata: Record<string, unknown>;
}) {
  if (input.guardScanId) {
    const existing = await prisma.guardWatchEvent.findFirst({
      where: {
        organizationId: input.organizationId,
        guardScanId: input.guardScanId,
        eventType: input.eventType,
        logicalPath: input.logicalPath,
      },
      select: { id: true },
    });

    if (existing) {
      return null;
    }
  }

  return prisma.guardWatchEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? undefined,
      guardScanId: input.guardScanId ?? undefined,
      workspaceHash: input.workspaceHash ?? undefined,
      eventType: input.eventType,
      severity: input.severity,
      logicalPath: input.logicalPath,
      metadataJson: asJson(input.metadata),
    },
    select: {
      id: true,
      eventType: true,
      severity: true,
      logicalPath: true,
      guardScanId: true,
      createdAt: true,
    },
  });
}

export async function markGuardScanAsBaseline(input: {
  organizationId: string;
  actorUserId: string;
  guardScanId: string;
}) {
  const scan = await prisma.guardScan.findFirst({
    where: {
      id: input.guardScanId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      workspaceHash: true,
      score: true,
      rank: true,
      findingsJson: true,
      summaryJson: true,
    },
  });

  if (!scan) {
    throw new Error("Guard scan not found");
  }

  return prisma.guardBaseline.upsert({
    where: {
      organizationId_workspaceHash: {
        organizationId: input.organizationId,
        workspaceHash: scan.workspaceHash ?? "default",
      },
    },
    update: {
      guardScanId: scan.id,
      createdByUserId: input.actorUserId,
      metadataJson: asJson({
        score: scan.score,
        rank: scan.rank,
        summary: scan.summaryJson,
      }),
    },
    create: {
      organizationId: input.organizationId,
      workspaceHash: scan.workspaceHash ?? "default",
      guardScanId: scan.id,
      createdByUserId: input.actorUserId,
      metadataJson: asJson({
        score: scan.score,
        rank: scan.rank,
        summary: scan.summaryJson,
      }),
    },
  });
}

export async function compareScanToBaseline(input: {
  organizationId: string;
  guardScanId: string;
}) {
  const currentScan = await prisma.guardScan.findFirst({
    where: {
      id: input.guardScanId,
      organizationId: input.organizationId,
    },
  });

  if (!currentScan) {
    throw new Error("Guard scan not found");
  }

  const baseline = await prisma.guardBaseline.findFirst({
    where: {
      organizationId: input.organizationId,
      workspaceHash: currentScan.workspaceHash ?? "default",
    },
    include: {
      guardScan: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!baseline) {
    return {
      baseline: null,
      diff: null,
    };
  }

  return {
    baseline: {
      id: baseline.id,
      guardScanId: baseline.guardScanId,
      createdAt: baseline.createdAt,
      score: baseline.guardScan.score,
      rank: baseline.guardScan.rank,
    },
    diff: buildScanDiff(currentScan, baseline.guardScan),
  };
}

export async function compareScanToPreviousPersonalScan(input: {
  organizationId: string;
  actorUserId: string;
  guardScanId: string;
}) {
  const currentScan = await prisma.guardScan.findFirst({
    where: {
      id: input.guardScanId,
      organizationId: input.organizationId,
    },
  });

  if (!currentScan) {
    throw new Error("Guard scan not found");
  }

  if (currentScan.actorUserId !== input.actorUserId) {
    return {
      previousScan: null,
      diff: null,
    };
  }

  const previousScan = await prisma.guardScan.findFirst({
    where: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      workspaceHash: currentScan.workspaceHash,
      createdAt: { lt: currentScan.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!previousScan) {
    return {
      previousScan: null,
      diff: null,
    };
  }

  return {
    previousScan: {
      id: previousScan.id,
      createdAt: previousScan.createdAt,
      score: previousScan.score,
      rank: previousScan.rank,
    },
    diff: buildScanDiff(currentScan, previousScan),
  };
}

export async function getOrCreateTeamPolicy(organizationId: string) {
  return prisma.teamPolicy.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      mcpAllowlistJson: [],
      mcpDenylistJson: [],
      extensionAllowlistJson: [],
      extensionDenylistJson: [],
      uploadPolicyJson: {
        allowedCategories: ["redacted_findings", "dependency_metadata", "mcp_metadata", "extension_metadata"],
      },
      redactionPolicyJson: {
        blockRawSecrets: true,
        blockEnvValues: true,
        blockPrivateKeys: true,
      },
      baselineComparisonJson: {
        compareFindings: true,
        compareMcpTools: true,
        compareExtensions: true,
        compareDeploySurface: true,
      },
    },
  });
}

export async function updateTeamPolicy(input: {
  organizationId: string;
  mcpAllowlist: string[];
  mcpDenylist: string[];
  extensionAllowlist: string[];
  extensionDenylist: string[];
  retentionDays: number;
}) {
  return prisma.teamPolicy.upsert({
    where: { organizationId: input.organizationId },
    update: {
      mcpAllowlistJson: input.mcpAllowlist,
      mcpDenylistJson: input.mcpDenylist,
      extensionAllowlistJson: input.extensionAllowlist,
      extensionDenylistJson: input.extensionDenylist,
      retentionDays: input.retentionDays,
    },
    create: {
      organizationId: input.organizationId,
      mcpAllowlistJson: input.mcpAllowlist,
      mcpDenylistJson: input.mcpDenylist,
      extensionAllowlistJson: input.extensionAllowlist,
      extensionDenylistJson: input.extensionDenylist,
      retentionDays: input.retentionDays,
    },
  });
}

export async function evaluateContinuousWatch(input: {
  organizationId: string;
  actorUserId?: string | null;
  guardScanId?: string;
  workspaceHash?: string;
  limit?: number;
}) {
  const policy = await getOrCreateTeamPolicy(input.organizationId);
  const mcpDenylist = asStringArray(policy.mcpDenylistJson).map(normalizePolicyValue);
  const extensionDenylist = asStringArray(policy.extensionDenylistJson).map(normalizePolicyValue);
  const scans = input.guardScanId
    ? await prisma.guardScan.findMany({
        where: { id: input.guardScanId, organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
        take: 1,
      })
    : await prisma.guardScan.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.workspaceHash ? { workspaceHash: input.workspaceHash } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit ?? 25,
      });

  const createdEvents = [];

  for (const scan of scans) {
    const comparison = await compareScanToBaseline({
      organizationId: input.organizationId,
      guardScanId: scan.id,
    });

    if (comparison.diff) {
      const driftFindings = [
        ...comparison.diff.newRisks,
        ...comparison.diff.worsenedRisks,
      ];
      const structuredDriftCount =
        comparison.diff.newMcpTools.length +
        comparison.diff.newExtensions.length +
        comparison.diff.newSecrets.length +
        comparison.diff.newDeploymentSurfaces.length +
        comparison.diff.newSuspiciousArtifacts.length;

      if (driftFindings.length > 0 || structuredDriftCount > 0) {
        const event = await createWatchEventOnce({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          guardScanId: scan.id,
          workspaceHash: scan.workspaceHash ?? "default",
          eventType: "baseline_drift",
          severity: maxSeverity(driftFindings),
          logicalPath: scan.workspaceHash ?? "workspace",
          metadata: {
            baselineId: comparison.baseline?.id,
            baselineScanId: comparison.baseline?.guardScanId,
            newRiskCount: comparison.diff.newRisks.length,
            resolvedRiskCount: comparison.diff.resolvedRisks.length,
            worsenedRiskCount: comparison.diff.worsenedRisks.length,
            newMcpToolCount: comparison.diff.newMcpTools.length,
            newExtensionCount: comparison.diff.newExtensions.length,
            newSecretCount: comparison.diff.newSecrets.length,
            newDeploymentSurfaceCount: comparison.diff.newDeploymentSurfaces.length,
            newSuspiciousArtifactCount: comparison.diff.newSuspiciousArtifacts.length,
            scoreDelta: comparison.diff.scoreDelta,
          },
        });

        if (event) {
          createdEvents.push(event);
        }
      }
    }

    const mcpInventory = new Set(structuredInventoryValues(scan.mcpServersJson, ["name", "command", "configPath"]));
    const extensionInventory = new Set(structuredInventoryValues(scan.extensionsJson, ["id", "displayName", "publisher"]));
    const deniedMcp = mcpDenylist.filter((item) => item && mcpInventory.has(item));
    const deniedExtensions = extensionDenylist.filter((item) => item && extensionInventory.has(item));

    if (deniedMcp.length > 0 || deniedExtensions.length > 0) {
      const event = await createWatchEventOnce({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        guardScanId: scan.id,
        workspaceHash: scan.workspaceHash ?? "default",
        eventType: "policy_violation",
        severity: "high",
        logicalPath: [...deniedMcp, ...deniedExtensions].join(", "),
        metadata: {
          deniedMcp,
          deniedExtensions,
          policyId: policy.id,
        },
      });

      if (event) {
        createdEvents.push(event);
      }
    }
  }

  if (createdEvents.length === 0) {
    const event = await createWatchEventOnce({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      workspaceHash: input.workspaceHash ?? "default",
      eventType: "scheduled_scan",
      severity: "info",
      logicalPath: input.workspaceHash ?? "workspace",
      metadata: {
        evaluatedScanCount: scans.length,
        result: scans.length > 0 ? "no_new_drift_or_policy_violation" : "no_saved_scans",
      },
    });

    if (event) {
      createdEvents.push(event);
    }
  }

  return {
    evaluatedScanCount: scans.length,
    eventsCreated: createdEvents.length,
    events: createdEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
