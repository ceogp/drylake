import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trustRegistryCase: {
      findMany,
    },
  },
}));

vi.mock("@/KYAregistry/services/certificates", () => ({
  getTrustCertificatePublicKeyPem: vi.fn(),
}));

import { getPublicRegistryExplorer } from "@/KYAregistry/services/public-registry";

function buildRegistryCase(input: {
  id: string;
  caseNumber: string;
  companyName: string;
  websiteUrl: string;
  updatedAt: string;
  asset: {
    id: string;
    assetType: string;
    name: string;
    protocol?: string | null;
    endpointUrl?: string | null;
    agentCardUrl?: string | null;
    repositoryUrl?: string | null;
    packageName?: string | null;
    did?: string | null;
    description?: string | null;
  };
  certificate: {
    id: string;
    certificateId: string;
    riskClass: string;
    kyaLevel: string;
    issuedAt: string;
    expiresAt: string;
  };
}) {
  return {
    id: input.id,
    caseNumber: input.caseNumber,
    companyId: `${input.id}-company`,
    organizationId: null,
    standardId: `${input.id}-standard`,
    status: "listed",
    outreachStatus: "responded",
    interestStatus: "interested",
    paymentStatus: "paid",
    reviewStatus: "passed",
    companyName: input.companyName,
    websiteUrl: input.websiteUrl,
    primaryContactEmail: null,
    discoveredSource: null,
    discoveredUrl: null,
    rippleEcosystemScope: "Ripple and RLUSD settlement flow",
    notes: null,
    publicListingEnabled: true,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date(input.updatedAt),
    company: {
      id: `${input.id}-company`,
      organizationId: null,
      legalName: input.companyName,
      displayName: input.companyName,
      slug: input.companyName.toLowerCase().replaceAll(" ", "-"),
      country: "US",
      sizeClass: "small",
      websiteUrl: input.websiteUrl,
      primaryProductUrl: null,
      businessContactEmail: null,
      securityContactEmail: null,
      privacyContactEmail: null,
      githubOrganizationUrl: null,
      packageRegistryLinksJson: null,
      description: null,
      categoriesJson: null,
      japanMarketInterestJson: null,
      verifiedDomain: new URL(input.websiteUrl).hostname,
      status: "active",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    assets: [
      {
        id: input.asset.id,
        registryCaseId: input.id,
        companyId: `${input.id}-company`,
        productId: null,
        assetType: input.asset.assetType,
        name: input.asset.name,
        status: "reviewed",
        sourceUrl: null,
        packageName: input.asset.packageName ?? null,
        repositoryUrl: input.asset.repositoryUrl ?? null,
        endpointUrl: input.asset.endpointUrl ?? null,
        agentCardUrl: input.asset.agentCardUrl ?? null,
        did: input.asset.did ?? null,
        protocol: input.asset.protocol ?? null,
        description: input.asset.description ?? null,
        metadataJson: null,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date(input.updatedAt),
      },
    ],
    certificates: [
      {
        id: input.certificate.id,
        certificateId: input.certificate.certificateId,
        companyId: `${input.id}-company`,
        productId: null,
        registryCaseId: input.id,
        registryAssetId: input.asset.id,
        scanRunId: null,
        status: "active",
        scopeJson: {},
        standardVersion: "mcp-kya-basic-v0.1",
        riskClass: input.certificate.riskClass,
        kyaLevel: input.certificate.kyaLevel,
        issuedAt: new Date(input.certificate.issuedAt),
        expiresAt: new Date(input.certificate.expiresAt),
        evidenceHash: "sha256:test",
        canonicalJson: {},
        signedCertificateJson: {},
        signature: "test-signature",
        signatureAlgorithm: "RSASSA_PSS_SHA_256",
        publicUrl: `https://xupracorp.com/kya-registry/certificates/${input.certificate.certificateId}`,
        badgeUrl: `https://xupracorp.com/kya-registry/badges/${input.certificate.certificateId}`,
        createdAt: new Date(input.certificate.issuedAt),
        updatedAt: new Date(input.certificate.issuedAt),
        revokedAt: null,
      },
    ],
    standard: {
      id: `${input.id}-standard`,
      slug: "kya-agent-transaction-standard",
      version: "mcp-kya-basic-v0.1",
      title: "Xupra KYA Agent Transaction Standard v0.1",
      status: "active",
      summary: null,
      ecosystem: "agent_to_agent",
      controlsJson: {},
      credentialSchemaJson: {},
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
  };
}

describe("public registry explorer", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([
      buildRegistryCase({
        id: "case-example",
        caseNumber: "KYA-2026-EXAMPLE",
        companyName: "Example AI Inc.",
        websiteUrl: "https://example.ai",
        updatedAt: "2026-06-10T10:00:00.000Z",
        asset: {
          id: "asset-example",
          assetType: "mcp_server",
          name: "Payments MCP",
          protocol: "streamable_http",
          endpointUrl: "https://api.example.ai/mcp",
          repositoryUrl: "https://github.com/example/payments-mcp",
          packageName: "npm:@example/payments-mcp",
          did: "did:web:example.ai",
          description: "Payment routing MCP for enterprise checkout flows.",
        },
        certificate: {
          id: "cert-example",
          certificateId: "XMKS-KYA-2026-000101",
          riskClass: "MCP-R1",
          kyaLevel: "KYA-L2",
          issuedAt: "2026-06-10T10:00:00.000Z",
          expiresAt: "2027-06-10T10:00:00.000Z",
        },
      }),
      buildRegistryCase({
        id: "case-ripple",
        caseNumber: "KYA-2026-RIPPLE",
        companyName: "Ripple Tools Ltd.",
        websiteUrl: "https://ripple.tools",
        updatedAt: "2026-06-14T15:00:00.000Z",
        asset: {
          id: "asset-ripple",
          assetType: "agent",
          name: "Ripple Treasury Agent",
          protocol: "stdio",
          agentCardUrl: "https://ripple.tools/agent-card.json",
          repositoryUrl: "https://github.com/ripple/tools-agent",
          did: "did:web:ripple.tools",
          description: "Agent for treasury reconciliation and RLUSD settlement review.",
        },
        certificate: {
          id: "cert-ripple",
          certificateId: "XMKS-KYA-2026-000102",
          riskClass: "MCP-R3",
          kyaLevel: "KYA-L3",
          issuedAt: "2026-06-14T15:00:00.000Z",
          expiresAt: "2027-06-14T15:00:00.000Z",
        },
      }),
    ]);
  });

  it("builds listing entries, summary counts, and facets from published certificates", async () => {
    const result = await getPublicRegistryExplorer();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(result.totalSummary).toEqual({
      results: 2,
      companies: 2,
      assets: 2,
      certificates: 2,
      protocols: 2,
    });
    expect(result.filteredSummary).toEqual(result.totalSummary);
    expect(result.entries[0]?.certificate.certificateId).toBe("XMKS-KYA-2026-000102");
    expect(result.entries[0]?.asset.typeLabel).toBe("Agent");
    expect(result.entries[1]?.asset.typeLabel).toBe("MCP Server");
    expect(result.entries[1]?.certificate.apiUrl).toBe("/api/kya-registry/v1/certificates/XMKS-KYA-2026-000101");
    expect(result.facets.riskClasses.map((facet) => facet.value)).toEqual(["MCP-R1", "MCP-R3"]);
    expect(result.facets.kyaLevels.map((facet) => facet.value)).toEqual(["KYA-L2", "KYA-L3"]);
    expect(result.facets.protocols.map((facet) => facet.label)).toEqual(["stdio", "Streamable HTTP"]);
  });

  it("filters listings by free-text query and exact facet selections", async () => {
    const ripple = await getPublicRegistryExplorer({ q: "treasury" });
    expect(ripple.filteredSummary.results).toBe(1);
    expect(ripple.entries[0]?.companyName).toBe("Ripple Tools Ltd.");

    const mcp = await getPublicRegistryExplorer({
      type: "mcp_server",
      risk: "MCP-R1",
      kya: "KYA-L2",
      protocol: "streamable_http",
    });
    expect(mcp.filteredSummary.results).toBe(1);
    expect(mcp.entries[0]?.asset.name).toBe("Payments MCP");

    const none = await getPublicRegistryExplorer({ q: "wallet", risk: "MCP-R1" });
    expect(none.filteredSummary.results).toBe(0);
    expect(none.entries).toEqual([]);
  });
});
