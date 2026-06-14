import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";
import { prisma } from "@/lib/prisma";
import {
  APP_SESSION_COOKIE,
  createAppSession,
  getAppSessionCookieOptions,
  recordAuthEvent,
} from "@/lib/services/app-session";
import {
  consumeCognitoAuthState,
  exchangeCognitoCode,
  verifyCognitoIdToken,
} from "@/lib/services/cognito-auth";
import { ensureAppSession } from "@/lib/services/dev-session";

export const dynamic = "force-dynamic";

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Cognito authentication failed.";
}

function redirectToPath(pathname: string, sessionToken?: string) {
  const response = NextResponse.redirect(getConfiguredAppUrlForPath(pathname));

  if (sessionToken) {
    response.cookies.set(APP_SESSION_COOKIE, sessionToken, getAppSessionCookieOptions());
  }

  return response;
}

function onboardingPath(returnTo: string) {
  const params = new URLSearchParams({ returnTo });
  return `/onboarding/profile?${params.toString()}`;
}

function needsOnboarding(profile: {
  country?: string | null;
  onboardingCompletedAt?: Date | null;
} | null) {
  return !profile?.onboardingCompletedAt || !profile.country;
}

export async function GET(request: NextRequest) {
  let email: string | null = null;
  let authSubject: string | null = null;
  let returnTo = "/skills";
  let mode: "sign-in" | "sign-up" = "sign-in";

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const providerError =
      request.nextUrl.searchParams.get("error_description") ??
      request.nextUrl.searchParams.get("error");
    const authState = await consumeCognitoAuthState(state);
    returnTo = authState.returnTo;
    mode = authState.mode;

    if (providerError) {
      throw new Error(providerError);
    }

    if (!code) {
      throw new Error("Cognito callback did not include an authorization code.");
    }

    const tokenResponse = await exchangeCognitoCode(code, authState);
    const identity = await verifyCognitoIdToken(tokenResponse.id_token, authState.nonce);
    email = identity.email;
    authSubject = identity.sub;

    const sessionUser = await ensureAppSession({
      email: identity.email,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      authProvider: "cognito",
      authSubject: identity.sub,
    });
    const appSession = await createAppSession({
      userId: sessionUser.user.id,
      organizationId: sessionUser.organization.id,
      authProvider: "cognito",
      authSubject: identity.sub,
      metadataJson: {
        mode,
        tokenType: tokenResponse.token_type ?? null,
        expiresIn: tokenResponse.expires_in ?? null,
      },
    });

    await prisma.productAccount.upsert({
      where: {
        userId_productKey: {
          userId: sessionUser.user.id,
          productKey: "drylake",
        },
      },
      update: {
        organizationId: sessionUser.organization.id,
        status: "active",
        lastSeenAt: new Date(),
      },
      create: {
        userId: sessionUser.user.id,
        organizationId: sessionUser.organization.id,
        productKey: "drylake",
        status: "active",
        planIntent: sessionUser.user.profile?.signupPlanIntent ?? null,
        onboardingCompletedAt: sessionUser.user.profile?.onboardingCompletedAt ?? null,
        lastSeenAt: new Date(),
      },
    });

    await recordAuthEvent({
      eventName: mode === "sign-up" ? "auth.cognito.sign_up" : "auth.cognito.sign_in",
      organizationId: sessionUser.organization.id,
      actorUserId: sessionUser.user.id,
      authProvider: "cognito",
      authSubject: identity.sub,
      email: identity.email,
      metadataJson: {
        appSessionId: appSession.session.id,
        returnTo,
      },
    });

    if (mode === "sign-up" || needsOnboarding(sessionUser.user.profile)) {
      return redirectToPath(onboardingPath(returnTo), appSession.token);
    }

    return redirectToPath(returnTo, appSession.token);
  } catch (error) {
    await recordAuthEvent({
      eventName: "auth.cognito.failed",
      authProvider: "cognito",
      authSubject,
      email,
      success: false,
      failureReason: messageFromError(error),
      metadataJson: {
        mode,
        returnTo,
      },
    });

    const url = new URL(getConfiguredAppUrlForPath("/sign-in"));
    url.searchParams.set("error", "cognito");
    url.searchParams.set("redirect_url", returnTo);
    return NextResponse.redirect(url);
  }
}
