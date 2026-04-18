import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Organization, Profile, User } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ensureAppSession } from "@/lib/services/dev-session";

export const ACTIVE_ORGANIZATION_COOKIE = "xupra_active_organization_id";

export type SessionUser = User & {
  memberships: Array<{
    organizationId: string;
    role: string;
    organization: Organization;
  }>;
  profile: Profile | null;
};

export type AppContext = {
  user: SessionUser;
  memberships: SessionUser["memberships"];
  activeMembership: SessionUser["memberships"][number];
  organization: Organization;
};

function shouldUseClerk() {
  return Boolean(
    env.AUTH_MODE === "clerk" || (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY),
  );
}

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
  }) as Promise<SessionUser | null>;
}

async function getClerkBackedUser() {
  if (!shouldUseClerk()) {
    return null;
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const primaryEmail =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Signed-in Clerk user does not have an email address.");
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    primaryEmail.split("@")[0] ||
    env.DEFAULT_DEV_USER_NAME;

  const session = await ensureAppSession({
    email: primaryEmail,
    displayName,
    authProvider: "clerk",
    authSubject: userId,
  });

  return session.user;
}

async function getDevFallbackUser() {
  return loadUserByEmail(env.DEFAULT_DEV_USER_EMAIL);
}

async function pickActiveMembership(user: SessionUser) {
  if (user.memberships.length === 0) {
    throw new Error("Current user does not belong to an organization.");
  }

  const cookieStore = await cookies();
  const preferredOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeMembership =
    user.memberships.find((membership) => membership.organizationId === preferredOrganizationId) ??
    user.memberships[0];

  return activeMembership;
}

export async function getCurrentUser(options?: {
  allowDevFallback?: boolean;
}) {
  const clerkUser = await getClerkBackedUser();

  if (clerkUser) {
    return clerkUser;
  }

  if (options?.allowDevFallback ?? !shouldUseClerk()) {
    return getDevFallbackUser();
  }

  return null;
}

export async function requireCurrentUser(options?: {
  allowDevFallback?: boolean;
}) {
  const user = await getCurrentUser(options);

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}

export async function getCurrentAppContext(options?: {
  allowDevFallback?: boolean;
}) {
  const user = await getCurrentUser(options);

  if (!user) {
    return null;
  }

  const activeMembership = await pickActiveMembership(user);

  return {
    user,
    memberships: user.memberships,
    activeMembership,
    organization: activeMembership.organization,
  } satisfies AppContext;
}

export async function requireCurrentAppContext(options?: {
  allowDevFallback?: boolean;
}) {
  const context = await getCurrentAppContext(options);

  if (!context) {
    throw new Error("Authentication required");
  }

  return context;
}

export async function requireCurrentAppContextForPage() {
  const context = await getCurrentAppContext();

  if (!context) {
    redirect(env.CLERK_SIGN_IN_URL ?? "/");
  }

  return context;
}

export async function setActiveOrganizationCookie(organizationId: string) {
  const context = await requireCurrentAppContext();
  const membership = context.memberships.find((item) => item.organizationId === organizationId);

  if (!membership) {
    throw new Error("Cannot activate an organization the user does not belong to.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getDefaultUser() {
  const user = await getCurrentUser({ allowDevFallback: true });

  if (!user) {
    throw new Error("Default development user not found. Run the seed flow first.");
  }

  return user;
}

export async function getDefaultOrganization() {
  const context = await requireCurrentAppContext({ allowDevFallback: true });
  return context.organization;
}
