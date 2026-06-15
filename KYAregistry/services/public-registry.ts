import { getTrustCertificatePublicKeyPem } from "@/KYAregistry/services/certificates";
import { getCertifiedOperationalBindingDetails } from "@/KYAregistry/services/handshake";
import { getPublishedTrustPolicies } from "@/KYAregistry/services/trust-policy";
import { TRUST_REGISTRY_PRODUCT_NAME } from "@/KYAregistry/services/registry";
import { prisma } from "@/lib/prisma";

const riskClassOrder = ["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"] as const;
const kyaLevelOrder = ["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"] as const;

const assetTypeLabels: Record<string, string> = {
  mcp_server: "MCP Server",
  agent: "Agent",
  agent_card: "Agent Card",
  tool_gateway: "Tool Gateway",
  package: "Package",
  repository: "Repository",
};

const protocolLabels: Record<string, string> = {
  stdio: "stdio",
  streamable_http: "Streamable HTTP",
  http: "HTTP",
  https: "HTTPS",
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function fetchPublicRegistryCases(now: Date) {
  return prisma.trustRegistryCase.findMany({
    where: {
      publicListingEnabled: true,
      certificates: {
        some: {
          status: "active",
          expiresAt: { gt: now },
        },
      },
    },
    include: {
      company: true,
      assets: true,
      certificates: {
        where: {
          status: "active",
          expiresAt: { gt: now },
        },
        orderBy: { issuedAt: "desc" },
      },
      standard: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export type PublicRegistryQuery = {
  q?: string;
  type?: string;
  risk?: string;
  kya?: string;
  protocol?: string;
};

export type PublicRegistryFacet = {
  value: string;
  label: string;
  count: number;
};

export type PublicRegistrySummary = {
  results: number;
  companies: number;
  assets: number;
  certificates: number;
  protocols: number;
};

type PublicRegistryListingRecord = {
  id: string;
  caseId: string;
  caseNumber: string;
  companyName: string;
  websiteUrl: string | null;
  companyDomain: string | null;
  rippleEcosystemScope: string | null;
  standard: {
    title: string | null;
    version: string | null;
  };
  updatedAt: string;
  asset: {
    id: string;
    type: string;
    typeLabel: string;
    name: string;
    protocol: string | null;
    protocolLabel: string | null;
    agentCardUrl: string | null;
    endpointUrl: string | null;
    repositoryUrl: string | null;
    packageName: string | null;
    sourceUrl: string | null;
    did: string | null;
    description: string | null;
  };
  certificate: {
    certificateId: string;
    status: string;
    riskClass: string | null;
    kyaLevel: string | null;
    issuedAt: string;
    expiresAt: string;
    publicUrl: string | null;
    badgeUrl: string | null;
    apiUrl: string;
  };
  searchText: string;
};

export type PublicRegistryListing = Omit<PublicRegistryListingRecord, "searchText">;

export type PublicRegistryExplorer = {
  query: PublicRegistryQuery;
  totalSummary: PublicRegistrySummary;
  filteredSummary: PublicRegistrySummary;
  facets: {
    assetTypes: PublicRegistryFacet[];
    riskClasses: PublicRegistryFacet[];
    kyaLevels: PublicRegistryFacet[];
    protocols: PublicRegistryFacet[];
  };
  entries: PublicRegistryListing[];
};

type PublicRegistryCaseRow = Awaited<ReturnType<typeof fetchPublicRegistryCases>>[number];

function certificateIsUsable(input: {
  status: string;
  expiresAt: Date;
}) {
  return input.status === "active" && input.expiresAt.getTime() > Date.now();
}

function cleanQueryValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function prettifyToken(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3) {
        return part.toUpperCase();
      }

      return `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function assetTypeLabel(value: string) {
  return assetTypeLabels[value] ?? prettifyToken(value);
}

function protocolLabel(value: string | null) {
  if (!value) {
    return null;
  }

  return protocolLabels[value] ?? prettifyToken(value);
}

function parseCompanyDomain(websiteUrl: string | null | undefined) {
  if (!websiteUrl) {
    return null;
  }

  try {
    return new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

function compareFacetValues(left: string, right: string, preferredOrder: readonly string[] = []) {
  const leftIndex = preferredOrder.indexOf(left);
  const rightIndex = preferredOrder.indexOf(right);

  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  }

  return left.localeCompare(right);
}

function buildFacetCounts(
  listings: PublicRegistryListingRecord[],
  getValue: (listing: PublicRegistryListingRecord) => string | null | undefined,
  getLabel: (value: string) => string,
  preferredOrder: readonly string[] = [],
) {
  const counts = new Map<string, number>();

  for (const listing of listings) {
    const value = getValue(listing);
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => compareFacetValues(left, right, preferredOrder))
    .map(([value, count]) => ({
      value,
      label: getLabel(value),
      count,
    }));
}

function summarizeListings(listings: PublicRegistryListingRecord[]): PublicRegistrySummary {
  const companyKeys = new Set<string>();
  const assetIds = new Set<string>();
  const protocols = new Set<string>();

  for (const listing of listings) {
    companyKeys.add(`${listing.companyName.toLowerCase()}|${listing.companyDomain ?? listing.caseId}`);
    assetIds.add(listing.asset.id);

    if (listing.asset.protocol) {
      protocols.add(listing.asset.protocol);
    }
  }

  return {
    results: listings.length,
    companies: companyKeys.size,
    assets: assetIds.size,
    certificates: listings.length,
    protocols: protocols.size,
  };
}

function normalizePublicRegistryQuery(query: PublicRegistryQuery = {}): PublicRegistryQuery {
  return {
    q: cleanQueryValue(query.q),
    type: cleanQueryValue(query.type),
    risk: cleanQueryValue(query.risk),
    kya: cleanQueryValue(query.kya),
    protocol: cleanQueryValue(query.protocol),
  };
}

function listingMatchesQuery(listing: PublicRegistryListingRecord, query: PublicRegistryQuery) {
  if (query.q && !listing.searchText.includes(query.q.toLowerCase())) {
    return false;
  }

  if (query.type && listing.asset.type !== query.type) {
    return false;
  }

  if (query.risk && listing.certificate.riskClass !== query.risk) {
    return false;
  }

  if (query.kya && listing.certificate.kyaLevel !== query.kya) {
    return false;
  }

  if (query.protocol && listing.asset.protocol !== query.protocol) {
    return false;
  }

  return true;
}

function sortListings(listings: PublicRegistryListingRecord[]) {
  return [...listings].sort((left, right) => {
    const updatedDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    const companyDelta = left.companyName.localeCompare(right.companyName);
    if (companyDelta !== 0) {
      return companyDelta;
    }

    return left.asset.name.localeCompare(right.asset.name);
  });
}

function toPublicListing(listing: PublicRegistryListingRecord): PublicRegistryListing {
  const { searchText: discardedSearchText, ...publicListing } = listing;
  void discardedSearchText;
  return publicListing;
}

function buildPublicListing(input: {
  registryCase: PublicRegistryCaseRow;
  certificate: PublicRegistryCaseRow["certificates"][number];
}): PublicRegistryListingRecord | null {
  const asset = input.registryCase.assets.find((item) => item.id === input.certificate.registryAssetId) ?? input.registryCase.assets[0];

  if (!asset) {
    return null;
  }

  const companyDomain =
    input.registryCase.company?.verifiedDomain ??
    parseCompanyDomain(input.registryCase.company?.websiteUrl ?? input.registryCase.websiteUrl);
  const standardVersion =
    input.registryCase.standard?.version ??
    input.certificate.standardVersion ??
    null;
  const websiteUrl = input.registryCase.company?.websiteUrl ?? input.registryCase.websiteUrl ?? null;
  const updatedAt = new Date(
    Math.max(
      input.registryCase.updatedAt.getTime(),
      asset.updatedAt.getTime(),
      input.certificate.issuedAt.getTime(),
    ),
  ).toISOString();

  return {
    id: input.certificate.id,
    caseId: input.registryCase.id,
    caseNumber: input.registryCase.caseNumber,
    companyName: input.registryCase.company?.displayName ?? input.registryCase.companyName,
    websiteUrl,
    companyDomain,
    rippleEcosystemScope: input.registryCase.rippleEcosystemScope,
    standard: {
      title: input.registryCase.standard?.title ?? null,
      version: standardVersion,
    },
    updatedAt,
    asset: {
      id: asset.id,
      type: asset.assetType,
      typeLabel: assetTypeLabel(asset.assetType),
      name: asset.name,
      protocol: asset.protocol,
      protocolLabel: protocolLabel(asset.protocol),
      agentCardUrl: asset.agentCardUrl,
      endpointUrl: asset.endpointUrl,
      repositoryUrl: asset.repositoryUrl,
      packageName: asset.packageName,
      sourceUrl: asset.sourceUrl,
      did: asset.did,
      description: asset.description,
    },
    certificate: {
      certificateId: input.certificate.certificateId,
      status: input.certificate.status,
      riskClass: input.certificate.riskClass,
      kyaLevel: input.certificate.kyaLevel,
      issuedAt: input.certificate.issuedAt.toISOString(),
      expiresAt: input.certificate.expiresAt.toISOString(),
      publicUrl: input.certificate.publicUrl,
      badgeUrl: input.certificate.badgeUrl,
      apiUrl: `/api/kya-registry/v1/certificates/${encodeURIComponent(input.certificate.certificateId)}`,
    },
    searchText: buildSearchText([
      input.registryCase.caseNumber,
      input.registryCase.company?.displayName ?? input.registryCase.companyName,
      websiteUrl,
      companyDomain,
      input.registryCase.rippleEcosystemScope,
      input.registryCase.standard?.title,
      input.registryCase.standard?.version,
      asset.assetType,
      assetTypeLabel(asset.assetType),
      asset.name,
      asset.protocol,
      asset.protocol ? protocolLabel(asset.protocol) : null,
      asset.endpointUrl,
      asset.agentCardUrl,
      asset.repositoryUrl,
      asset.packageName,
      asset.did,
      asset.description,
      input.certificate.certificateId,
      input.certificate.riskClass,
      input.certificate.kyaLevel,
    ]),
  } satisfies PublicRegistryListingRecord;
}

export function getPublicRegistryApiPath(query: PublicRegistryQuery = {}) {
  const normalized = normalizePublicRegistryQuery(query);
  const params = new URLSearchParams();

  if (normalized.q) params.set("q", normalized.q);
  if (normalized.type) params.set("type", normalized.type);
  if (normalized.risk) params.set("risk", normalized.risk);
  if (normalized.kya) params.set("kya", normalized.kya);
  if (normalized.protocol) params.set("protocol", normalized.protocol);

  const search = params.toString();
  return search ? `/api/kya-registry/v1/registry?${search}` : "/api/kya-registry/v1/registry";
}

export async function getPublicRegistryExplorer(input: PublicRegistryQuery = {}): Promise<PublicRegistryExplorer> {
  const query = normalizePublicRegistryQuery(input);
  const now = new Date();
  const cases = await fetchPublicRegistryCases(now);

  const listings = sortListings(
    cases.flatMap((registryCase) =>
      registryCase.certificates
        .map((certificate) => buildPublicListing({ registryCase, certificate }))
        .filter((listing): listing is PublicRegistryListingRecord => Boolean(listing)),
    ),
  );
  const filteredListings = listings.filter((listing) => listingMatchesQuery(listing, query));

  return {
    query,
    totalSummary: summarizeListings(listings),
    filteredSummary: summarizeListings(filteredListings),
    facets: {
      assetTypes: buildFacetCounts(listings, (listing) => listing.asset.type, assetTypeLabel),
      riskClasses: buildFacetCounts(listings, (listing) => listing.certificate.riskClass, (value) => value, riskClassOrder),
      kyaLevels: buildFacetCounts(listings, (listing) => listing.certificate.kyaLevel, (value) => value, kyaLevelOrder),
      protocols: buildFacetCounts(listings, (listing) => listing.asset.protocol, (value) => protocolLabel(value) ?? value),
    },
    entries: filteredListings.map((listing) => toPublicListing(listing)),
  };
}

export async function getPublicRegistryEntries() {
  return (await getPublicRegistryExplorer()).entries;
}

export async function getHostedCertificate(certificateId: string) {
  const certificate = await prisma.trustCertificate.findUnique({
    where: { certificateId },
    include: {
      company: true,
      product: true,
      registryCase: true,
      registryAsset: true,
    },
  });

  if (!certificate) {
    return null;
  }

  const active = certificateIsUsable(certificate);
  const bindingDetails = getCertifiedOperationalBindingDetails({
    signedCertificateJson: certificate.signedCertificateJson,
    registryAsset: certificate.registryAsset,
  });
  const scope = asRecord(certificate.scopeJson);
  const publication = asRecord(scope?.publication);
  const archiveBackend = typeof publication?.backend === "string" ? publication.backend : null;
  const archivePublishedAt = typeof publication?.publishedAt === "string" ? publication.publishedAt : null;

  return {
    certificateId: certificate.certificateId,
    status: certificate.status,
    active,
    validForAgentTransactions: active,
    issuer: TRUST_REGISTRY_PRODUCT_NAME,
    company: {
      name: certificate.company.displayName,
      domain: certificate.company.verifiedDomain ?? new URL(certificate.company.websiteUrl).hostname,
      country: certificate.company.country,
    },
    asset: certificate.registryAsset
      ? {
        id: certificate.registryAsset.id,
        type: certificate.registryAsset.assetType,
        name: certificate.registryAsset.name,
        did: certificate.registryAsset.did,
        protocol: certificate.registryAsset.protocol,
        agentCardUrl: certificate.registryAsset.agentCardUrl,
        endpointUrl: certificate.registryAsset.endpointUrl,
      }
      : null,
    review: {
      standardVersion: certificate.standardVersion,
      riskClass: certificate.riskClass,
      kyaLevel: certificate.kyaLevel,
      issuedAt: certificate.issuedAt.toISOString(),
      expiresAt: certificate.expiresAt.toISOString(),
      evidenceHash: certificate.evidenceHash,
    },
    verification: {
      publicUrl: certificate.publicUrl,
      badgeUrl: certificate.badgeUrl,
      signatureAlgorithm: certificate.signatureAlgorithm,
      signature: certificate.signature,
      archive: archiveBackend || archivePublishedAt
        ? {
          backend: archiveBackend,
          publishedAt: archivePublishedAt,
        }
        : null,
    },
    handshake: {
      supported: Boolean(bindingDetails),
      mcpServerUrl: "/api/kya-registry/v1/mcp",
      challengeTool: "kya_prepare_handshake",
      verifyTool: "kya_verify_handshake",
      subjectBinding: bindingDetails
        ? {
          method: bindingDetails.binding.method,
          keyId: bindingDetails.binding.keyId,
          did: bindingDetails.binding.did,
          agentCardUrl: bindingDetails.binding.agentCardUrl,
          endpointUrl: bindingDetails.binding.endpointUrl,
          thumbprint: bindingDetails.thumbprint,
          algorithms: bindingDetails.algorithms,
        }
        : null,
    },
    policy: {
      publishedPolicies: getPublishedTrustPolicies(),
      offlineVerificationSupported: true,
      liveChallengeSupported: Boolean(bindingDetails),
    },
    signedCertificate: certificate.signedCertificateJson,
  };
}

export async function getKyaRegistryIssuerMetadata() {
  const publicKey = await getTrustCertificatePublicKeyPem().catch((error) => ({
    keyId: "unconfigured",
    keyUsage: "SIGN_VERIFY",
    signingAlgorithms: [],
    pem: "",
    error: error instanceof Error ? error.message : "Public key unavailable.",
  }));

  return {
    issuer: TRUST_REGISTRY_PRODUCT_NAME,
    purpose: "Hosted Know Your Agent credentials for agent-to-agent transaction verification.",
    certificateLookup: "/api/kya-registry/v1/certificates/{certificateId}",
    mcpServerUrl: "/api/kya-registry/v1/mcp",
    handshakeTools: ["kya_prepare_handshake", "kya_verify_handshake", "kya_evaluate_policy"],
    handshakeVersion: "xupra-kya-handshake-v1",
    publishedPolicies: getPublishedTrustPolicies(),
    registryUrl: "/kya-registry/registry",
    registryApiUrl: "/api/kya-registry/v1/registry",
    publicKey,
  };
}

export async function renderCertificateBadgeSvg(certificateId: string) {
  const certificate = await getHostedCertificate(certificateId);
  const active = certificate?.active ?? false;
  const status = active ? "ACTIVE" : "INVALID";
  const fill = active ? "#047857" : "#991b1b";
  const company = certificate?.company.name ?? "Unknown";
  const kyaLevel = certificate?.review.kyaLevel ?? "KYA";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160" viewBox="0 0 520 160" role="img" aria-label="Xupra KYA ${status}">
  <rect width="520" height="160" rx="10" fill="#0c0a09"/>
  <rect x="10" y="10" width="500" height="140" rx="8" fill="#fafaf9" stroke="#d6d3d1"/>
  <text x="30" y="45" fill="#57534e" font-family="Arial, sans-serif" font-size="14" font-weight="700">XUPRA KNOW YOUR AGENT</text>
  <text x="30" y="82" fill="#0c0a09" font-family="Arial, sans-serif" font-size="28" font-weight="800">${escapeSvg(company)}</text>
  <text x="30" y="115" fill="#44403c" font-family="Arial, sans-serif" font-size="16">${escapeSvg(certificateId)} / ${escapeSvg(kyaLevel)}</text>
  <rect x="390" y="44" width="92" height="36" rx="6" fill="${fill}"/>
  <text x="436" y="67" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="800">${status}</text>
</svg>`;
}

function escapeSvg(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
