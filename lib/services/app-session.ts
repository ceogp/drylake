import { createHash, randomBytes } from "node:crypto";

import type { Organization, Prisma, Profile, User } from "@prisma/client";
import { cookies, headers } from "next/headers";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getAppEncryptionSecret } from "@/lib/security/runtime-secrets";

export const APP_SESSION_COOKIE = "drylake_app_session";

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;
const SESSION_TOKEN_BYTES = 32;

type SessionUser = User & {
  memberships: Array<{
    organizationId: string;
    role: string;
    organization: Organization;
  }>;
  profile: Profile | null;
};

export type AppSessionContext = {
  sessionId: string;
  user: SessionUser;
  organizationId: string;
  authProvider: string;
  authSubject?: string | null;
};

function newSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashSensitiveValue(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const secret = await getAppEncryptionSecret();
  return createHash("sha256").update(`${normalized}:${secret}`).digest("hex");
}

export function getClientIpFromHeaders(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    headerStore.get("cf-connecting-ip") ||
    headerStore.get("x-real-ip") ||
    null
  );
}

export async function getRequestMetadata() {
  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);

  return {
    ipHash: await hashSensitiveValue(ip),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
    country: headerStore.get("cf-ipcountry")?.slice(0, 8) ?? null,
  };
}

export async function recordAuthEvent(input: {
  eventName: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  authProvider?: string | null;
  authSubject?: string | null;
  email?: string | null;
  success?: boolean;
  failureReason?: string | null;
  metadataJson?: Prisma.InputJsonObject;
}) {
  const metadata = await getRequestMetadata().catch(() => ({
    ipHash: null,
    userAgent: null,
    country: null,
  }));

  await prisma.authEvent
    .create({
      data: {
        eventName: input.eventName,
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        authProvider: input.authProvider ?? null,
        authSubject: input.authSubject ?? null,
        email: input.email ?? null,
        ipHash: metadata.ipHash,
        userAgent: metadata.userAgent,
        country: metadata.country,
        success: input.success ?? true,
        failureReason: input.failureReason ?? null,
        metadataJson: input.metadataJson ?? undefined,
      },
    })
    .catch((error) => {
      console.warn("[auth-event] failed to record event", {
        eventName: input.eventName,
        error,
      });
    });
}

export async function setAppSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, token, getAppSessionCookieOptions());
}

export function getAppSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  } as const;
}

export async function clearAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

export async function createAppSession(input: {
  userId: string;
  organizationId: string;
  authProvider: string;
  authSubject?: string | null;
  metadataJson?: Prisma.InputJsonObject;
}) {
  const token = newSessionToken();
  const requestMetadata = await getRequestMetadata().catch(() => ({
    ipHash: null,
    userAgent: null,
    country: null,
  }));

  const session = await prisma.appSession.create({
    data: {
      sessionTokenHash: hashToken(token),
      userId: input.userId,
      organizationId: input.organizationId,
      authProvider: input.authProvider,
      authSubject: input.authSubject ?? null,
      ipHash: requestMetadata.ipHash,
      userAgent: requestMetadata.userAgent,
      country: requestMetadata.country,
      metadataJson: input.metadataJson ?? undefined,
    },
  });

  await setAppSessionCookie(token);

  return {
    token,
    session,
  };
}

export async function getAppSessionContext(): Promise<AppSessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.appSession.findUnique({
    where: {
      sessionTokenHash: hashToken(token),
    },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true,
            },
          },
          profile: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) {
    await clearAppSessionCookie();
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    await clearAppSessionCookie();
    return null;
  }

  if (session.user.status !== "active") {
    await clearAppSessionCookie();
    return null;
  }

  await prisma.appSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => null);

  return {
    sessionId: session.id,
    user: session.user as SessionUser,
    organizationId: session.organizationId,
    authProvider: session.authProvider,
    authSubject: session.authSubject,
  };
}

export async function revokeCurrentAppSession(input?: {
  revokedByUserId?: string | null;
  eventName?: string;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.appSession.findUnique({
    where: {
      sessionTokenHash: hashToken(token),
    },
  });

  if (session && !session.revokedAt) {
    await prisma.appSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedByUserId: input?.revokedByUserId ?? null,
      },
    });
  }

  await clearAppSessionCookie();

  if (session) {
    await recordAuthEvent({
      eventName: input?.eventName ?? "auth.session.revoked",
      organizationId: session.organizationId,
      actorUserId: session.userId,
      authProvider: session.authProvider,
      authSubject: session.authSubject,
    });
  }

  return session;
}
