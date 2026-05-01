import type { Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  type AssistedNormalization,
  normalizeAmbiguousFilesWithAi,
} from "@/lib/services/ai-normalization";
import { hasEntitlement } from "@/lib/services/entitlements";
import { readArtifactText } from "@/lib/storage/artifacts";
import { toSlug } from "@/lib/utils/slug";

export type CanonicalizationResult = {
  confidence: number;
  warnings: string[];
  summary: string;
  itemCount: number;
  agentCount: number;
  skillCount: number;
  completedAt: string;
};

export class CanonicalizationForbiddenError extends Error {
  constructor() {
    super("Canonicalization requires a paid plan.");
  }
}

export class CanonicalizationNoSourceFilesError extends Error {
  constructor() {
    super("No source files exist to canonicalize.");
  }
}

export class CanonicalizationNotConfiguredError extends Error {
  constructor() {
    super(`${env.AI_PROVIDER} canonicalization is not configured.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asInputJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function readResult(value: Prisma.JsonValue | null): CanonicalizationResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const confidence = typeof value.confidence === "number" ? value.confidence : null;
  const summary = typeof value.summary === "string" ? value.summary : null;
  const completedAt = typeof value.completedAt === "string" ? value.completedAt : null;

  if (confidence === null || summary === null) {
    return null;
  }

  return {
    confidence,
    summary,
    completedAt: completedAt ?? "",
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === "string")
      : [],
    itemCount: typeof value.itemCount === "number" ? value.itemCount : 0,
    agentCount: typeof value.agentCount === "number" ? value.agentCount : 0,
    skillCount: typeof value.skillCount === "number" ? value.skillCount : 0,
  };
}

function mergeTools(existing: unknown, next: string[]) {
  const current = Array.isArray(existing)
    ? existing.filter((item): item is string => typeof item === "string")
    : [];
  return Array.from(new Set([...current, ...next]));
}

function metadataWithCanonicalization(
  metadata: Prisma.JsonValue | null | undefined,
  completedAt: string,
  extra?: Record<string, unknown>,
) {
  return asInputJsonObject({
    ...(isRecord(metadata) ? metadata : {}),
    ...(extra ?? {}),
    canonicalized: true,
    canonicalizedAt: completedAt,
    canonicalizationProvider: env.AI_PROVIDER,
    canonicalizationModel: env.AI_PROVIDER === "kimi" ? env.KIMI_MODEL : env.OPENAI_MODEL,
  });
}

function uniqueSlug(name: string, fallback: string) {
  return toSlug(name) || fallback;
}

async function upsertCanonicalSkill(params: {
  versionId: string;
  name: string;
  kind: "skill" | "prompt_fragment";
  bodyMd: string;
  description?: string;
  completedAt: string;
}) {
  const existing = await prisma.skillRule.findFirst({
    where: {
      packageVersionId: params.versionId,
      name: params.name,
      kind: params.kind,
    },
  });

  const metadata = metadataWithCanonicalization(existing?.metadataJson, params.completedAt, {
    sourcePlatform: `${env.AI_PROVIDER}_canonicalization`,
    ...(params.description ? { description: params.description } : {}),
  });

  if (existing) {
    return prisma.skillRule.update({
      where: { id: existing.id },
      data: {
        bodyMd: params.bodyMd,
        metadataJson: metadata,
      },
    });
  }

  return prisma.skillRule.create({
    data: {
      packageVersionId: params.versionId,
      name: params.name,
      kind: params.kind,
      bodyMd: params.bodyMd,
      metadataJson: metadata,
    },
  });
}

async function upsertCanonicalSubagent(params: {
  versionId: string;
  slug: string;
  name: string;
  description: string;
  instructionsMd: string;
  tools: string[];
  modelHint?: string | null;
  permissionMode?: string | null;
  completedAt: string;
}) {
  const existing = await prisma.subagent.findUnique({
    where: {
      packageVersionId_slug: {
        packageVersionId: params.versionId,
        slug: params.slug,
      },
    },
  });

  const metadata = metadataWithCanonicalization(existing?.metadataJson, params.completedAt, {
    sourcePlatform: `${env.AI_PROVIDER}_canonicalization`,
  });

  if (existing) {
    return prisma.subagent.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        description: params.description,
        instructionsMd: params.instructionsMd,
        toolsJson: params.tools,
        modelHint: params.modelHint ?? existing.modelHint,
        permissionMode: params.permissionMode ?? existing.permissionMode,
        metadataJson: metadata,
      },
    });
  }

  const sortOrder =
    (await prisma.subagent.count({
      where: { packageVersionId: params.versionId },
    })) + 1;

  return prisma.subagent.create({
    data: {
      packageVersionId: params.versionId,
      name: params.name,
      slug: params.slug,
      description: params.description,
      instructionsMd: params.instructionsMd,
      toolsJson: params.tools,
      modelHint: params.modelHint ?? null,
      permissionMode: params.permissionMode ?? null,
      metadataJson: metadata,
      sortOrder,
    },
  });
}

async function markImportedRecordsCanonicalized(versionId: string, completedAt: string) {
  const [subagents, skillRules] = await Promise.all([
    prisma.subagent.findMany({
      where: { packageVersionId: versionId },
      select: { id: true, metadataJson: true },
    }),
    prisma.skillRule.findMany({
      where: { packageVersionId: versionId },
      select: { id: true, metadataJson: true },
    }),
  ]);

  await Promise.all([
    ...subagents.map((subagent) =>
      prisma.subagent.update({
        where: { id: subagent.id },
        data: {
          metadataJson: metadataWithCanonicalization(subagent.metadataJson, completedAt),
        },
      }),
    ),
    ...skillRules.map((rule) =>
      prisma.skillRule.update({
        where: { id: rule.id },
        data: {
          metadataJson: metadataWithCanonicalization(rule.metadataJson, completedAt),
        },
      }),
    ),
  ]);
}

async function applyCanonicalization(params: {
  versionId: string;
  normalized: AssistedNormalization;
  completedAt: string;
}) {
  const version = await prisma.packageVersion.findUniqueOrThrow({
    where: { id: params.versionId },
    include: {
      subagents: true,
      skillRules: true,
    },
  });
  const agentDefinition = isRecord(version.agentDefinitionJson) ? { ...version.agentDefinitionJson } : {};
  const validationJson = isRecord(version.validationJson) ? { ...version.validationJson } : {};
  const existingWarnings = Array.isArray(validationJson.warnings)
    ? validationJson.warnings.filter((item): item is string => typeof item === "string")
    : [];

  if (params.normalized.instructions.trim()) {
    const existingInstructions =
      typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";
    agentDefinition.instructions = existingInstructions
      ? `${existingInstructions}\n\n## Canonicalized with ${env.AI_PROVIDER}\n${params.normalized.instructions.trim()}`
      : params.normalized.instructions.trim();
  }

  agentDefinition.tools = mergeTools(agentDefinition.tools, params.normalized.tools);
  agentDefinition.canonicalSummary = params.normalized.summary;

  for (const [index, subagent] of params.normalized.subagents.entries()) {
    await upsertCanonicalSubagent({
      versionId: params.versionId,
      slug: uniqueSlug(subagent.name, `canonical-subagent-${index + 1}`),
      name: subagent.name,
      description: subagent.description,
      instructionsMd: subagent.instructions,
      tools: subagent.tools,
      modelHint: subagent.modelHint,
      permissionMode: subagent.permissionMode,
      completedAt: params.completedAt,
    });
  }

  for (const [index, skill] of params.normalized.skills.entries()) {
    await upsertCanonicalSkill({
      versionId: params.versionId,
      name: skill.name.trim() || `Canonical skill ${index + 1}`,
      kind: "skill",
      bodyMd: skill.body,
      description: skill.description,
      completedAt: params.completedAt,
    });
  }

  for (const [index, fragment] of params.normalized.promptFragments.entries()) {
    await upsertCanonicalSkill({
      versionId: params.versionId,
      name: fragment.name.trim() || `Canonical prompt ${index + 1}`,
      kind: "prompt_fragment",
      bodyMd: fragment.body,
      completedAt: params.completedAt,
    });
  }

  await markImportedRecordsCanonicalized(params.versionId, params.completedAt);

  const [agentCount, skillCount] = await Promise.all([
    prisma.subagent.count({ where: { packageVersionId: params.versionId } }),
    prisma.skillRule.count({ where: { packageVersionId: params.versionId } }),
  ]);
  const result: CanonicalizationResult = {
    confidence: params.normalized.confidence,
    warnings: params.normalized.warnings,
    summary: params.normalized.summary,
    itemCount: agentCount + skillCount,
    agentCount,
    skillCount,
    completedAt: params.completedAt,
  };

  await prisma.packageVersion.update({
    where: { id: params.versionId },
    data: {
      agentDefinitionJson: asInputJsonObject(agentDefinition),
      validationJson: asInputJsonObject({
        ...validationJson,
        warnings: Array.from(new Set([...existingWarnings, ...params.normalized.warnings])),
        canonicalization: result,
      }),
    },
  });

  return result;
}

export async function getLatestCanonicalizationJob(versionId: string) {
  return prisma.transformJob.findFirst({
    where: {
      packageVersionId: versionId,
      jobType: "canonicalize",
      status: {
        in: ["succeeded", "failed"],
      },
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCanonicalizationResult(versionId: string) {
  const job = await getLatestCanonicalizationJob(versionId);
  return {
    job,
    result: readResult(job?.resultJson ?? null),
  };
}

export async function canonicalizeVersion(params: {
  versionId: string;
  createdByUserId: string;
  force?: boolean;
}) {
  const version = await prisma.packageVersion.findUniqueOrThrow({
    where: { id: params.versionId },
    include: {
      files: true,
      agentPackage: {
        include: {
          project: true,
        },
      },
    },
  });
  const organizationId = version.agentPackage.project.organizationId;

  if (!(await hasEntitlement(organizationId, "manual_export"))) {
    throw new CanonicalizationForbiddenError();
  }

  const existing = await prisma.transformJob.findFirst({
    where: {
      packageVersionId: params.versionId,
      jobType: "canonicalize",
      status: "succeeded",
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
  });
  const existingResult = readResult(existing?.resultJson ?? null);

  if (!params.force && existing && existingResult) {
    return {
      alreadyDone: true,
      job: existing,
      result: existingResult,
    };
  }

  const rawFiles = version.files.filter((file) => file.kind === "raw_source");

  if (rawFiles.length === 0) {
    throw new CanonicalizationNoSourceFilesError();
  }

  const startedAt = new Date();
  const job = await prisma.transformJob.create({
    data: {
      organizationId,
      projectId: version.agentPackage.projectId,
      agentPackageId: version.agentPackage.id,
      packageVersionId: version.id,
      jobType: "canonicalize",
      status: "running",
      sourcePlatform: version.agentPackage.sourcePlatform,
      inputJson: {
        versionId: version.id,
        fileCount: rawFiles.length,
        aiProvider: env.AI_PROVIDER,
      },
      startedAt,
      createdByUserId: params.createdByUserId,
    },
  });

  try {
    const files = await Promise.all(
      rawFiles.map(async (file) => ({
        logicalPath: file.logicalPath,
        content: await readArtifactText(file.storageKey),
      })),
    );
    const normalized = await normalizeAmbiguousFilesWithAi({ files });

    if (!normalized) {
      throw new CanonicalizationNotConfiguredError();
    }

    const completedAt = new Date().toISOString();
    const result = await applyCanonicalization({
      versionId: version.id,
      normalized,
      completedAt,
    });
    const completedJob = await prisma.transformJob.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        resultJson: asInputJsonObject(result),
        finishedAt: new Date(completedAt),
      },
    });

    return {
      alreadyDone: false,
      job: completedJob,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canonicalization failed.";

    await prisma.transformJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorJson: { message },
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
