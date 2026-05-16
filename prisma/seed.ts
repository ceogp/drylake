import { prisma } from "../lib/prisma";
import { toSlug } from "../lib/utils/slug";

async function main() {
  const email = process.env.DEFAULT_DEV_USER_EMAIL ?? "owner@xupra.local";
  const displayName = process.env.DEFAULT_DEV_USER_NAME ?? "Xupra Owner";
  const orgSlug = `${toSlug(displayName || email.split("@")[0]) || "xupra"}-org`;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email,
        authProvider: "dev",
        status: "active",
      },
    }));

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      displayName,
    },
    create: {
      userId: user.id,
      displayName,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {
      name: "Xupra DryLake",
      tier: "free",
    },
    create: {
      name: "Xupra DryLake",
      slug: orgSlug,
      tier: "free",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      role: "owner",
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      provider: "local",
      tier: "free",
      status: "trial",
      limitsJson: {
        maxProjects: 3,
        maxPackagesPerProject: 10,
        maxVersionsPerPackage: 25,
      },
      entitlementsJson: {
        xupra_pro_ai: true,
        session_cloud_sync: false,
        pr_summary_generation: false,
      },
    },
    create: {
      organizationId: organization.id,
      provider: "local",
      tier: "free",
      status: "trial",
      limitsJson: {
        maxProjects: 3,
        maxPackagesPerProject: 10,
        maxVersionsPerPackage: 25,
      },
      entitlementsJson: {
        xupra_pro_ai: true,
        session_cloud_sync: false,
        pr_summary_generation: false,
      },
    },
  });

  const project = await prisma.project.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "agent-library",
      },
    },
    update: {
      name: "Agent Library",
      description: "Main library for transferable agent packages",
    },
    create: {
      organizationId: organization.id,
      name: "Agent Library",
      slug: "agent-library",
      description: "Main library for transferable agent packages",
      createdByUserId: user.id,
    },
  });

  const agentPackage = await prisma.agentPackage.upsert({
    where: {
      projectId_slug: {
        projectId: project.id,
        slug: "backend-reviewer",
      },
    },
    update: {
      name: "Backend Reviewer",
      description: "Transferable reviewer package for backend codebases",
      sourcePlatform: "generic",
      defaultTargetPlatform: "claude_code",
    },
    create: {
      projectId: project.id,
      name: "Backend Reviewer",
      slug: "backend-reviewer",
      description: "Transferable reviewer package for backend codebases",
      sourcePlatform: "generic",
      defaultTargetPlatform: "claude_code",
      createdByUserId: user.id,
    },
  });

  const version = await prisma.packageVersion.upsert({
    where: {
      agentPackageId_versionNumber: {
        agentPackageId: agentPackage.id,
        versionNumber: 1,
      },
    },
    update: {},
    create: {
      agentPackageId: agentPackage.id,
      versionNumber: 1,
      status: "ready",
      origin: "manual",
      manifestJson: {
        name: "Backend Reviewer",
        slug: "backend-reviewer",
        sourcePlatform: "generic",
        targetPlatforms: ["codex", "claude_code", "cursor"],
      },
      agentDefinitionJson: {
        description: "Reviews backend code for maintainability and safety.",
        instructions:
          "Focus on correctness, data safety, migrations, tests, and operational risks.",
        tools: ["Read", "Grep", "Glob"],
      },
      compatibilityJson: {
        codex: { status: "supported" },
        claude_code: { status: "supported" },
        cursor: { status: "supported" },
      },
      validationJson: {
        issues: [],
        warnings: [],
      },
      createdByUserId: user.id,
    },
  });

  await prisma.agentPackage.update({
    where: { id: agentPackage.id },
    data: {
      latestVersionId: version.id,
    },
  });

  await prisma.subagent.upsert({
    where: {
      packageVersionId_slug: {
        packageVersionId: version.id,
        slug: "migration-checker",
      },
    },
    update: {},
    create: {
      packageVersionId: version.id,
      name: "Migration Checker",
      slug: "migration-checker",
      description: "Review schema and migration safety.",
      instructionsMd:
        "Inspect schema changes for destructive migrations, index risks, and rollback gaps.",
      toolsJson: ["Read", "Grep", "Glob"],
      modelHint: "inherit",
      permissionMode: "read_only",
      sortOrder: 1,
    },
  });

  const existingRule = await prisma.skillRule.findFirst({
    where: {
      packageVersionId: version.id,
      name: "Repository Rule",
    },
  });

  if (!existingRule) {
    await prisma.skillRule.create({
      data: {
        packageVersionId: version.id,
        name: "Repository Rule",
        kind: "rule",
        bodyMd: "Prefer deterministic transforms before LLM-assisted conversion.",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
