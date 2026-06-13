import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildCognitoAuthorizeUrl, sanitizeAuthReturnTo } from "@/lib/services/cognito-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in";
  const returnTo = sanitizeAuthReturnTo(
    request.nextUrl.searchParams.get("returnTo") ??
      request.nextUrl.searchParams.get("redirect_url") ??
      "/billing?welcome=1",
  );

  const authorizeUrl = await buildCognitoAuthorizeUrl({
    mode,
    returnTo,
  });

  return NextResponse.redirect(authorizeUrl);
}
