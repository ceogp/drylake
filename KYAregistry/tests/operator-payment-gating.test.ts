import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRegistryCase: vi.fn(),
  findRegistryAsset: vi.fn(),
  createTestRun: vi.fn(),
  updateRegistryCase: vi.fn(),
  countCertificates: vi.fn(),
  signCertificate: vi.fn(),
  publishArtifacts: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trustRegistryCase: {
      findUnique: mocks.findRegistryCase,
      update: mocks.updateRegistryCase,
    },
    trustRegistryAsset: {
      findFirst: mocks.findRegistryAsset,
    },
    trustRegistryTestRun: {
      create: mocks.createTestRun,
    },
    trustCertificate: {
      count: mocks.countCertificates,
    },
  },
}));

vi.mock("@/KYAregistry/services/billing", () => ({
  createAndSendTrustInvoice: vi.fn(),
  onboardingScanInvoiceLineItems: vi.fn(),
  isTrustInvoicePaid: (input: { status?: string | null; paidAt?: Date | null }) =>
    input.status === "paid" || Boolean(input.paidAt),
}));

vi.mock("@/KYAregistry/services/certificates", () => ({
  createSignedTrustCertificate: mocks.signCertificate,
}));

vi.mock("@/KYAregistry/services/publication", () => ({
  publishTrustCertificateArtifacts: mocks.publishArtifacts,
}));

import {
  issueHostedAgentCertificate,
  recordRegistryTestRun,
} from "@/KYAregistry/services/operator";

describe("registry payment gating", () => {
  beforeEach(() => {
    mocks.findRegistryCase.mockReset();
    mocks.findRegistryAsset.mockReset();
    mocks.createTestRun.mockReset();
    mocks.updateRegistryCase.mockReset();
    mocks.countCertificates.mockReset();
    mocks.signCertificate.mockReset();
    mocks.publishArtifacts.mockReset();
  });

  it("blocks test runs until the invoice is paid", async () => {
    mocks.findRegistryCase.mockResolvedValue({
      id: "case-1",
      paymentStatus: "invoiced",
      billingInvoices: [
        {
          status: "open",
          paidAt: null,
        },
      ],
    });

    await expect(
      recordRegistryTestRun({
        registryCaseId: "case-1",
        provider: "manual_review",
        testType: "kya_controls_review",
        status: "queued",
      }),
    ).rejects.toThrow(
      "KYA testing requires a paid invoice. Wait for Stripe payment confirmation before recording test runs.",
    );

    expect(mocks.createTestRun).not.toHaveBeenCalled();
    expect(mocks.findRegistryAsset).not.toHaveBeenCalled();
  });

  it("blocks certificate issuance until the invoice is paid", async () => {
    mocks.findRegistryCase.mockResolvedValue({
      id: "case-2",
      paymentStatus: "invoiced",
      billingInvoices: [
        {
          status: "open",
          paidAt: null,
        },
      ],
      company: {
        id: "company-1",
        displayName: "Example AI Inc.",
        websiteUrl: "https://example.ai",
        country: "US",
      },
      standard: {
        version: "mcp-kya-basic-v0.1",
        title: "Xupra KYA Registry Standard",
      },
      assets: [
        {
          id: "asset-1",
          name: "Treasury Agent",
          assetType: "agent",
          repositoryUrl: null,
          packageName: null,
          endpointUrl: "https://example.ai/mcp",
          agentCardUrl: "https://example.ai/agent-card.json",
          sourceUrl: "https://example.ai",
          metadataJson: null,
        },
      ],
      testRuns: [],
    });

    await expect(
      issueHostedAgentCertificate({
        registryCaseId: "case-2",
        expiresInDays: 365,
      }),
    ).rejects.toThrow(
      "KYA certificate issuance requires a paid invoice. Wait for Stripe payment confirmation before issuing a certificate.",
    );

    expect(mocks.signCertificate).not.toHaveBeenCalled();
    expect(mocks.countCertificates).not.toHaveBeenCalled();
    expect(mocks.publishArtifacts).not.toHaveBeenCalled();
  });
});
