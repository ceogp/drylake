import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string, dev?: boolean) => void;
};

loadEnvConfig(process.cwd(), true);

function expect(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    throw new Error(
      "validate-local.ts requires a PostgreSQL DATABASE_URL. Start PostgreSQL or point .env at the dev RDS copy.",
    );
  }

  const [{ prisma }, { env }, { saveArtifactText }, importExport, { toSlug }] = await Promise.all([
    import("../lib/prisma"),
    import("../lib/env"),
    import("../lib/storage/artifacts"),
    import("../lib/services/import-export"),
    import("../lib/utils/slug"),
  ]);

  const { runImportForVersion, buildExportPreview } = importExport;

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: env.DEFAULT_DEV_USER_EMAIL },
  });

  const agentPackage = await prisma.agentPackage.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });

  const latestVersion = await prisma.packageVersion.findFirst({
    where: { agentPackageId: agentPackage.id },
    orderBy: { versionNumber: "desc" },
  });

  const version = await prisma.packageVersion.create({
    data: {
      agentPackageId: agentPackage.id,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      status: "draft",
      origin: "local_validation",
      manifestJson: {
        name: "Local Validation Package",
        targetPlatforms: ["codex", "claude_code", "claude_agents", "cursor"],
      },
      agentDefinitionJson: {
        description: "Local validation package",
        instructions: "",
        tools: [],
      },
      validationJson: {
        issues: [],
        warnings: [],
      },
      createdByUserId: user.id,
    },
  });

  const sourceFiles = [
    {
      logicalPath: "AGENTS.md",
      sourceFormat: "md",
      text: ["# Validation Package", "", "Preserve originals before export."].join("\n"),
    },
    {
      logicalPath: ".agents/skills/deploy-review/SKILL.md",
      sourceFormat: "md",
      text: [
        "---",
        "name: deploy-review",
        "description: Review deployment workflows before publishing.",
        "disable-model-invocation: true",
        "---",
        "Check deployment steps and summarize rollout risks.",
      ].join("\n"),
    },
    {
      logicalPath: ".codex/agents/reviewer.toml",
      sourceFormat: "toml",
      text: [
        'name = "reviewer"',
        'description = "Review implementation changes and call out risks."',
        'developer_instructions = """Inspect code changes carefully and report concrete issues."""',
        'tools = ["Read", "Grep"]',
        'model = "gpt-5.4-mini"',
        'model_reasoning_effort = "medium"',
        'sandbox_mode = "read-only"',
      ].join("\n"),
    },
    {
      logicalPath: "selected-repo/.codex/agents/browser-reviewer.toml",
      sourceFormat: "toml",
      text: [
        'name = "browser-reviewer"',
        'description = "Review browser folder uploads after import."',
        'developer_instructions = """Confirm browser folder imports normalize selected-folder prefixes."""',
        'tools = ["Read"]',
      ].join("\n"),
    },
    {
      logicalPath: ".claude/agents/migration-checker.md",
      sourceFormat: "md",
      text: [
        "---",
        "name: migration-checker",
        "description: Review migration safety and rollback paths.",
        "tools:",
        "  - Read",
        "  - Grep",
        "  - Glob",
        "model: inherit",
        "permissionMode: read_only",
        "context: fork",
        "agent: Explore",
        "---",
        "Inspect schema changes for destructive migrations and rollback gaps.",
      ].join("\n"),
    },
    {
      logicalPath: ".claude/skills/release-manager/SKILL.md",
      sourceFormat: "md",
      text: [
        "---",
        "name: release-manager",
        "description: Coordinate releases when the user asks for rollout, release prep, or launch checks.",
        "when_to_use: Use for release readiness, launch checklists, and go-live coordination.",
        "disable-model-invocation: true",
        "allowed-tools:",
        "  - Read",
        "  - Grep",
        "---",
        "Review release notes, check blockers, and produce a go-live checklist.",
      ].join("\n"),
    },
    {
      logicalPath: "selected-repo/.agents/skills/browser-folder-import/SKILL.md",
      sourceFormat: "md",
      text: [
        "---",
        "name: browser-folder-import",
        "description: Validate browser folder uploads with selected-folder prefixes.",
        "---",
        "Check that imported browser paths canonicalize before parsing.",
      ].join("\n"),
    },
    {
      logicalPath: "selected-repo/.codex/skills/.system/nested-codex-skill/SKILL.md",
      sourceFormat: "md",
      text: [
        "---",
        "name: nested-codex-skill",
        "description: Validate nested Codex skill folders from global installs.",
        "---",
        "Check that nested Codex skills import from selected global folders.",
      ].join("\n"),
    },
    {
      logicalPath: ".cursor/rules/repository-rule.mdc",
      sourceFormat: "mdc",
      text: [
        "---",
        "description: Repository rule for safe transformations.",
        "alwaysApply: true",
        "globs:",
        "  - src/**",
        "  - app/**",
        "---",
        "Prefer deterministic transforms before LLM-assisted conversion.",
      ].join("\n"),
    },
    {
      logicalPath: "workflow.md",
      sourceFormat: "md",
      text: [
        "# Workflow",
        "",
        "Normalize source material into canonical objects, then regenerate target exports.",
      ].join("\n"),
    },
  ];

  for (const file of sourceFiles) {
    const artifact = await saveArtifactText({
      versionId: version.id,
      kind: "raw_source",
      logicalPath: file.logicalPath,
      text: file.text,
    });

    await prisma.packageFile.create({
      data: {
        packageVersionId: version.id,
        kind: "raw_source",
        logicalPath: file.logicalPath,
        storageKey: artifact.storageKey,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        sourceFormat: file.sourceFormat,
      },
    });
  }

  const imported = await runImportForVersion({
    versionId: version.id,
    sourcePlatform: "generic",
    createdByUserId: user.id,
  });

  const browserPrefixSubagent = await prisma.subagent.findUnique({
    where: {
      packageVersionId_slug: {
        packageVersionId: version.id,
        slug: "browser-reviewer",
      },
    },
  });
  const browserPrefixSkill = await prisma.skillRule.findFirst({
    where: {
      packageVersionId: version.id,
      name: "browser-folder-import",
      kind: "skill",
    },
  });
  const nestedCodexSkill = await prisma.skillRule.findFirst({
    where: {
      packageVersionId: version.id,
      name: "nested-codex-skill",
      kind: "skill",
    },
  });

  expect(browserPrefixSubagent, "Browser-prefixed Codex agent was not imported as a subagent.");
  expect(browserPrefixSkill, "Browser-prefixed skill folder was not imported as a skill.");
  expect(nestedCodexSkill, "Nested Codex skill folder was not imported as a skill.");

  const targets = ["codex", "claude_code", "claude_agents", "cursor"] as const;
  const exports = [];

  for (const target of targets) {
    const result = await buildExportPreview({
      versionId: version.id,
      targetPlatform: target,
      createdByUserId: user.id,
    });

    exports.push({
      target,
      status: result.compatibility.status,
      generatedFiles: result.generatedFiles.map((file) => file.logicalPath),
    });

    if (target === "claude_code") {
      const claudeSkill = result.generatedFiles.find(
        (file) => file.logicalPath === ".claude/skills/release-manager/SKILL.md",
      );
      const claudeSubagent = result.generatedFiles.find(
        (file) => file.logicalPath === ".claude/agents/migration-checker.md",
      );

      if (!claudeSkill) {
        throw new Error("Claude skill export is missing release-manager.");
      }

      expect(
        claudeSkill.preview.includes("when_to_use:"),
        "Claude skill export lost when_to_use metadata.",
      );
      expect(
        claudeSkill.preview.includes("disable-model-invocation: true"),
        "Claude skill export lost disable-model-invocation metadata.",
      );
      if (!claudeSubagent) {
        throw new Error("Claude subagent export is missing migration-checker.");
      }

      expect(
        claudeSubagent.preview.includes("context: fork"),
        "Claude subagent export lost context metadata.",
      );
      expect(
        claudeSubagent.preview.includes("agent: Explore"),
        "Claude subagent export lost agent metadata.",
      );
    }

    if (target === "cursor") {
      const cursorRule = result.generatedFiles.find(
        (file) => file.logicalPath === ".cursor/rules/repository-rule.mdc",
      );
      const subagentRule = result.generatedFiles.find(
        (file) => file.logicalPath === ".cursor/rules/xupra-subagents.mdc",
      );

      if (!cursorRule) {
        throw new Error("Cursor rule export is missing repository-rule.mdc.");
      }

      expect(cursorRule.preview.includes("globs:"), "Cursor rule export lost globs metadata.");
      expect(
        cursorRule.preview.includes("alwaysApply: true"),
        "Cursor rule export lost alwaysApply metadata.",
      );
      expect(subagentRule, "Cursor subagent flattening rule was not generated.");
    }
  }

  const summary = {
    versionId: version.id,
    packageId: agentPackage.id,
    versionSlug: toSlug(`validation-${version.versionNumber}`),
    imported: imported.imported,
    warnings: imported.warnings,
    exports,
  };

  console.log(JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
