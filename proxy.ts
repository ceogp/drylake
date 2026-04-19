import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getConfiguredAppUrlForPath, isConfiguredMarketingHost } from "./lib/site-hosts";

export default clerkMiddleware((auth, request) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!isConfiguredMarketingHost(host)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    getConfiguredAppUrlForPath(request.nextUrl.pathname, request.nextUrl.search),
  );
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
