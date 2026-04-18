"use server";

import type { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/services/billing";
import {
  requireCredentialAccess,
  requireIntegrationAccess,
  requireOrganizationRole,
  requirePackageAccess,
  requireProjectAccess,
  requireVersionAccess,
} from "@/lib/services/access";
import { createCredential, verifyCredential } from "@/lib/services/credentials";
import { setActiveOrganizationCookie } from "@/lib/services/current-user";
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

export async function createCheckoutAction(formData: FormData) {
  const requestedOrganizationId = String(formData.get("organizationId") ?? "").trim();
  const context = await requireOrganizationRole(
    ["owner", "admin"],
    requestedOrganizationId || undefined,
  );
  const organizationId = requestedOrganizationId || context.organization.id;
  const plan = String(formData.get("plan") ?? "pro").trim() as "pro" | "enterprise";

  if (!organizationId) {
    return;
  }

  const session = await createCheckoutSession({
    organizationId,
    userEmail: context.user.email,
    priceLookup: plan,
  });

  if (session.configured && session.url) {
    redirect(session.url);
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

  if (!organizationId) {
    return;
  }

  const session = await createBillingPortalSession({
    organizationId,
  });

  if (session.configured && session.url) {
    redirect(session.url);
  }

  revalidatePath("/billing");
}
