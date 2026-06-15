import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    AWS_REGION: "us-east-1",
    XUPRA_TRUST_REGISTRY_BASE_URL: "https://xupracorp.com",
    XUPRA_TRUST_KMS_KEY_ID: "test-key",
    XUPRA_TRUST_KMS_SIGNING_ALGORITHM: "RSASSA_PSS_SHA_256",
  },
}));

vi.mock("@/lib/aws/clients", () => ({
  getKmsClient: vi.fn(),
}));

import {
  classifyMcpRisk,
  formatCertificateId,
  recommendTrustDecision,
  scoreKyaQuestionnaire,
  stableStringify,
} from "@/KYAregistry/services/registry";
import { createSignedTrustCertificate } from "@/KYAregistry/services/certificates";

describe("trust registry rules", () => {
  it("scores KYA questionnaire answers into launch levels", () => {
    const minimalL1 = scoreKyaQuestionnaire({
      stableAgentIdentity: true,
      principalIdentity: true,
      consentRecord: true,
    });
    const full = scoreKyaQuestionnaire({
      stableAgentIdentity: true,
      cryptographicallyVerifiableAgentIdentity: true,
      principalIdentity: true,
      consentRecord: true,
      delegatedAuthorityByActionType: true,
      amountFrequencyDestinationOrResourceLimits: true,
      delegationExpiry: true,
      delegationRevocation: true,
      auditLogs: true,
      signedOrTamperEvidentAuditLogs: true,
      thirdPartyVerificationApi: true,
      agentsCanInitiatePaymentsOrFinancialActions: true,
      humanApprovalThresholds: true,
      walletSigningPrivateKeyBoundariesDocumented: true,
    });

    expect(minimalL1.score).toBe(40);
    expect(minimalL1.kyaLevel).toBe("KYA-L1");
    expect(full.score).toBe(100);
    expect(full.kyaLevel).toBe("KYA-L3");
    expect(full.paymentControlsDocumented).toBe(true);
  });

  it("classifies MCP risk by capability blast radius", () => {
    expect(classifyMcpRisk({})).toBe("MCP-R0");
    expect(classifyMcpRisk({ networkAccess: true })).toBe("MCP-R1");
    expect(classifyMcpRisk({ databaseWriteAccess: true })).toBe("MCP-R2");
    expect(classifyMcpRisk({ shellExecution: true })).toBe("MCP-R3");
    expect(classifyMcpRisk({ filesystemAccess: "write" })).toBe("MCP-R3");
    expect(classifyMcpRisk({ walletPaymentAccess: true })).toBe("MCP-R3");
  });

  it("fails hidden high-risk behavior and remediates unresolved review gaps", () => {
    expect(recommendTrustDecision({
      hiddenPrivateKeyAccess: true,
      maintainerIdentityVerified: true,
    })).toEqual({
      decision: "fail",
      reasons: ["hidden private-key access"],
    });

    expect(recommendTrustDecision({
      declaredToolsMatchObservedTools: false,
      maintainerIdentityVerified: true,
    })).toEqual({
      decision: "needs_remediation",
      reasons: ["declared tools do not match observed tools"],
    });

    expect(recommendTrustDecision({
      maintainerIdentityVerified: true,
    })).toEqual({
      decision: "pass",
      reasons: ["basic scan pass criteria satisfied"],
    });
  });

  it("formats certificate ids with scoped launch numbering", () => {
    expect(formatCertificateId({
      scope: "XMKS-MCP",
      issuedAt: new Date("2026-06-14T00:00:00.000Z"),
      sequence: 1,
    })).toBe("XMKS-MCP-2026-000001");
  });

  it("canonicalizes JSON for deterministic certificate signing", () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });
});

describe("trust certificate signing", () => {
  it("creates a signed JSON attestation over canonical certificate content", async () => {
    const signer = {
      sign: vi.fn(async (payload: Uint8Array) => ({
        signature: Buffer.from(payload).toString("base64url").slice(0, 48),
        algorithm: "test-signature",
        keyId: "test-key",
      })),
    };

    const result = await createSignedTrustCertificate({
      certificateId: "XMKS-MCP-2026-000001",
      subject: {
        companyName: "Example AI Inc.",
        domain: "example.com",
        country: "US",
      },
      reviewedProduct: {
        name: "Example MCP Server",
        category: ["MCP Server", "KYA Product"],
        repository: "https://github.com/example/example-mcp",
        package: "npm:@example/mcp-server",
      },
      review: {
        scanType: "Automated Basic Safety Scan",
        riskClass: "MCP-R1",
        kyaLevel: "KYA-L1",
        criticalFindings: 0,
        highFindings: 0,
        reviewedAt: "2026-06-14T00:00:00.000Z",
      },
      evidence: {
        scanRunId: "scan-run-123",
        findings: [],
      },
      issuedAt: new Date("2026-06-14T00:00:00.000Z"),
      expiresAt: new Date("2027-06-14T00:00:00.000Z"),
    }, signer);

    expect(result.certificate.certificateId).toBe("XMKS-MCP-2026-000001");
    expect(result.certificate.issuer).toEqual({
      name: "Xupra K.K.",
      did: "did:web:xupracorp.com",
    });
    expect(result.certificate.signatureAlgorithm).toBe("test-signature");
    expect(result.certificate.signature).toBeTruthy();
    expect(result.certificate.publicUrl).toBe("https://xupracorp.com/kya-registry/certificates/XMKS-MCP-2026-000001");
    expect(result.certificate.badgeUrl).toBe("https://xupracorp.com/kya-registry/badges/XMKS-MCP-2026-000001");
    expect(result.evidenceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.canonicalJson.signature).toBeUndefined();
    expect(signer.sign).toHaveBeenCalledTimes(1);
  });
});
