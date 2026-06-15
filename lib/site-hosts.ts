const fallbackAppBaseUrl = "http://localhost:3000";
const localMarketingHost = "xupra.lvh.me";
const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function parseHostValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  try {
    return normalizeHost(new URL(trimmed).host);
  } catch {
    return normalizeHost(trimmed);
  }
}

function getConfiguredAppUrl() {
  const rawValue = process.env.APP_BASE_URL?.trim() || fallbackAppBaseUrl;

  try {
    return new URL(rawValue);
  } catch {
    return new URL(fallbackAppBaseUrl);
  }
}

export function normalizeHost(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
}

export function getConfiguredAppOrigin() {
  return getConfiguredAppUrl().origin;
}

export function getConfiguredAppHost() {
  return normalizeHost(getConfiguredAppUrl().host);
}

export function getConfiguredMarketingHost() {
  const appHost = getConfiguredAppHost();

  if (!appHost || localhostHosts.has(appHost)) {
    return localMarketingHost;
  }

  if (appHost.startsWith("drylake.")) {
    return appHost.slice("drylake.".length);
  }

  return "";
}

export function getConfiguredMarketingOrigin() {
  const marketingHost = getConfiguredMarketingHost();

  if (!marketingHost) {
    return getConfiguredAppOrigin();
  }

  const appUrl = getConfiguredAppUrl();
  const port = appUrl.port ? `:${appUrl.port}` : "";

  return `${appUrl.protocol}//${marketingHost}${port}`;
}

export function getConfiguredAdminInternalHost() {
  return parseHostValue(process.env.ADMIN_INTERNAL_HOST);
}

export function getConfiguredAdminInternalOrigin() {
  const explicitOrigin = process.env.ADMIN_INTERNAL_ORIGIN?.trim();

  if (explicitOrigin) {
    try {
      return new URL(explicitOrigin).origin;
    } catch {
      // fall through to host-derived origin
    }
  }

  const host = getConfiguredAdminInternalHost();

  if (!host) {
    return "";
  }

  return `http://${host}`;
}

export function getConfiguredOperatorPortalHost() {
  return parseHostValue(
    process.env.OPERATOR_PORTAL_INTERNAL_HOST,
  );
}

export function getConfiguredOperatorPortalOrigin() {
  const explicitOperatorPortalOrigin = process.env.OPERATOR_PORTAL_INTERNAL_ORIGIN?.trim();
  const explicitAdminOrigin = process.env.ADMIN_INTERNAL_ORIGIN?.trim();

  if (explicitOperatorPortalOrigin) {
    try {
      return new URL(explicitOperatorPortalOrigin).origin;
    } catch {
      // fall through to host-derived origin
    }
  }

  if (explicitAdminOrigin) {
    try {
      return new URL(explicitAdminOrigin).origin;
    } catch {
      // fall through to host-derived origin
    }
  }

  const host = getConfiguredOperatorPortalHost();

  if (!host) {
    return "";
  }

  return `http://${host}`;
}

export function isConfiguredAppHost(value: string | null | undefined) {
  return normalizeHost(value) === getConfiguredAppHost();
}

export function isConfiguredMarketingHost(value: string | null | undefined) {
  const normalized = normalizeHost(value);
  const marketingHost = getConfiguredMarketingHost();

  if (!marketingHost) {
    return false;
  }

  return normalized === marketingHost || normalized === `www.${marketingHost}`;
}

export function isConfiguredAdminInternalHost(value: string | null | undefined) {
  const normalized = normalizeHost(value);
  const configuredAdminHost = getConfiguredAdminInternalHost();

  if (!configuredAdminHost) {
    return false;
  }

  return normalized === configuredAdminHost;
}

export function isConfiguredOperatorPortalHost(value: string | null | undefined) {
  const normalized = normalizeHost(value);
  const configuredOperatorPortalHost = getConfiguredOperatorPortalHost();

  if (configuredOperatorPortalHost && normalized === configuredOperatorPortalHost) {
    return true;
  }

  return isConfiguredAdminInternalHost(normalized);
}

export function getConfiguredAppUrlForPath(pathname = "/", search = "") {
  const target = new URL(pathname, getConfiguredAppUrl());

  if (search) {
    target.search = search.startsWith("?") ? search.slice(1) : search;
  }

  return target.toString();
}
