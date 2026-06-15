import {
  TRUST_REGISTRY_PRODUCT_NAME,
  TRUST_REGISTRY_STANDARD_LABEL,
  TRUST_REGISTRY_STANDARD_VERSION,
  getTrustRegistryUrl,
  hashJson,
} from "@/KYAregistry/services/registry";
import { getPublishedTrustPolicies } from "@/KYAregistry/services/trust-policy";

const sampleCertificateId = "XMKS-KYA-2026-000001";
const sampleBaseUrl = process.env.XUPRA_TRUST_REGISTRY_BASE_URL ?? "https://xupracorp.com";

export function getSampleCertificateId() {
  return sampleCertificateId;
}

export function getSampleCertificatePublicUrl() {
  return getTrustRegistryUrl("/kya-registry/sample-certificate", sampleBaseUrl);
}

export function getSampleCertificateApiUrl() {
  return getTrustRegistryUrl("/api/kya-registry/v1/sample-certificate", sampleBaseUrl);
}

export function getSampleCertificate() {
  const issuedAt = "2026-06-15T00:00:00.000Z";
  const expiresAt = "2027-06-15T00:00:00.000Z";
  const issuerMetadataUrl = getTrustRegistryUrl("/.well-known/kya-registry.json", sampleBaseUrl);
  const sampleSubjectBinding = {
    method: "jwk",
    keyId: "did:web:exampleai.com:keys:payments-mcp-1",
    did: "did:web:exampleai.com:agents:payments-mcp",
    agentCardUrl: "https://exampleai.com/.well-known/agent.json",
    endpointUrl: "https://api.exampleai.com/mcp/payments",
    thumbprint: "sha256:7a9dbdb2994a0b8e1d5b5797f1808c74d0e3c9329426b24fe8e6b49060908d8b",
    algorithms: ["EdDSA"],
  };

  const signedCertificate = {
    version: "xupra-kya-certificate-v1",
    sample: true,
    certificateId: sampleCertificateId,
    issuer: {
      name: TRUST_REGISTRY_PRODUCT_NAME,
      did: "did:web:xupracorp.com",
      metadataUrl: issuerMetadataUrl,
      signatureProvider: "AWS KMS",
    },
    subject: {
      companyName: "Example AI Inc.",
      companyDomain: "exampleai.com",
      country: "US",
      assetName: "Payments MCP Endpoint",
      assetType: "mcp_server",
      protocol: "streamable_http",
      did: sampleSubjectBinding.did,
      agentCardUrl: sampleSubjectBinding.agentCardUrl,
      endpointUrl: sampleSubjectBinding.endpointUrl,
    },
    review: {
      standardLabel: TRUST_REGISTRY_STANDARD_LABEL,
      standardVersion: TRUST_REGISTRY_STANDARD_VERSION,
      kyaLevel: "KYA-L2",
      riskClass: "MCP-R1",
      issuedAt,
      expiresAt,
    },
    subjectBinding: sampleSubjectBinding,
    verification: {
      certificateUrl: getSampleCertificatePublicUrl(),
      certificateApiUrl: getSampleCertificateApiUrl(),
      mcpServerUrl: getTrustRegistryUrl("/api/kya-registry/v1/mcp", sampleBaseUrl),
      handshakeTools: ["kya_prepare_handshake", "kya_verify_handshake", "kya_evaluate_policy"],
    },
  };

  return {
    sample: true,
    certificateId: sampleCertificateId,
    status: "sample",
    active: false,
    validForAgentTransactions: false,
    issuer: TRUST_REGISTRY_PRODUCT_NAME,
    company: {
      name: "Example AI Inc.",
      domain: "exampleai.com",
      country: "US",
    },
    asset: {
      id: "sample-payments-mcp",
      type: "mcp_server",
      name: "Payments MCP Endpoint",
      did: sampleSubjectBinding.did,
      protocol: "streamable_http",
      agentCardUrl: sampleSubjectBinding.agentCardUrl,
      endpointUrl: sampleSubjectBinding.endpointUrl,
    },
    review: {
      standardVersion: TRUST_REGISTRY_STANDARD_VERSION,
      riskClass: "MCP-R1",
      kyaLevel: "KYA-L2",
      issuedAt,
      expiresAt,
      evidenceHash: hashJson(signedCertificate),
    },
    verification: {
      publicUrl: getSampleCertificatePublicUrl(),
      apiUrl: getSampleCertificateApiUrl(),
      badgeUrl: getTrustRegistryUrl(`/kya-registry/badges/${encodeURIComponent(sampleCertificateId)}`, sampleBaseUrl),
      signatureAlgorithm: "AWS-KMS-RSASSA_PSS_SHA_256",
      signature: "sample-documentation-signature",
      archive: {
        backend: "s3",
        publishedAt: issuedAt,
      },
      issuerMetadataUrl,
      trustSigningProvider: "AWS KMS",
    },
    handshake: {
      supported: true,
      mcpServerUrl: "/api/kya-registry/v1/mcp",
      challengeTool: "kya_prepare_handshake",
      verifyTool: "kya_verify_handshake",
      policyTool: "kya_evaluate_policy",
      subjectBinding: sampleSubjectBinding,
    },
    policy: {
      publishedPolicies: getPublishedTrustPolicies(),
      offlineVerificationSupported: true,
      liveChallengeSupported: true,
    },
    signedCertificate,
  };
}
