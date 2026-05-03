import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import {
  ADMIN_PATH_PREFIX,
  getAdminRequestAuthResult,
  isAdminApiPath,
  isAdminPagePath,
} from "./lib/admin-auth";
import {
  getConfiguredAppUrlForPath,
  isConfiguredAdminInternalHost,
  isConfiguredMarketingHost,
} from "./lib/site-hosts";

function handleProxyRequest(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isConfiguredAdminInternalHost(host)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL(`${ADMIN_PATH_PREFIX}${request.nextUrl.search}`, request.url));
    }

    if (!isAdminPagePath(pathname) && !isAdminApiPath(pathname)) {
      return NextResponse.redirect(new URL(`${ADMIN_PATH_PREFIX}${request.nextUrl.search}`, request.url));
    }

    const authResult = getAdminRequestAuthResult(request.headers);

    if (!authResult.ok) {
      return new NextResponse(authResult.message, {
        status: authResult.status,
        headers: authResult.headers,
      });
    }

    return NextResponse.next();
  }

  if (isAdminPagePath(pathname) || isAdminApiPath(pathname)) {
    return NextResponse.redirect(getConfiguredAppUrlForPath("/", ""));
  }

  if (!isConfiguredMarketingHost(host)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    getConfiguredAppUrlForPath(request.nextUrl.pathname, request.nextUrl.search),
  );
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isConfiguredAdminInternalHost(host) || isAdminPagePath(pathname) || isAdminApiPath(pathname)) {
    return handleProxyRequest(request);
  }

  const clerkConfigured = Boolean(
    process.env.AUTH_MODE === "clerk" &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );

  if (!clerkConfigured) {
    return handleProxyRequest(request);
  }

  return clerkMiddleware((_auth, clerkRequest) => handleProxyRequest(clerkRequest))(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
