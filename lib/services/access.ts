import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireCurrentAppContext } from "@/lib/services/current-user";

function platformAdminEmails() {
  const configured = env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return [env.DEFAULT_DEV_USER_EMAIL.toLowerCase()];
}

export function isPlatformAdminEmail(email: string) {
  const configured = platformAdminEmails();
  if (configured.includes("*")) {
    return true;
  }

  return configured.includes(email.trim().toLowerCase());
}

export async function getIsPlatformAdmin() {
  const user = await getCurrentUser({ allowDevFallback: true });
  return user ? isPlatformAdminEmail(user.email) : false;
}

export async function requirePlatformAdmin() {
  const context = await requireCurrentAppContext({ allowDevFallback: true });

  if (!isPlatformAdminEmail(context.user.email)) {
    throw new Error("Forbidden");
  }

  return context;
}

export async function requireOrganizationAccess(requestedOrganizationId?: string) {
  const context = await requireCurrentAppContext();

  if (!requestedOrganizationId) {
    return context;
  }

  const membership = context.memberships.find(
    (item) => item.organizationId === requestedOrganizationId,
  );

  if (!membership) {
    throw new Error("Forbidden");
  }

  return {
    ...context,
    activeMembership: membership,
    organization: membership.organization,
  };
}

export async function requireOrganizationRole(
  roles: string[],
  requestedOrganizationId?: string,
) {
  const context = await requireOrganizationAccess(requestedOrganizationId);

  if (!roles.includes(context.activeMembership.role)) {
    throw new Error("Forbidden");
  }

  return context;
}

export async function requireProjectAccess(projectId: string) {
  const context = await requireCurrentAppContext();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: context.organization.id,
    },
  });

  if (!project) {
    throw new Error("Forbidden");
  }

  return { context, project };
}

export async function requirePackageAccess(packageId: string) {
  const context = await requireCurrentAppContext();
  const agentPackage = await prisma.agentPackage.findFirst({
    where: {
      id: packageId,
      project: {
        organizationId: context.organization.id,
      },
    },
    include: {
      project: true,
    },
  });

  if (!agentPackage) {
    throw new Error("Forbidden");
  }

  return { context, agentPackage };
}

export async function requireVersionAccess(versionId: string) {
  const context = await requireCurrentAppContext();
  const version = await prisma.packageVersion.findFirst({
    where: {
      id: versionId,
      agentPackage: {
        project: {
          organizationId: context.organization.id,
        },
      },
    },
    include: {
      agentPackage: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!version) {
    throw new Error("Forbidden");
  }

  return { context, version };
}

export async function requireCredentialAccess(credentialId: string) {
  const context = await requireCurrentAppContext();
  const credential = await prisma.credential.findFirst({
    where: {
      id: credentialId,
      organizationId: context.organization.id,
    },
  });

  if (!credential) {
    throw new Error("Forbidden");
  }

  return { context, credential };
}

export async function requireIntegrationAccess(integrationId: string) {
  const context = await requireCurrentAppContext();
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      organizationId: context.organization.id,
    },
  });

  if (!integration) {
    throw new Error("Forbidden");
  }

  return { context, integration };
}
