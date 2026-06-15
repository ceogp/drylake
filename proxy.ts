import { NextResponse, type NextRequest } from "next/server";

import {
  OPERATOR_PORTAL_PATH_PREFIX,
  getAdminRequestAuthResult,
  isAdminApiPath,
  isAdminPagePath,
  isOperatorPortalApiPath,
  isOperatorPortalPagePath,
  toOperatorPortalApiPath,
  toOperatorPortalPagePath,
} from "./lib/admin-auth";
import {
  getConfiguredAppUrlForPath,
  isConfiguredMarketingHost,
  isConfiguredOperatorPortalHost,
} from "./lib/site-hosts";
import {
  XUPRA_PUBLIC_PATH_HEADER,
  XUPRA_PUBLIC_SECTION_HEADER,
  XUPRA_PUBLIC_SECTION_KYA_VALUE,
  XUPRA_PUBLIC_SECTION_PRODUCTS_VALUE,
  canonicalKyaRegistryPath,
  isKyaRegistryAliasPath,
  isKyaRegistryPublicPath,
  isXupraProductsPublicPath,
} from "./KYAregistry/routing";

function isAdminAllowedHost(host: string | null) {
  return isConfiguredOperatorPortalHost(host);
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

function continueAsXupraPublicRequest(request: NextRequest, section: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(XUPRA_PUBLIC_SECTION_HEADER, section);
  requestHeaders.set(XUPRA_PUBLIC_PATH_HEADER, request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function handleProxyRequest(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isAdminAllowedHost(host)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL(`${OPERATOR_PORTAL_PATH_PREFIX}${request.nextUrl.search}`, request.url));
    }

    if (isAdminPagePath(pathname)) {
      return NextResponse.redirect(
        new URL(`${toOperatorPortalPagePath(pathname)}${request.nextUrl.search}`, request.url),
      );
    }

    if (isAdminApiPath(pathname)) {
      return NextResponse.redirect(
        new URL(`${toOperatorPortalApiPath(pathname)}${request.nextUrl.search}`, request.url),
      );
    }

    if (!isOperatorPortalPagePath(pathname) && !isOperatorPortalApiPath(pathname)) {
      return NextResponse.redirect(new URL(`${OPERATOR_PORTAL_PATH_PREFIX}${request.nextUrl.search}`, request.url));
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

  if (
    isOperatorPortalPagePath(pathname) ||
    isOperatorPortalApiPath(pathname) ||
    isAdminPagePath(pathname) ||
    isAdminApiPath(pathname)
  ) {
    return notFound();
  }

  if (isKyaRegistryAliasPath(pathname)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = canonicalKyaRegistryPath(pathname);
    return NextResponse.redirect(canonicalUrl);
  }

  if (isKyaRegistryPublicPath(pathname)) {
    return continueAsXupraPublicRequest(request, XUPRA_PUBLIC_SECTION_KYA_VALUE);
  }

  if (isXupraProductsPublicPath(pathname)) {
    return continueAsXupraPublicRequest(request, XUPRA_PUBLIC_SECTION_PRODUCTS_VALUE);
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

export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isAdminAllowedHost(host) || isAdminPagePath(pathname) || isAdminApiPath(pathname)) {
    return handleProxyRequest(request);
  }
  
  return handleProxyRequest(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
