export const KYA_REGISTRY_PATH_PREFIX = "/kya-registry";
export const KYA_REGISTRY_ALIAS_PATH_PREFIX = "/kys-registry";
export const XUPRA_PUBLIC_SECTION_HEADER = "x-xupra-public-section";
export const XUPRA_PUBLIC_PATH_HEADER = "x-xupra-public-path";
export const XUPRA_PUBLIC_SECTION_KYA_VALUE = "kya-registry";
export const XUPRA_PUBLIC_SECTION_PRODUCTS_VALUE = "products";

export function isKyaRegistryAliasPath(pathname: string) {
  return pathname === KYA_REGISTRY_ALIAS_PATH_PREFIX || pathname.startsWith(`${KYA_REGISTRY_ALIAS_PATH_PREFIX}/`);
}

export function canonicalKyaRegistryPath(pathname: string) {
  if (!isKyaRegistryAliasPath(pathname)) {
    return pathname;
  }

  return `${KYA_REGISTRY_PATH_PREFIX}${pathname.slice(KYA_REGISTRY_ALIAS_PATH_PREFIX.length)}`;
}

export function isKyaRegistryPublicPath(pathname: string) {
  return (
    pathname === KYA_REGISTRY_PATH_PREFIX ||
    pathname.startsWith(`${KYA_REGISTRY_PATH_PREFIX}/`) ||
    isKyaRegistryAliasPath(pathname) ||
    pathname === "/survey/kya" ||
    pathname.startsWith("/survey/kya/") ||
    pathname.startsWith("/api/kya-registry/") ||
    pathname.startsWith("/api/trust/v1/surveys/kya/")
  );
}

export function isXupraProductsPublicPath(pathname: string) {
  return pathname === "/products" || pathname.startsWith("/products/");
}
