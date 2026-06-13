import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";
import { createAppSession, recordAuthEvent } from "@/lib/services/app-session";
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

function redirectToPath(pathname: string) {
  return NextResponse.redirect(getConfiguredAppUrlForPath(pathname));
}

export async function GET(request: NextRequest) {
  let email: string | null = null;
  let authSubject: string | null = null;
  let returnTo = "/workspace";
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

    return redirectToPath(returnTo);
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
