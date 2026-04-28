import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import {
  getConfiguredAppUrlForPath,
  isConfiguredAdminInternalHost,
  isConfiguredMarketingHost,
} from "./lib/site-hosts";

const adminPathPrefix = "/admin";

function getInternalAdminCredentials() {
  const username = process.env.ADMIN_INTERNAL_BASIC_AUTH_USERNAME?.trim() ?? "";
  const password = process.env.ADMIN_INTERNAL_BASIC_AUTH_PASSWORD?.trim() ?? "";

  return {
    username,
    password,
    configured: Boolean(username && password),
  };
}

function hasValidBasicAuthHeader(value: string | null, expectedUsername: string, expectedPassword: string) {
  if (!value) {
    return false;
  }

  const [scheme, encoded] = value.split(" ");

  if (!encoded || scheme?.toLowerCase() !== "basic") {
    return false;
  }

  let decoded = "";

  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return username === expectedUsername && password === expectedPassword;
}

function handleProxyRequest(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isConfiguredAdminInternalHost(host)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL(`${adminPathPrefix}${request.nextUrl.search}`, request.url));
    }

    if (!pathname.startsWith(adminPathPrefix)) {
      return NextResponse.redirect(new URL(`${adminPathPrefix}${request.nextUrl.search}`, request.url));
    }

    const credentials = getInternalAdminCredentials();

    if (!credentials.configured) {
      return new NextResponse("Internal admin is not configured.", {
        status: 503,
      });
    }

    const isAuthorized = hasValidBasicAuthHeader(
      request.headers.get("authorization"),
      credentials.username,
      credentials.password,
    );

    if (!isAuthorized) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Xupra Internal Admin"',
        },
      });
    }

    return NextResponse.next();
  }

  if (pathname.startsWith(adminPathPrefix)) {
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
