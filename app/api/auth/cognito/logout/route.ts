import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildCognitoLogoutUrl, sanitizeAuthReturnTo } from "@/lib/services/cognito-auth";
import { revokeCurrentAppSession } from "@/lib/services/app-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const returnTo = sanitizeAuthReturnTo(request.nextUrl.searchParams.get("returnTo") ?? "/");
  await revokeCurrentAppSession({
    eventName: "auth.cognito.sign_out",
  });

  const logoutUrl = buildCognitoLogoutUrl(returnTo);
  return NextResponse.redirect(logoutUrl.startsWith("/") ? new URL(logoutUrl, request.url) : logoutUrl);
}
