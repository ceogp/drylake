import { headers } from "next/headers";

import { isConfiguredOperatorPortalHost } from "@/lib/site-hosts";

export const ADMIN_PATH_PREFIX = "/admin";
export const ADMIN_API_PATH_PREFIX = "/api/v1/admin";
export const OPERATOR_PORTAL_PATH_PREFIX = "/portal";
export const OPERATOR_PORTAL_API_PATH_PREFIX = "/api/v1/portal";

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminPagePath(pathname: string) {
  return matchesPathPrefix(pathname, ADMIN_PATH_PREFIX);
}

export function isAdminApiPath(pathname: string) {
  return matchesPathPrefix(pathname, ADMIN_API_PATH_PREFIX);
}

export function isOperatorPortalPagePath(pathname: string) {
  return matchesPathPrefix(pathname, OPERATOR_PORTAL_PATH_PREFIX);
}

export function isOperatorPortalApiPath(pathname: string) {
  return matchesPathPrefix(pathname, OPERATOR_PORTAL_API_PATH_PREFIX);
}

function replacePathPrefix(pathname: string, fromPrefix: string, toPrefix: string) {
  if (pathname === fromPrefix) {
    return toPrefix;
  }

  if (!pathname.startsWith(`${fromPrefix}/`)) {
    return pathname;
  }

  return `${toPrefix}${pathname.slice(fromPrefix.length)}`;
}

export function toOperatorPortalPagePath(pathname: string) {
  if (isOperatorPortalPagePath(pathname)) {
    return pathname;
  }

  return replacePathPrefix(pathname, ADMIN_PATH_PREFIX, OPERATOR_PORTAL_PATH_PREFIX);
}

export function toOperatorPortalApiPath(pathname: string) {
  if (isOperatorPortalApiPath(pathname)) {
    return pathname;
  }

  return replacePathPrefix(pathname, ADMIN_API_PATH_PREFIX, OPERATOR_PORTAL_API_PATH_PREFIX);
}

type AdminAuthResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 404 | 503;
      message: string;
      headers?: Record<string, string>;
    };

export function getInternalAdminCredentials() {
  const username =
    process.env.OPERATOR_PORTAL_BASIC_AUTH_USERNAME?.trim() ??
    process.env.ADMIN_INTERNAL_BASIC_AUTH_USERNAME?.trim() ??
    "";
  const password =
    process.env.OPERATOR_PORTAL_BASIC_AUTH_PASSWORD?.trim() ??
    process.env.ADMIN_INTERNAL_BASIC_AUTH_PASSWORD?.trim() ??
    "";

  return {
    username,
    password,
    configured: Boolean(username && password),
  };
}

export function hasValidBasicAuthHeader(
  value: string | null,
  expectedUsername: string,
  expectedPassword: string,
) {
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

export function getAdminRequestAuthResult(headers: Headers): AdminAuthResult {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");

  if (!isConfiguredOperatorPortalHost(host)) {
    return {
      ok: false,
      status: 404,
      message: "Not found",
    };
  }

  const credentials = getInternalAdminCredentials();

  if (!credentials.configured) {
    return {
      ok: false,
      status: 503,
      message: "Internal admin is not configured.",
    };
  }

  const isAuthorized = hasValidBasicAuthHeader(
    headers.get("authorization"),
    credentials.username,
    credentials.password,
  );

  if (!isAuthorized) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
      headers: {
        "WWW-Authenticate": 'Basic realm="Xupra Operator Portal"',
      },
    };
  }

  return { ok: true };
}

export async function requireAdminActionAccess() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!isConfiguredOperatorPortalHost(host)) {
    throw new Error("Unauthorized: operator actions require the internal portal host.");
  }

  const credentials = getInternalAdminCredentials();

  if (!credentials.configured) {
    throw new Error("Admin is not configured.");
  }

  const authorization = requestHeaders.get("authorization");
  const isAuthorized = hasValidBasicAuthHeader(
    authorization,
    credentials.username,
    credentials.password,
  );

  if (!isAuthorized) {
    throw new Error("Unauthorized: valid Basic Auth required.");
  }

  const encodedCredentials = authorization?.split(" ")[1] ?? "";
  const decodedCredentials = atob(encodedCredentials);
  const separatorIndex = decodedCredentials.indexOf(":");

  return decodedCredentials.slice(0, separatorIndex);
}
