const fallbackAppBaseUrl = "http://localhost:3000";
const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

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
    return "";
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

  return `${getConfiguredAppUrl().protocol}//${marketingHost}`;
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

export function getConfiguredAppUrlForPath(pathname = "/", search = "") {
  const target = new URL(pathname, getConfiguredAppUrl());

  if (search) {
    target.search = search.startsWith("?") ? search.slice(1) : search;
  }

  return target.toString();
}
