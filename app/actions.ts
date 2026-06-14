"use server";

import type { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/services/billing";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { evaluateContinuousWatch, markGuardScanAsBaseline, updateTeamPolicy } from "@/lib/services/team-security";
import {
  requireCredentialAccess,
  requireIntegrationAccess,
  requireOrganizationRole,
  requirePackageAccess,
  requireProjectAccess,
  requireVersionAccess,
} from "@/lib/services/access";
import { createCredential, verifyCredential } from "@/lib/services/credentials";
import { requireCurrentAppContextForPage, setActiveOrganizationCookie } from "@/lib/services/current-user";
import { createDeploymentTarget } from "@/lib/services/deployments";
import { createIntegration, sendTestIntegrationMessage, verifyIntegration } from "@/lib/services/integrations";
import { toSlug } from "@/lib/utils/slug";

export async function setActiveOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/app").trim() || "/app";

  if (!organizationId) {
    return;
  }

  await setActiveOrganizationCookie(organizationId);
  redirect(redirectTo);
}

export async function createProjectAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin", "member"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!organizationId || !name) {
    return;
  }

  const project = await prisma.project.create({
    data: {
      organizationId,
      createdByUserId: context.user.id,
      name,
      slug: toSlug(name),
      description: description || null,
    },
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function createPackageAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourcePlatform = String(formData.get("sourcePlatform") ?? "generic").trim();
  const defaultTargetPlatform = String(formData.get("defaultTargetPlatform") ?? "").trim();

  if (!projectId || !name) {
    return;
  }

  const { context, project } = await requireProjectAccess(projectId);

  const agentPackage = await prisma.agentPackage.create({
    data: {
      projectId: project.id,
      createdByUserId: context.user.id,
      name,
      slug: toSlug(name),
      description: description || null,
      sourcePlatform,
      defaultTargetPlatform: defaultTargetPlatform || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/packages/${agentPackage.id}`);
}

export async function createVersionAction(formData: FormData) {
  const packageId = String(formData.get("packageId") ?? "");

  if (!packageId) {
    return;
  }

  const { context, agentPackage } = await requirePackageAccess(packageId);
  const latestVersion = await prisma.packageVersion.findFirst({
    where: { agentPackageId: agentPackage.id },
    orderBy: { versionNumber: "desc" },
  });

  const version = await prisma.packageVersion.create({
    data: {
      agentPackageId: agentPackage.id,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      status: "draft",
      origin: "manual",
      manifestJson: {
        name: "New Package Version",
        targetPlatforms: [],
      },
      agentDefinitionJson: {
        description: "",
        instructions: "",
        tools: [],
      },
      validationJson: {
        issues: [],
        warnings: [],
      },
      createdByUserId: context.user.id,
    },
  });

  await prisma.agentPackage.update({
    where: { id: agentPackage.id },
    data: {
      latestVersionId: version.id,
    },
  });

  revalidatePath(`/packages/${agentPackage.id}`);
  redirect(`/versions/${version.id}`);
}

export async function updateVersionAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  const manifestName = String(formData.get("manifestName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const tools = String(formData.get("tools") ?? "")
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);
  const targetPlatforms = String(formData.get("targetPlatforms") ?? "")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);

  if (!versionId) {
    return;
  }

  const { version } = await requireVersionAccess(versionId);

  const currentManifest = (version.manifestJson as Record<string, unknown>) ?? {};
  const currentAgentDefinition = (version.agentDefinitionJson as Record<string, unknown>) ?? {};
  const nextManifest: Prisma.InputJsonObject = {
    ...(currentManifest as Prisma.InputJsonObject),
    name:
      manifestName ||
      (typeof currentManifest.name === "string" ? currentManifest.name : "Untitled Package Version"),
    targetPlatforms,
  };
  const nextAgentDefinition: Prisma.InputJsonObject = {
    ...(currentAgentDefinition as Prisma.InputJsonObject),
    description,
    instructions,
    tools,
  };

  await prisma.packageVersion.update({
    where: { id: versionId },
    data: {
      manifestJson: nextManifest,
      agentDefinitionJson: nextAgentDefinition,
    },
  });

  revalidatePath(`/versions/${versionId}`);
}

export async function addSubagentAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const tools = String(formData.get("tools") ?? "")
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);
  const modelHint = String(formData.get("modelHint") ?? "inherit").trim();

  if (!versionId || !name || !instructions) {
    return;
  }

  await requireVersionAccess(versionId);
  const currentCount = await prisma.subagent.count({
    where: { packageVersionId: versionId },
  });

  await prisma.subagent.create({
    data: {
      packageVersionId: versionId,
      name,
      slug: toSlug(name),
      description: description || "Custom subagent",
      instructionsMd: instructions,
      toolsJson: tools,
      modelHint,
      permissionMode: null,
      sortOrder: currentCount + 1,
    },
  });

  revalidatePath(`/versions/${versionId}`);
}

export async function addSkillRuleAction(formData: FormData) {
  const versionId = String(formData.get("versionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "rule").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!versionId || !name || !body) {
    return;
  }

  await requireVersionAccess(versionId);
  await prisma.skillRule.create({
    data: {
      packageVersionId: versionId,
      name,
      kind,
      bodyMd: body,
    },
  });

  revalidatePath(`/versions/${versionId}`);
}

export async function createCredentialAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const name = String(formData.get("name") ?? "").trim();
  const provider = String(formData.get("provider") ?? "custom").trim();
  const kind = String(formData.get("kind") ?? "api_key").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  const metadataRaw = String(formData.get("metadataJson") ?? "").trim();

  if (!organizationId || !name || !secret) {
    return;
  }

  const metadata = metadataRaw
    ? ((JSON.parse(metadataRaw) as Record<string, unknown>) ?? {})
    : {};

  await createCredential({
    organizationId,
    createdByUserId: context.user.id,
    name,
    provider,
    kind,
    secret,
    metadata,
  });

  revalidatePath("/credentials");
  redirect("/credentials");
}

export async function verifyCredentialAction(formData: FormData) {
  const credentialId = String(formData.get("credentialId") ?? "");

  if (!credentialId) {
    return;
  }

  const { context } = await requireCredentialAccess(credentialId);
  await requireOrganizationRole(["owner", "admin"], context.organization.id);
  await verifyCredential({
    credentialId,
    actorUserId: context.user.id,
  });

  revalidatePath("/credentials");
}

export async function createDeploymentTargetAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "claude_code").trim();
  const deliveryMode = String(formData.get("deliveryMode") ?? "git_branch").trim();
  const repository = String(formData.get("repository") ?? "").trim();
  const repositoryPath = String(formData.get("repositoryPath") ?? "").trim();
  const baseBranch = String(formData.get("baseBranch") ?? "").trim();
  const exportPath = String(formData.get("exportPath") ?? "").trim();
  const credentialId = String(formData.get("credentialId") ?? "").trim();
  const isDefault = String(formData.get("isDefault") ?? "").trim() === "on";

  if (!projectId || !name) {
    return;
  }

  const { context, project } = await requireProjectAccess(projectId);
  await createDeploymentTarget({
    projectId: project.id,
    createdByUserId: context.user.id,
    name,
    platform,
    deliveryMode,
    repository: repository || undefined,
    repositoryPath: repositoryPath || undefined,
    baseBranch: baseBranch || undefined,
    exportPath: exportPath || undefined,
    credentialId: credentialId || undefined,
    isDefault,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function createIntegrationAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const provider = String(formData.get("provider") ?? "").trim();
  const credentialId = String(formData.get("credentialId") ?? "").trim();
  const configRaw = String(formData.get("configJson") ?? "{}").trim();

  if (!organizationId || !provider) {
    return;
  }

  const config = (JSON.parse(configRaw) as Record<string, unknown>) ?? {};

  await createIntegration({
    organizationId,
    actorUserId: context.user.id,
    provider,
    credentialId: credentialId || undefined,
    config,
  });

  revalidatePath("/integrations");
  redirect("/integrations");
}

export async function verifyIntegrationAction(formData: FormData) {
  const integrationId = String(formData.get("integrationId") ?? "");

  if (!integrationId) {
    return;
  }

  const { context } = await requireIntegrationAccess(integrationId);
  await requireOrganizationRole(["owner", "admin"], context.organization.id);
  await verifyIntegration({
    integrationId,
    actorUserId: context.user.id,
  });

  revalidatePath("/integrations");
}

export async function sendTestIntegrationAction(formData: FormData) {
  const integrationId = String(formData.get("integrationId") ?? "");

  if (!integrationId) {
    return;
  }

  const { context } = await requireIntegrationAccess(integrationId);
  await requireOrganizationRole(["owner", "admin"], context.organization.id);
  await sendTestIntegrationMessage({
    integrationId,
    actorUserId: context.user.id,
  });

  revalidatePath("/integrations");
}

function getSafeReturnPath(rawValue: FormDataEntryValue | null) {
  const rawPath = String(rawValue ?? "").trim();

  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(rawPath, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function withQueryValue(path: string, key: string, value: string) {
  const parsed = new URL(path, "http://xupra.local");
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}`;
}

export async function createCheckoutAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const plan = String(formData.get("plan") ?? "pro").trim() as "pro" | "security_pro" | "team_security" | "enterprise";
  const returnPath = getSafeReturnPath(formData.get("returnPath"));

  if (!organizationId) {
    return;
  }

  const session = await createCheckoutSession({
    organizationId,
    userId: context.user.id,
    userEmail: context.user.email,
    priceLookup: plan,
    billingContext: plan === "team_security" ? "team" : "user",
    returnTo: returnPath,
    successUrl: returnPath ? `${env.APP_BASE_URL}${withQueryValue(returnPath, "billing", "success")}` : undefined,
    cancelUrl: returnPath ? `${env.APP_BASE_URL}${withQueryValue(returnPath, "billing", "canceled")}` : undefined,
  });

  if (session.configured && session.url) {
    redirect(session.url);
  }

  if (returnPath) {
    redirect(withQueryValue(returnPath, "billing", "unavailable"));
  }

  revalidatePath("/billing");
}

export async function openBillingPortalAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const returnPath = getSafeReturnPath(formData.get("returnPath"));

  if (!organizationId) {
    return;
  }

  const session = await createBillingPortalSession({
    organizationId,
    returnPath,
  });

  if (session.configured && session.url) {
    redirect(session.url);
  }

  revalidatePath("/billing");
}

function cleanProfileText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value.slice(0, maxLength) : null;
}

function requireProfileText(formData: FormData, key: string, maxLength: number) {
  const value = cleanProfileText(formData, key, maxLength);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export async function updateProfileAction(formData: FormData) {
  const context = await requireCurrentAppContextForPage();
  const displayName =
    cleanProfileText(formData, "displayName", 160) ??
    context.user.profile?.displayName ??
    context.user.email.split("@")[0] ??
    context.user.email;

  await prisma.profile.upsert({
    where: { userId: context.user.id },
    update: {
      displayName,
      phoneNumber: cleanProfileText(formData, "phoneNumber", 64),
      country: cleanProfileText(formData, "country", 96),
      addressLine1: cleanProfileText(formData, "addressLine1", 180),
      addressLine2: cleanProfileText(formData, "addressLine2", 180),
      city: cleanProfileText(formData, "city", 96),
      region: cleanProfileText(formData, "region", 96),
      postalCode: cleanProfileText(formData, "postalCode", 32),
      timezone: cleanProfileText(formData, "timezone", 64) ?? context.user.profile?.timezone ?? "UTC",
      locale: cleanProfileText(formData, "locale", 32) ?? context.user.profile?.locale ?? "en-US",
    },
    create: {
      userId: context.user.id,
      displayName,
      phoneNumber: cleanProfileText(formData, "phoneNumber", 64),
      country: cleanProfileText(formData, "country", 96),
      addressLine1: cleanProfileText(formData, "addressLine1", 180),
      addressLine2: cleanProfileText(formData, "addressLine2", 180),
      city: cleanProfileText(formData, "city", 96),
      region: cleanProfileText(formData, "region", 96),
      postalCode: cleanProfileText(formData, "postalCode", 32),
      timezone: cleanProfileText(formData, "timezone", 64) ?? "UTC",
      locale: cleanProfileText(formData, "locale", 32) ?? "en-US",
    },
  });

  revalidatePath("/account");
  revalidatePath("/settings");
  redirect("/account?profile=updated");
}

export async function completeOnboardingProfileAction(formData: FormData) {
  const context = await requireCurrentAppContextForPage();
  const displayName =
    requireProfileText(formData, "displayName", 160);
  const country = requireProfileText(formData, "country", 96);
  const planIntent = String(formData.get("planIntent") ?? "free").trim() === "paid" ? "paid" : "free";
  const organizationName = cleanProfileText(formData, "organizationName", 160);
  const returnPath = getSafeReturnPath(formData.get("returnTo")) ?? "/workspace";
  const completedAt = new Date();

  await prisma.$transaction([
    prisma.profile.upsert({
      where: { userId: context.user.id },
      update: {
        displayName,
        phoneNumber: cleanProfileText(formData, "phoneNumber", 64),
        country,
        addressLine1: cleanProfileText(formData, "addressLine1", 180),
        addressLine2: cleanProfileText(formData, "addressLine2", 180),
        city: cleanProfileText(formData, "city", 96),
        region: cleanProfileText(formData, "region", 96),
        postalCode: cleanProfileText(formData, "postalCode", 32),
        timezone: cleanProfileText(formData, "timezone", 64) ?? context.user.profile?.timezone ?? "UTC",
        locale: cleanProfileText(formData, "locale", 32) ?? context.user.profile?.locale ?? "en-US",
        signupPlanIntent: planIntent,
        onboardingCompletedAt: completedAt,
      },
      create: {
        userId: context.user.id,
        displayName,
        phoneNumber: cleanProfileText(formData, "phoneNumber", 64),
        country,
        addressLine1: cleanProfileText(formData, "addressLine1", 180),
        addressLine2: cleanProfileText(formData, "addressLine2", 180),
        city: cleanProfileText(formData, "city", 96),
        region: cleanProfileText(formData, "region", 96),
        postalCode: cleanProfileText(formData, "postalCode", 32),
        timezone: cleanProfileText(formData, "timezone", 64) ?? "UTC",
        locale: cleanProfileText(formData, "locale", 32) ?? "en-US",
        signupPlanIntent: planIntent,
        onboardingCompletedAt: completedAt,
      },
    }),
    prisma.productAccount.upsert({
      where: {
        userId_productKey: {
          userId: context.user.id,
          productKey: "drylake",
        },
      },
      update: {
        organizationId: context.organization.id,
        status: "active",
        planIntent,
        onboardingCompletedAt: completedAt,
        lastSeenAt: completedAt,
      },
      create: {
        userId: context.user.id,
        organizationId: context.organization.id,
        productKey: "drylake",
        status: "active",
        planIntent,
        onboardingCompletedAt: completedAt,
        lastSeenAt: completedAt,
      },
    }),
    ...(organizationName
      ? [
          prisma.organization.update({
            where: { id: context.organization.id },
            data: { name: organizationName },
          }),
        ]
      : []),
  ]);

  revalidatePath("/account");
  revalidatePath("/admin/users");

  if (planIntent === "paid") {
    const params = new URLSearchParams({
      welcome: "1",
      returnPath,
    });

    if (returnPath.startsWith("/extensions/connect")) {
      params.set("source", "extension");
    }

    redirect(`/billing?${params.toString()}`);
  }

  redirect(returnPath);
}

function formList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function asStringArrayFromJson(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function redactGuardCloudValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
      .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED AWS ACCESS KEY]")
      .replace(/\b(?:sk|rk|pk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
      .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
      .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)[^\s"'`]+/gi, "$1[REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map(redactGuardCloudValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactGuardCloudValue(item)]));
  }

  return value;
}

function workspaceFilePathInventory(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const workspace = value as Record<string, unknown>;
  return [
    ...asRecordArray(workspace.deploymentFiles).map((item) => item.path),
    ...asRecordArray(workspace.iacFiles).map((item) => item.path),
    ...asRecordArray(workspace.ciWorkflowFiles).map((item) => item.path),
    ...asRecordArray(workspace.credentialLikeFiles).map((item) => item.path),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function cloudAnalysisResultFromSavedReport(input: {
  findings: Record<string, unknown>[];
  mcpServers: Record<string, unknown>[];
  extensions: Record<string, unknown>[];
  filePathInventory: string[];
  packageManagers: string[];
  packageScripts: string[];
}) {
  const severityCounts = input.findings.reduce<Record<string, number>>((counts, finding) => {
    const severity = typeof finding.severity === "string" ? finding.severity : "unknown";
    counts[severity] = (counts[severity] ?? 0) + 1;
    return counts;
  }, {});

  const categoryCounts = input.findings.reduce<Record<string, number>>((counts, finding) => {
    const category = typeof finding.category === "string" ? finding.category : "unknown";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

  return {
    summary: "Deep Cloud Analysis completed from an approved saved Guard report.",
    uploadAssurance: {
      rawSecretsAllowed: false,
      fullSourceTreeAllowed: false,
      source: "saved_guard_report",
    },
    riskCorrelation: {
      findingCount: input.findings.length,
      severityCounts,
      categoryCounts,
      mcpServerCount: input.mcpServers.length,
      extensionCount: input.extensions.length,
    },
    supplyChainReview: {
      packageSignals: [
        ...input.packageManagers.map((item) => `package-manager:${item}`),
        ...input.packageScripts.map((item) => `script:${item}`),
      ],
      recommendation: input.packageScripts.length
        ? "Review saved package scripts for deploy, install-hook, and unpinned tool execution risk."
        : "No package script metadata was available on the saved report.",
    },
    agentToolGraph: {
      mcpTools: input.mcpServers.slice(0, 50),
      extensions: input.extensions.slice(0, 50),
      recommendation: "Reduce agent tool blast radius with MCP and extension allowlists/denylists.",
    },
    blastRadiusGraph: {
      filePathInventoryCount: input.filePathInventory.length,
      sensitivePathSignals: input.filePathInventory.filter((path) =>
        /(^|\/)(\.env|\.github|terraform|docker|k8s|kubernetes|deploy|scripts)(\/|$)/i.test(path),
      ),
    },
    remediationPlan: {
      executiveSummary: "Prioritize critical/high Guard findings, then reduce tool and deploy surface.",
      quickFixes: [
        "Pin MCP and package-launch versions.",
        "Move secrets out of agent-readable files.",
        "Apply team MCP and extension policy.",
        "Re-run Guard after remediation.",
      ],
    },
  };
}

export async function markTeamBaselineAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const guardScanId = String(formData.get("guardScanId") ?? "").trim();
  const context = await requireOrganizationRole(["owner", "admin"], requestedOrganizationId || undefined);
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);

  if (!resolved.canUseTeamBaseline) {
    throw new Error("Team Baseline requires Team Security.");
  }

  if (!guardScanId) {
    throw new Error("guardScanId is required.");
  }

  await markGuardScanAsBaseline({
    organizationId: context.organization.id,
    actorUserId: context.user.id,
    guardScanId,
  });

  revalidatePath("/team/security/baseline");
  revalidatePath("/team/security");
}

export async function updateTeamPolicyAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(["owner", "admin"], requestedOrganizationId || undefined);
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);

  if (!resolved.canManageTeamPolicy) {
    throw new Error("Team policy management requires Team Security.");
  }

  await updateTeamPolicy({
    organizationId: context.organization.id,
    mcpAllowlist: formList(formData.get("mcpAllowlist")),
    mcpDenylist: formList(formData.get("mcpDenylist")),
    extensionAllowlist: formList(formData.get("extensionAllowlist")),
    extensionDenylist: formList(formData.get("extensionDenylist")),
    retentionDays: Number(formData.get("retentionDays") ?? 90),
  });

  revalidatePath("/team/security/policy");
}

export async function runContinuousWatchAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const guardScanId = String(formData.get("guardScanId") ?? "").trim();
  const context = await requireOrganizationRole(["owner", "admin"], requestedOrganizationId || undefined);
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);

  if (!resolved.canUseContinuousWatch) {
    throw new Error("Continuous Watch requires Team Security.");
  }

  await evaluateContinuousWatch({
    organizationId: context.organization.id,
    actorUserId: context.user.id,
    guardScanId: guardScanId || undefined,
  });

  revalidatePath("/team/security");
  revalidatePath("/team/security/baseline");
}

export async function startCloudAnalysisForReportAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const guardScanId = String(formData.get("guardScanId") ?? "").trim();
  const context = await requireOrganizationRole(["owner", "admin", "member"], requestedOrganizationId || undefined);
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);

  if (!resolved.canUseApprovedUpload || !resolved.canUseDeepCloudAnalysis) {
    throw new Error("Deep Cloud Analysis requires Security Pro.");
  }

  if (!guardScanId) {
    throw new Error("guardScanId is required.");
  }

  const scan = await prisma.guardScan.findFirst({
    where: {
      id: guardScanId,
      organizationId: context.organization.id,
    },
    select: {
      id: true,
      score: true,
      rank: true,
      scannedAt: true,
      summaryJson: true,
      categoryScoresJson: true,
      findingsJson: true,
      extensionsJson: true,
      mcpServersJson: true,
      workspaceSurfaceJson: true,
      packageManagersJson: true,
      packageScriptsJson: true,
    },
  });

  if (!scan) {
    throw new Error("Guard scan not found.");
  }

  const findings = asRecordArray(redactGuardCloudValue(scan.findingsJson));
  const mcpServers = asRecordArray(redactGuardCloudValue(scan.mcpServersJson));
  const extensions = asRecordArray(redactGuardCloudValue(scan.extensionsJson));
  const packageManagers = asStringArrayFromJson(scan.packageManagersJson);
  const packageScripts = asStringArrayFromJson(scan.packageScriptsJson);
  const filePathInventory = workspaceFilePathInventory(scan.workspaceSurfaceJson);
  const approvedPayload = {
    scanManifest: {
      scannedAt: scan.scannedAt.toISOString(),
      score: scan.score,
      rank: scan.rank,
      summary: scan.summaryJson,
      categoryScores: scan.categoryScoresJson,
    },
    redactedFindings: findings,
    dependencyMetadata: {
      packageManagers,
      packageScripts,
      riskyPackageScripts: asRecordArray((scan.workspaceSurfaceJson as Record<string, unknown> | null)?.riskyPackageScripts),
    },
    mcpMetadata: { servers: mcpServers },
    extensionMetadata: { extensions },
    filePathInventory,
    selectedPromptFiles: [],
  };

  await prisma.cloudAnalysisJob.create({
    data: {
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      guardScanId: scan.id,
      status: "succeeded",
      approvedPayloadJson: asInputJson(approvedPayload),
      resultJson: asInputJson(cloudAnalysisResultFromSavedReport({
        findings,
        mcpServers,
        extensions,
        filePathInventory,
        packageManagers,
        packageScripts,
      })),
    },
  });

  revalidatePath(`/security/reports/${guardScanId}`);
  revalidatePath("/security/reports");
}
