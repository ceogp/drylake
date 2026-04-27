import type { PackageFile, PackageVersion, Prisma } from "@prisma/client";
import yaml from "js-yaml";
import path from "node:path";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { normalizeAmbiguousFilesWithAi } from "@/lib/services/ai-normalization";
import { notifyOrganizationIntegrations } from "@/lib/services/integrations";
import { readArtifactText, saveArtifactText } from "@/lib/storage/artifacts";
import { normalizeImportLogicalPath } from "@/lib/utils/import-paths";
import { toSlug } from "@/lib/utils/slug";

type SupportedTarget = "codex" | "claude_code" | "claude_agents" | "cursor";

type VersionWithRelations = PackageVersion & {
  files: PackageFile[];
  subagents: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    instructionsMd: string;
    toolsJson: Prisma.JsonValue | null;
    modelHint: string | null;
    permissionMode: string | null;
    metadataJson: Prisma.JsonValue | null;
    sortOrder: number;
  }>;
  skillRules: Array<{
    id: string;
    name: string;
    kind: string;
    bodyMd: string;
    metadataJson: Prisma.JsonValue | null;
  }>;
  agentPackage: {
    id: string;
    name: string;
    slug: string;
    sourcePlatform: string;
    defaultTargetPlatform: string | null;
    projectId: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function parseToolList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const tokens = trimmed.match(/[A-Za-z]+\([^)]*\)|[^\s]+/g);
  return tokens?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function asInputJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function parseFrontmatterMarkdown(content: string) {
  if (!content.startsWith("---")) {
    return {
      data: {} as Record<string, unknown>,
      body: content.trim(),
      rawFrontmatter: null as string | null,
    };
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return {
      data: {} as Record<string, unknown>,
      body: content.trim(),
      rawFrontmatter: null as string | null,
    };
  }

  const [, rawFrontmatter, body] = match;
  try {
    const parsed = yaml.load(rawFrontmatter);

    return {
      data: isRecord(parsed) ? parsed : {},
      body: body.trim(),
      rawFrontmatter,
    };
  } catch {
    return {
      data: {},
      body: body.trim(),
      rawFrontmatter,
    };
  }
}

function stringifyFrontmatterMarkdown(frontmatter: Record<string, unknown>, body: string) {
  const normalized = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined && value !== null),
  );

  const rawFrontmatter = yaml
    .dump(normalized, {
      lineWidth: 120,
      noCompatMode: true,
      quotingType: '"',
    })
    .trim();

  return ["---", rawFrontmatter, "---", body.trim()].join("\n");
}

function getMetadataObject(value: Prisma.JsonValue | null) {
  return isRecord(value) ? value : {};
}

function getStoredFrontmatter(value: Prisma.JsonValue | null) {
  const metadata = getMetadataObject(value);
  return readRecord(metadata.frontmatter) ?? {};
}

function stringifySkillMarkdown(skill: VersionWithRelations["skillRules"][number]) {
  const metadata = getMetadataObject(skill.metadataJson);
  const storedFrontmatter = getStoredFrontmatter(skill.metadataJson);

  return stringifyFrontmatterMarkdown(
    {
      ...storedFrontmatter,
      name: toSlug(readString(storedFrontmatter.name) ?? skill.name),
      description:
        readString(storedFrontmatter.description) ??
        readString(metadata.description) ??
        `${skill.name} reusable workflow`,
    },
    skill.bodyMd,
  );
}

function parseTomlStringArray(value: string) {
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^"(.*)"$/, "$1"));
}

function parseCodexAgentToml(content: string) {
  const developerInstructionsMatch = content.match(
    /developer_instructions\s*=\s*"""([\s\S]*?)"""/,
  );
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  const descriptionMatch = content.match(/^description\s*=\s*"([^"]*)"/m);
  const toolsMatch = content.match(/^tools\s*=\s*(\[[^\n]*\])/m);
  const modelMatch = content.match(/^model\s*=\s*"([^"]+)"/m);
  const reasoningMatch = content.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m);
  const sandboxMatch = content.match(/^sandbox_mode\s*=\s*"([^"]+)"/m);

  const metadata: Record<string, unknown> = {};

  if (modelMatch) {
    metadata.model = modelMatch[1];
  }

  if (reasoningMatch) {
    metadata.modelReasoningEffort = reasoningMatch[1];
  }

  if (sandboxMatch) {
    metadata.sandboxMode = sandboxMatch[1];
  }

  return {
    name: nameMatch?.[1] ?? "",
    description: descriptionMatch?.[1] ?? "Imported Codex custom agent",
    developerInstructions: developerInstructionsMatch?.[1]?.trim() ?? "",
    tools: toolsMatch ? parseTomlStringArray(toolsMatch[1]) : [],
    modelHint: modelMatch?.[1] ?? null,
    permissionMode: sandboxMatch?.[1] ?? null,
    metadata,
  };
}

function stringifyCodexCustomAgent(subagent: VersionWithRelations["subagents"][number]) {
  const tools = Array.isArray(subagent.toolsJson)
    ? `[${(subagent.toolsJson as string[]).map((tool) => `"${tool}"`).join(", ")}]`
    : "[]";
  const developerInstructions = subagent.instructionsMd.replace(/"""/g, '\\"\\"\\"');
  const metadata =
    subagent.metadataJson && typeof subagent.metadataJson === "object"
      ? (subagent.metadataJson as Record<string, unknown>)
      : {};
  const model = typeof metadata.model === "string" ? metadata.model : subagent.modelHint;
  const modelReasoningEffort =
    typeof metadata.modelReasoningEffort === "string" ? metadata.modelReasoningEffort : null;
  const sandboxMode =
    typeof metadata.sandboxMode === "string" ? metadata.sandboxMode : subagent.permissionMode;

  return [
    `name = "${subagent.slug}"`,
    `description = "${subagent.description.replace(/"/g, '\\"')}"`,
    `developer_instructions = """${developerInstructions}"""`,
    `tools = ${tools}`,
    model ? `model = "${model}"` : "",
    modelReasoningEffort ? `model_reasoning_effort = "${modelReasoningEffort}"` : "",
    sandboxMode ? `sandbox_mode = "${sandboxMode}"` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getSkillPlatformAndName(logicalPath: string) {
  const normalized = logicalPath.replace(/\\/g, "/");
  const match = normalized.match(
    /^(\.agents\/skills|\.cursor\/skills|\.claude\/skills|\.codex\/skills)\/(?:.+\/)?([^/]+)\/SKILL\.md$/i,
  );

  if (!match) {
    return null;
  }

  const base = match[1].toLowerCase();
  const platform =
    base === ".claude/skills"
      ? "claude"
      : base === ".cursor/skills"
        ? "cursor"
        : base === ".codex/skills" || base === ".agents/skills"
          ? "codex"
          : "generic";

  return {
    platform,
    slug: toSlug(match[2]),
  };
}

async function upsertSkillRule(params: {
  versionId: string;
  name: string;
  kind: string;
  bodyMd: string;
  metadata?: Record<string, unknown>;
}) {
  const existingRule = await prisma.skillRule.findFirst({
    where: {
      packageVersionId: params.versionId,
      name: params.name,
      kind: params.kind,
    },
  });

  if (existingRule) {
    return prisma.skillRule.update({
      where: { id: existingRule.id },
      data: {
        bodyMd: params.bodyMd,
        ...(params.metadata ? { metadataJson: asInputJsonObject(params.metadata) } : {}),
      },
    });
  }

  return prisma.skillRule.create({
    data: {
      packageVersionId: params.versionId,
      name: params.name,
      kind: params.kind,
      bodyMd: params.bodyMd,
      metadataJson: params.metadata ? asInputJsonObject(params.metadata) : undefined,
    },
  });
}

async function upsertSubagent(params: {
  versionId: string;
  slug: string;
  name: string;
  description: string;
  instructionsMd: string;
  tools: string[];
  modelHint?: string | null;
  permissionMode?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.subagent.findUnique({
    where: {
      packageVersionId_slug: {
        packageVersionId: params.versionId,
        slug: params.slug,
      },
    },
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
        ...(params.metadata ? { metadataJson: asInputJsonObject(params.metadata) } : {}),
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
      metadataJson: params.metadata ? asInputJsonObject(params.metadata) : undefined,
      sortOrder,
    },
  });
}

function stringifyClaudeSubagent(subagent: VersionWithRelations["subagents"][number]) {
  const storedFrontmatter = getStoredFrontmatter(subagent.metadataJson);

  return stringifyFrontmatterMarkdown(
    {
      ...storedFrontmatter,
      name: toSlug(readString(storedFrontmatter.name) ?? subagent.slug),
      description: readString(storedFrontmatter.description) ?? subagent.description,
      tools:
        storedFrontmatter.tools ??
        (Array.isArray(subagent.toolsJson) ? (subagent.toolsJson as string[]) : undefined),
      model: readString(storedFrontmatter.model) ?? subagent.modelHint ?? undefined,
      permissionMode:
        readString(storedFrontmatter.permissionMode) ?? subagent.permissionMode ?? undefined,
    },
    subagent.instructionsMd,
  );
}

function stringifyCursorGeneratedRule(params: {
  description: string;
  bodyMd: string;
  metadata?: Record<string, unknown>;
}) {
  return stringifyFrontmatterMarkdown(
    {
      ...(params.metadata ?? {}),
      description: readString(params.metadata?.description) ?? params.description,
    },
    params.bodyMd,
  );
}

function stringifyCursorCoreRule(version: VersionWithRelations) {
  const agentDefinition = version.agentDefinitionJson as Record<string, unknown>;
  const description =
    typeof agentDefinition.description === "string"
      ? agentDefinition.description
      : "Xupra DryLake generated project rule";
  const instructions =
    typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";
  const promptFragments = version.skillRules
    .filter((rule) => rule.kind === "prompt_fragment")
    .map((rule) => `## ${rule.name}\n${rule.bodyMd.trim()}`)
    .join("\n\n");

  const body = [instructions, promptFragments].filter(Boolean).join("\n\n");

  if (!body) {
    return null;
  }

  return stringifyCursorGeneratedRule({
    description,
    bodyMd: body,
    metadata: {
      description,
      alwaysApply: true,
    },
  });
}

function stringifyCursorSubagentRule(version: VersionWithRelations) {
  if (version.subagents.length === 0) {
    return null;
  }

  const bodyMd = version.subagents
    .map((subagent) => {
      const toolList = Array.isArray(subagent.toolsJson)
        ? (subagent.toolsJson as string[]).join(", ")
        : "";

      return [
        `## ${subagent.name}`,
        subagent.description,
        toolList ? `Tools: ${toolList}` : "",
        subagent.modelHint ? `Model: ${subagent.modelHint}` : "",
        subagent.permissionMode ? `Permission mode: ${subagent.permissionMode}` : "",
        subagent.instructionsMd.trim(),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return stringifyCursorGeneratedRule({
    description: "Generated subagent guidance from Xupra canonical subagents.",
    bodyMd,
  });
}

function stringifyCursorRuleDocument(rule: VersionWithRelations["skillRules"][number]) {
  const metadata = getMetadataObject(rule.metadataJson);
  const storedFrontmatter = getStoredFrontmatter(rule.metadataJson);

  return stringifyFrontmatterMarkdown(
    {
      ...storedFrontmatter,
      description:
        readString(storedFrontmatter.description) ??
        readString(metadata.description) ??
        `${rule.name} project rule`,
    },
    rule.bodyMd,
  );
}

function getCursorRuleFilename(rule: VersionWithRelations["skillRules"][number]) {
  const sourcePath = readString(getMetadataObject(rule.metadataJson).sourcePath);

  if (sourcePath?.startsWith(".cursor/rules/")) {
    return path.posix.basename(sourcePath);
  }

  return `${toSlug(rule.name)}.mdc`;
}

function stringifyCodexAgentsMd(version: VersionWithRelations) {
  const agentDefinition = version.agentDefinitionJson as Record<string, unknown>;
  const description =
    typeof agentDefinition.description === "string"
      ? agentDefinition.description
      : version.agentPackage.name;
  const instructions =
    typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";
  const rules = version.skillRules
    .map((rule) => `## ${rule.name}\n\n${rule.bodyMd.trim()}`)
    .join("\n\n");

  return [`# ${description}`, instructions, rules].filter(Boolean).join("\n\n");
}

function mergeToolLists(existing: unknown, next: string[]) {
  const current = Array.isArray(existing) ? existing.filter((item): item is string => typeof item === "string") : [];
  return Array.from(new Set([...current, ...next]));
}

async function getVersionForJobs(versionId: string) {
  const version = await prisma.packageVersion.findUnique({
    where: { id: versionId },
    include: {
      files: true,
      subagents: {
        orderBy: { sortOrder: "asc" },
      },
      skillRules: {
        orderBy: { createdAt: "asc" },
      },
      agentPackage: true,
    },
  });

  if (!version) {
    throw new Error("Package version not found");
  }

  return version as VersionWithRelations;
}

async function getOrganizationIdForProject(projectId: string) {
  return (
    await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { organizationId: true },
    })
  ).organizationId;
}

function compatibilityForTarget(version: VersionWithRelations, targetPlatform: SupportedTarget) {
  const agentDefinition = version.agentDefinitionJson as Record<string, unknown>;
  const instructions =
    typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";
  const hasInstructions = instructions.length > 0;
  const hasSubagents = version.subagents.length > 0;
  const hasRules = version.skillRules.length > 0;
  const hasSkills = version.skillRules.some((rule) => rule.kind === "skill");
  const rawNames = new Set(version.files.filter((file) => file.kind === "raw_source").map((file) => file.logicalPath));

  const warnings: string[] = [];
  const unsupported: string[] = [];

  switch (targetPlatform) {
    case "codex":
      if (!hasInstructions && !hasSkills && !rawNames.has("AGENTS.md")) {
        unsupported.push("Codex export needs instructions, skills, or an imported AGENTS.md file.");
      }
      if (hasSubagents) {
        warnings.push("Subagents will be exported as Codex custom agent TOML files and should be reviewed.");
      }
      break;
    case "claude_code":
      if (!hasInstructions && !hasSubagents && !hasSkills && !rawNames.has("CLAUDE.md")) {
        unsupported.push("Claude Code export needs instructions, skills, subagents, or an imported CLAUDE.md file.");
      }
      break;
    case "claude_agents":
      if (!hasInstructions && !hasSubagents && !hasSkills) {
        unsupported.push("Claude Agents export needs instructions, skills, or at least one subagent.");
      }
      if (hasRules) {
        warnings.push("Rules will be flattened into markdown guidance for SDK-oriented export.");
      }
      break;
    case "cursor":
      if (!hasInstructions && !hasRules && !hasSkills) {
        unsupported.push("Cursor export needs instructions, rules, or skills.");
      }
      if (hasSubagents) {
        warnings.push("Subagents will be flattened into Cursor rule content because Cursor is rule-centric.");
      }
      break;
  }

  const status = unsupported.length > 0 ? "unsupported" : warnings.length > 0 ? "warning" : "supported";

  return {
    targetPlatform,
    status,
    warnings,
    unsupported,
    checkedAt: new Date().toISOString(),
  };
}

export async function runCompatibilityCheck(params: {
  versionId: string;
  targetPlatform: SupportedTarget;
  createdByUserId: string;
  jobId?: string;
}) {
  const version = await getVersionForJobs(params.versionId);
  const organizationId = await getOrganizationIdForProject(version.agentPackage.projectId);
  const result = compatibilityForTarget(version, params.targetPlatform);

  const job = params.jobId
    ? await prisma.transformJob.update({
        where: { id: params.jobId },
        data: {
          status: "succeeded",
          sourcePlatform: version.agentPackage.sourcePlatform,
          targetPlatform: params.targetPlatform,
          inputJson: {
            versionId: version.id,
          },
          resultJson: result,
          finishedAt: new Date(),
        },
      })
    : await prisma.transformJob.create({
        data: {
          organizationId,
          projectId: version.agentPackage.projectId,
          agentPackageId: version.agentPackage.id,
          packageVersionId: version.id,
          jobType: "compatibility_check",
          status: "succeeded",
          sourcePlatform: version.agentPackage.sourcePlatform,
          targetPlatform: params.targetPlatform,
          inputJson: {
            versionId: version.id,
          },
          resultJson: result,
          finishedAt: new Date(),
          createdByUserId: params.createdByUserId,
        },
      });

  const existingCompatibility = (version.compatibilityJson as Record<string, unknown> | null) ?? {};

  await prisma.packageVersion.update({
    where: { id: version.id },
    data: {
      compatibilityJson: asInputJsonObject({
        ...existingCompatibility,
        [params.targetPlatform]: result,
      }),
    },
  });

  await notifyOrganizationIntegrations({
    organizationId,
    event: "compatibility_check",
    text: `${version.agentPackage.name} checked against ${params.targetPlatform} with status ${result.status}.`,
  });

  return { job, result };
}

export async function buildExportPreview(params: {
  versionId: string;
  targetPlatform: SupportedTarget;
  createdByUserId: string;
  jobId?: string;
}) {
  const version = await getVersionForJobs(params.versionId);
  const organizationId = await getOrganizationIdForProject(version.agentPackage.projectId);
  const compatibility = compatibilityForTarget(version, params.targetPlatform);

  if (compatibility.status === "unsupported") {
    const job = params.jobId
      ? await prisma.transformJob.update({
          where: { id: params.jobId },
          data: {
            status: "failed",
            sourcePlatform: version.agentPackage.sourcePlatform,
            targetPlatform: params.targetPlatform,
            errorJson: compatibility,
            finishedAt: new Date(),
          },
        })
      : await prisma.transformJob.create({
          data: {
            organizationId,
            projectId: version.agentPackage.projectId,
            agentPackageId: version.agentPackage.id,
            packageVersionId: version.id,
            jobType: "export_build",
            status: "failed",
            sourcePlatform: version.agentPackage.sourcePlatform,
            targetPlatform: params.targetPlatform,
            errorJson: compatibility,
            finishedAt: new Date(),
            createdByUserId: params.createdByUserId,
          },
        });

    await notifyOrganizationIntegrations({
      organizationId,
      event: "export_build",
      text: `${version.agentPackage.name} export for ${params.targetPlatform} failed compatibility.`,
    });

    return { job, generatedFiles: [], compatibility };
  }

  const generatedFiles: Array<{
    logicalPath: string;
    preview: string;
    storageKey: string;
  }> = [];
  const skills = version.skillRules.filter((rule) => rule.kind === "skill");

  const addGeneratedFile = async (logicalPath: string, preview: string) => {
    const artifact = await saveArtifactText({
      versionId: version.id,
      kind: "generated_export",
      logicalPath: path.posix.join(params.targetPlatform, logicalPath),
      text: preview,
    });

    await prisma.packageFile.upsert({
      where: {
        packageVersionId_kind_logicalPath: {
          packageVersionId: version.id,
          kind: "generated_export",
          logicalPath: path.posix.join(params.targetPlatform, logicalPath),
        },
      },
      update: {
        storageKey: artifact.storageKey,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        sourceFormat: path.extname(logicalPath).replace(".", "") || "text",
      },
      create: {
        packageVersionId: version.id,
        kind: "generated_export",
        logicalPath: path.posix.join(params.targetPlatform, logicalPath),
        storageKey: artifact.storageKey,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        sourceFormat: path.extname(logicalPath).replace(".", "") || "text",
      },
    });

    generatedFiles.push({
      logicalPath,
      preview,
      storageKey: artifact.storageKey,
    });
  };

  switch (params.targetPlatform) {
    case "codex":
      await addGeneratedFile("AGENTS.md", stringifyCodexAgentsMd(version));
      for (const skill of skills) {
        await addGeneratedFile(
          `.agents/skills/${toSlug(skill.name)}/SKILL.md`,
          stringifySkillMarkdown(skill),
        );
      }
      for (const subagent of version.subagents) {
        await addGeneratedFile(`.codex/agents/${subagent.slug}.toml`, stringifyCodexCustomAgent(subagent));
      }
      break;
    case "claude_code":
    case "claude_agents": {
      const agentDefinition = version.agentDefinitionJson as Record<string, unknown>;
      const rootInstructions =
        typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";

      if (rootInstructions) {
        await addGeneratedFile("CLAUDE.md", rootInstructions);
      }

      for (const skill of skills) {
        await addGeneratedFile(
          `.claude/skills/${toSlug(skill.name)}/SKILL.md`,
          stringifySkillMarkdown(skill),
        );
      }

      const subagents = version.subagents.length
        ? version.subagents
        : [
            {
              id: "generated-default",
              slug: "default-agent",
              name: "default-agent",
              description:
                typeof agentDefinition.description === "string"
                  ? agentDefinition.description
                  : version.agentPackage.name,
              instructionsMd: rootInstructions || "Provide focused guidance for this project.",
              toolsJson: agentDefinition.tools ?? [],
              modelHint: "inherit",
              permissionMode: null,
              metadataJson: null,
              sortOrder: 0,
            },
          ];

      for (const subagent of subagents) {
        await addGeneratedFile(`.claude/agents/${subagent.slug}.md`, stringifyClaudeSubagent(subagent));
      }
      break;
    }
    case "cursor":
      for (const rule of version.skillRules.filter((item) => item.kind === "rule")) {
        await addGeneratedFile(
          `.cursor/rules/${getCursorRuleFilename(rule)}`,
          stringifyCursorRuleDocument(rule),
        );
      }

      {
        const coreRule = stringifyCursorCoreRule(version);

        if (coreRule) {
          await addGeneratedFile(".cursor/rules/xupra-core.mdc", coreRule);
        }
      }

      {
        const subagentRule = stringifyCursorSubagentRule(version);

        if (subagentRule) {
          await addGeneratedFile(".cursor/rules/xupra-subagents.mdc", subagentRule);
        }
      }

      await addGeneratedFile("AGENTS.md", stringifyCodexAgentsMd(version));
      for (const skill of skills) {
        await addGeneratedFile(
          `.cursor/skills/${toSlug(skill.name)}/SKILL.md`,
          stringifySkillMarkdown(skill),
        );
      }
      break;
  }

  const job = params.jobId
    ? await prisma.transformJob.update({
        where: { id: params.jobId },
        data: {
          status: "succeeded",
          sourcePlatform: version.agentPackage.sourcePlatform,
          targetPlatform: params.targetPlatform,
          resultJson: {
            compatibility,
            generatedFiles: generatedFiles.map((file) => ({
              logicalPath: file.logicalPath,
              preview: file.preview,
              storageKey: file.storageKey,
            })),
          },
          finishedAt: new Date(),
        },
      })
    : await prisma.transformJob.create({
        data: {
          organizationId,
          projectId: version.agentPackage.projectId,
          agentPackageId: version.agentPackage.id,
          packageVersionId: version.id,
          jobType: "export_build",
          status: "succeeded",
          sourcePlatform: version.agentPackage.sourcePlatform,
          targetPlatform: params.targetPlatform,
          resultJson: {
            compatibility,
            generatedFiles: generatedFiles.map((file) => ({
              logicalPath: file.logicalPath,
              preview: file.preview,
              storageKey: file.storageKey,
            })),
          },
          finishedAt: new Date(),
          createdByUserId: params.createdByUserId,
        },
      });

  await notifyOrganizationIntegrations({
    organizationId,
    event: "export_build",
    text: `${version.agentPackage.name} built ${generatedFiles.length} export files for ${params.targetPlatform}.`,
  });

  return { job, compatibility, generatedFiles };
}

export async function runImportForVersion(params: {
  versionId: string;
  sourcePlatform?: string;
  createdByUserId: string;
  jobId?: string;
}) {
  const version = await getVersionForJobs(params.versionId);
  const organizationId = await getOrganizationIdForProject(version.agentPackage.projectId);
  const rawFiles = version.files.filter((file) => file.kind === "raw_source");
  const manifest = { ...(version.manifestJson as Record<string, unknown>) };
  const agentDefinition = { ...(version.agentDefinitionJson as Record<string, unknown>) };
  const warnings: string[] = [];
  const ambiguousFiles: Array<{ logicalPath: string; content: string }> = [];
  const imported = {
    updatedInstructions: false,
    subagents: 0,
    skills: 0,
    rules: 0,
    rawFiles: rawFiles.length,
  };

  const applyInstructions = (text: string, sourceLabel: string) => {
    const existing =
      typeof agentDefinition.instructions === "string" ? agentDefinition.instructions.trim() : "";
    const nextContent = text.trim();

    if (!nextContent) {
      return;
    }

    if (!existing) {
      agentDefinition.instructions = nextContent;
    } else if (!existing.includes(nextContent)) {
      agentDefinition.instructions = `${existing}\n\n## Imported from ${sourceLabel}\n${nextContent}`;
    }

    imported.updatedInstructions = true;
  };

  const applyImportedSkill = async (params: {
    name: string;
    description: string;
    bodyMd: string;
    metadata?: Record<string, unknown>;
  }) => {
    await upsertSkillRule({
      versionId: version.id,
      name: params.name,
      kind: "skill",
      bodyMd: params.bodyMd,
      metadata: {
        ...(params.metadata ?? {}),
        description: params.description,
      },
    });

    imported.skills += 1;
  };

  for (const rawFile of rawFiles) {
    const text = await readArtifactText(rawFile.storageKey);
    const normalizedPath = normalizeImportLogicalPath(rawFile.logicalPath);
    const fileName = path.posix.basename(normalizedPath);

    if (fileName === "AGENTS.md" || fileName === "CLAUDE.md") {
      applyInstructions(text, fileName);
      continue;
    }

    if (normalizedPath.startsWith(".claude/agents/") && fileName.endsWith(".md")) {
      const parsed = parseFrontmatterMarkdown(text);
      const parsedName = readString(parsed.data.name);
      const parsedDescription = readString(parsed.data.description);
      const parsedModel = readString(parsed.data.model);
      const parsedPermissionMode = readString(parsed.data.permissionMode);
      const slug = toSlug(parsedName ?? fileName.replace(/\.md$/, ""));

      await upsertSubagent({
        versionId: version.id,
        slug,
        name: parsedName ?? slug,
        description: parsedDescription ?? "Imported Claude subagent",
        instructionsMd: parsed.body,
        tools: parseToolList(parsed.data.tools),
        modelHint: parsedModel ?? "inherit",
        permissionMode: parsedPermissionMode ?? null,
        metadata: {
          sourcePlatform: "claude_code",
          sourcePath: normalizedPath,
          frontmatter: parsed.data,
          frontmatterRaw: parsed.rawFrontmatter,
        },
      });

      imported.subagents += 1;
      continue;
    }

    if (normalizedPath.startsWith(".codex/agents/") && fileName.endsWith(".toml")) {
      const parsed = parseCodexAgentToml(text);
      const slug = toSlug(parsed.name || fileName.replace(/\.toml$/, ""));

      await upsertSubagent({
        versionId: version.id,
        slug,
        name: parsed.name || slug,
        description: parsed.description,
        instructionsMd: parsed.developerInstructions,
        tools: parsed.tools,
        modelHint: parsed.modelHint,
        permissionMode: parsed.permissionMode,
        metadata: {
          sourcePlatform: "codex",
          sourcePath: normalizedPath,
          ...parsed.metadata,
        },
      });

      imported.subagents += 1;
      continue;
    }

    const skillLocation = getSkillPlatformAndName(normalizedPath);

    if (skillLocation) {
      const parsed = parseFrontmatterMarkdown(text);
      const parsedName = readString(parsed.data.name);
      const parsedDescription = readString(parsed.data.description);

      await applyImportedSkill({
        name: parsedName ?? skillLocation.slug,
        description: parsedDescription ?? "Imported skill",
        bodyMd: parsed.body,
        metadata: {
          sourcePlatform: skillLocation.platform,
          sourcePath: normalizedPath,
          frontmatter: parsed.data,
          frontmatterRaw: parsed.rawFrontmatter,
        },
      });

      continue;
    }

    if (normalizedPath.startsWith(".cursor/rules/") && fileName.endsWith(".mdc")) {
      const name = fileName.replace(/\.mdc$/, "");
      const parsed = parseFrontmatterMarkdown(text);
      await upsertSkillRule({
        versionId: version.id,
        name,
        kind: "rule",
        bodyMd: parsed.body,
        metadata: {
          sourcePlatform: "cursor",
          sourcePath: normalizedPath,
          description: readString(parsed.data.description) ?? `${name} project rule`,
          frontmatter: parsed.data,
          frontmatterRaw: parsed.rawFrontmatter,
        },
      });

      imported.rules += 1;
      continue;
    }

    if (fileName.endsWith(".py")) {
      ambiguousFiles.push({ logicalPath: rawFile.logicalPath, content: text });
      warnings.push(`${rawFile.logicalPath} was stored as a raw artifact and flagged for later LLM-assisted conversion.`);
      continue;
    }

    if (fileName.endsWith(".md")) {
      ambiguousFiles.push({ logicalPath: rawFile.logicalPath, content: text });
      const name = fileName.replace(/\.md$/, "");
      await upsertSkillRule({
        versionId: version.id,
        name,
        kind: "prompt_fragment",
        bodyMd: text,
        metadata: {
          sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
          sourcePath: normalizedPath,
        },
      });

      imported.rules += 1;
      continue;
    }
  }

  let assistedNormalization: {
    confidence: number;
    warnings: string[];
    summary: string;
  } | null = null;

  if (ambiguousFiles.length > 0) {
    if (process.env.OPENAI_API_KEY) {
      try {
        const normalized = await normalizeAmbiguousFilesWithAi({
          files: ambiguousFiles,
        });

        if (normalized) {
          if (normalized.instructions.trim()) {
            applyInstructions(normalized.instructions, "OpenAI normalization");
          }

          agentDefinition.tools = mergeToolLists(agentDefinition.tools, normalized.tools);

          for (const skill of normalized.skills) {
            await applyImportedSkill({
              name: skill.name,
              description: skill.description,
              bodyMd: skill.body,
              metadata: {
                sourcePlatform: "ai_normalization",
              },
            });
          }

          for (const subagent of normalized.subagents) {
            await upsertSubagent({
              versionId: version.id,
              slug: toSlug(subagent.name),
              name: subagent.name,
              description: subagent.description,
              instructionsMd: subagent.instructions,
              tools: subagent.tools,
              modelHint: subagent.modelHint,
              permissionMode: subagent.permissionMode,
              metadata: {
                sourcePlatform: "ai_normalization",
              },
            });
            imported.subagents += 1;
          }

          for (const fragment of normalized.promptFragments) {
            await upsertSkillRule({
              versionId: version.id,
              name: fragment.name,
              kind: "prompt_fragment",
              bodyMd: fragment.body,
              metadata: {
                sourcePlatform: "ai_normalization",
              },
            });
            imported.rules += 1;
          }

          warnings.push(...normalized.warnings);
          assistedNormalization = {
            confidence: normalized.confidence,
            warnings: normalized.warnings,
            summary: normalized.summary,
          };

          await prisma.transformJob.create({
            data: {
              organizationId,
              projectId: version.agentPackage.projectId,
              agentPackageId: version.agentPackage.id,
              packageVersionId: version.id,
              jobType: "normalize",
              status: "succeeded",
              sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
              resultJson: normalized as Prisma.InputJsonObject,
              finishedAt: new Date(),
              createdByUserId: params.createdByUserId,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Assisted normalization failed";
        warnings.push(message);

        await prisma.transformJob.create({
          data: {
            organizationId,
            projectId: version.agentPackage.projectId,
            agentPackageId: version.agentPackage.id,
            packageVersionId: version.id,
            jobType: "normalize",
            status: "failed",
            sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
            errorJson: { message },
            finishedAt: new Date(),
            createdByUserId: params.createdByUserId,
          },
        });
      }
    } else {
      warnings.push("OpenAI-assisted normalization is available when OPENAI_API_KEY is configured.");
    }
  }

  manifest.lastImportedAt = new Date().toISOString();
  manifest.sourcePlatform = params.sourcePlatform ?? version.agentPackage.sourcePlatform;

  const validationJson = {
    issues: [],
    warnings,
  };

  await prisma.packageVersion.update({
    where: { id: version.id },
    data: {
      manifestJson: asInputJsonObject(manifest),
      agentDefinitionJson: asInputJsonObject(agentDefinition),
      validationJson: asInputJsonObject(validationJson),
    },
  });

  const job = params.jobId
    ? await prisma.transformJob.update({
        where: { id: params.jobId },
        data: {
          status: "succeeded",
          sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
          targetPlatform: null,
          resultJson: {
            imported,
            warnings,
            assistedNormalization,
          },
          finishedAt: new Date(),
        },
      })
    : await prisma.transformJob.create({
        data: {
          organizationId,
          projectId: version.agentPackage.projectId,
          agentPackageId: version.agentPackage.id,
          packageVersionId: version.id,
          jobType: "import_parse",
          status: "succeeded",
          sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
          targetPlatform: null,
          resultJson: {
            imported,
            warnings,
            assistedNormalization,
          },
          finishedAt: new Date(),
          createdByUserId: params.createdByUserId,
        },
      });

  await notifyOrganizationIntegrations({
    organizationId,
    event: "import_parse",
    text: `${version.agentPackage.name} imported ${imported.rawFiles} files, ${imported.skills} skills, ${imported.subagents} subagents, and ${imported.rules} rules.`,
  });

  return { job, imported, warnings };
}

async function createQueuedTransformJob(params: {
  versionId: string;
  jobType: "compatibility_check" | "export_build" | "import_parse";
  createdByUserId: string;
  sourcePlatform?: string | null;
  targetPlatform?: SupportedTarget | null;
  inputJson?: Record<string, unknown>;
}) {
  const version = await getVersionForJobs(params.versionId);
  const organizationId = await getOrganizationIdForProject(version.agentPackage.projectId);

  return prisma.transformJob.create({
    data: {
      organizationId,
      projectId: version.agentPackage.projectId,
      agentPackageId: version.agentPackage.id,
      packageVersionId: version.id,
      jobType: params.jobType,
      status: "queued",
      sourcePlatform: params.sourcePlatform ?? version.agentPackage.sourcePlatform,
      targetPlatform: params.targetPlatform ?? null,
      inputJson: params.inputJson ? asInputJsonObject(params.inputJson) : undefined,
      createdByUserId: params.createdByUserId,
    },
  });
}

export async function requestCompatibilityCheck(params: {
  versionId: string;
  targetPlatform: SupportedTarget;
  createdByUserId: string;
}) {
  if (env.JOB_EXECUTION_MODE !== "worker") {
    return runCompatibilityCheck(params);
  }

  const job = await createQueuedTransformJob({
    versionId: params.versionId,
    jobType: "compatibility_check",
    createdByUserId: params.createdByUserId,
    targetPlatform: params.targetPlatform,
    inputJson: {
      versionId: params.versionId,
      targetPlatform: params.targetPlatform,
    },
  });

  return { job };
}

export async function requestExportPreview(params: {
  versionId: string;
  targetPlatform: SupportedTarget;
  createdByUserId: string;
}) {
  if (env.JOB_EXECUTION_MODE !== "worker") {
    return buildExportPreview(params);
  }

  const job = await createQueuedTransformJob({
    versionId: params.versionId,
    jobType: "export_build",
    createdByUserId: params.createdByUserId,
    targetPlatform: params.targetPlatform,
    inputJson: {
      versionId: params.versionId,
      targetPlatform: params.targetPlatform,
    },
  });

  return {
    job,
    compatibility: null,
    generatedFiles: [],
  };
}

export async function requestImportForVersion(params: {
  versionId: string;
  sourcePlatform?: string;
  createdByUserId: string;
}) {
  if (env.JOB_EXECUTION_MODE !== "worker") {
    return runImportForVersion(params);
  }

  const job = await createQueuedTransformJob({
    versionId: params.versionId,
    jobType: "import_parse",
    createdByUserId: params.createdByUserId,
    sourcePlatform: params.sourcePlatform ?? null,
    inputJson: {
      versionId: params.versionId,
      sourcePlatform: params.sourcePlatform ?? null,
    },
  });

  return { job };
}

export async function processTransformJob(jobId: string) {
  const job = await prisma.transformJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  if (job.status === "succeeded" || job.status === "failed") {
    return { job };
  }

  if (job.status === "queued") {
    await prisma.transformJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        startedAt: job.startedAt ?? new Date(),
      },
    });
  }

  const inputJson = (job.inputJson as Record<string, unknown> | null) ?? {};

  try {
    switch (job.jobType) {
      case "compatibility_check":
        return await runCompatibilityCheck({
          versionId: job.packageVersionId ?? String(inputJson.versionId ?? ""),
          targetPlatform: (job.targetPlatform ?? inputJson.targetPlatform) as SupportedTarget,
          createdByUserId: job.createdByUserId,
          jobId,
        });
      case "export_build":
        return await buildExportPreview({
          versionId: job.packageVersionId ?? String(inputJson.versionId ?? ""),
          targetPlatform: (job.targetPlatform ?? inputJson.targetPlatform) as SupportedTarget,
          createdByUserId: job.createdByUserId,
          jobId,
        });
      case "import_parse":
        return await runImportForVersion({
          versionId: job.packageVersionId ?? String(inputJson.versionId ?? ""),
          sourcePlatform:
            typeof job.sourcePlatform === "string"
              ? job.sourcePlatform
              : typeof inputJson.sourcePlatform === "string"
                ? inputJson.sourcePlatform
                : undefined,
          createdByUserId: job.createdByUserId,
          jobId,
        });
      default:
        throw new Error(`Unsupported transform job type: ${job.jobType}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transform job failed";
    const failedJob = await prisma.transformJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorJson: {
          message,
        },
        finishedAt: new Date(),
      },
    });

    return {
      job: failedJob,
      error: {
        message,
      },
    };
  }
}

export async function processQueuedTransformJobs(params?: { limit?: number }) {
  const queuedJobs = await prisma.transformJob.findMany({
    where: {
      status: "queued",
      jobType: {
        in: ["compatibility_check", "export_build", "import_parse"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: params?.limit ?? 10,
  });

  const results = [];

  for (const job of queuedJobs) {
    results.push(await processTransformJob(job.id));
  }

  return results;
}
