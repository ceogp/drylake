import type { Organization, Profile, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils/slug";

type DevSessionInput = {
  email: string;
  displayName: string;
};

type AppSessionInput = DevSessionInput & {
  authProvider: string;
  authSubject?: string | null;
};

type SessionUser = User & {
  memberships: Array<{
    organizationId: string;
    role: string;
    organization: Organization;
  }>;
  profile: Profile | null;
};

async function loadUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
      profile: true,
    },
  });
}

async function finalizeSessionUser(email: string) {
  const user = await loadUserByEmail(email);

  if (!user) {
    throw new Error("Failed to finalize session user");
  }

  return user as SessionUser;
}

function buildOrgSlug(displayName: string, email: string) {
  const base = toSlug(displayName || email.split("@")[0]) || "xupra";
  return `${base}-org`;
}

export async function ensureDevSession(input: DevSessionInput): Promise<{
  user: SessionUser;
  organization: Organization;
}> {
  return ensureAppSession({
    ...input,
    authProvider: "dev",
  });
}

export async function ensureAppSession(input: AppSessionInput): Promise<{
  user: SessionUser;
  organization: Organization;
}> {
  const existingUser = await loadUserByEmail(input.email);

  if (existingUser?.memberships[0]?.organization) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        authProvider: input.authProvider,
        authSubject: input.authSubject ?? null,
      },
    });

    await prisma.profile.upsert({
      where: { userId: existingUser.id },
      update: {
        displayName: input.displayName,
      },
      create: {
        userId: existingUser.id,
        displayName: input.displayName,
      },
    });

    const refreshed = await finalizeSessionUser(input.email);
    return {
      user: refreshed,
      organization: refreshed.memberships[0].organization,
    };
  }

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: input.email,
        authProvider: input.authProvider,
        authSubject: input.authSubject ?? null,
        status: "active",
      },
    }));

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        authProvider: input.authProvider,
        authSubject: input.authSubject ?? null,
      },
    });
  }

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      displayName: input.displayName,
    },
    create: {
      userId: user.id,
      displayName: input.displayName,
    },
  });

  const organization = await prisma.organization.upsert({
    where: {
      slug: buildOrgSlug(input.displayName, input.email),
    },
    update: {
      name: `${input.displayName}'s Org`,
    },
    create: {
      name: `${input.displayName}'s Org`,
      slug: buildOrgSlug(input.displayName, input.email),
      tier: "free",
      status: "active",
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
      },
      entitlementsJson: {
        manual_export: false,
        deployment_jobs: false,
        credential_vault: false,
        slack_controls: false,
        advanced_reporting: false,
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
      },
      entitlementsJson: {
        manual_export: false,
        deployment_jobs: false,
        credential_vault: false,
        slack_controls: false,
        advanced_reporting: false,
      },
    },
  });

  const refreshed = await finalizeSessionUser(input.email);

  return { user: refreshed, organization };
}
