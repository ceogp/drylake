import { generateKeyPairSync, sign as signPayload } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    XUPRA_TRUST_REGISTRY_BASE_URL: "https://xupracorp.com",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trustCertificate: {
      findUnique,
    },
  },
}));

import {
  prepareHandshakeChallenge,
  verifyHandshakeChallengeResponse,
} from "@/KYAregistry/services/handshake";
import { createKyaRegistryMcpServer } from "@/KYAregistry/services/mcp-server";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const { privateKey: mismatchedPrivateKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" });

function buildCertificate() {
  return {
    id: "cert-db-1",
    certificateId: "XMKS-KYA-2026-000301",
    companyId: "company-1",
    registryCaseId: "case-1",
    registryAssetId: "asset-1",
    status: "active",
    expiresAt: new Date("2027-06-14T00:00:00.000Z"),
    publicUrl: "https://xupracorp.com/kya-registry/certificates/XMKS-KYA-2026-000301",
    riskClass: "MCP-R1",
    kyaLevel: "KYA-L2",
    signedCertificateJson: {
      subjectBinding: {
        method: "jwk",
        publicJwk,
        keyId: "agent-ed25519",
        algorithms: ["EdDSA"],
        did: "did:web:example.ai",
        agentCardUrl: "https://example.ai/agent-card.json",
        endpointUrl: "https://example.ai/mcp",
      },
    },
    company: {
      displayName: "Example AI Inc.",
      websiteUrl: "https://example.ai",
      country: "US",
    },
    registryAsset: {
      id: "asset-1",
      name: "Treasury Settlement Agent",
      assetType: "agent",
      protocol: "streamable_http",
      did: "did:web:example.ai",
      endpointUrl: "https://example.ai/mcp",
      agentCardUrl: "https://example.ai/agent-card.json",
      metadataJson: {
        operationalBinding: {
          method: "jwk",
          publicJwk,
          keyId: "agent-ed25519",
          algorithms: ["EdDSA"],
        },
      },
    },
  };
}

describe("KYA handshake service", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue(buildCertificate());
  });

  it("creates a challenge and verifies a valid nonce signature against the certified key", async () => {
    const prepared = await prepareHandshakeChallenge({
      certificateId: "XMKS-KYA-2026-000301",
      requester: "Ripple settlement agent",
      audience: "treasury-routing",
      transactionId: "txn-001",
    });

    const signature = signPayload(
      null,
      Buffer.from(prepared.challengeText, "utf8"),
      privateKey,
    ).toString("base64url");

    const result = await verifyHandshakeChallengeResponse({
      challenge: prepared.challenge,
      signature,
      signatureAlgorithm: "EdDSA",
    });

    expect(prepared.challenge.certificateId).toBe("XMKS-KYA-2026-000301");
    expect(prepared.challenge.transactionType).toBe("agent_message");
    expect(prepared.binding.thumbprint).toMatch(/^sha256:/);
    expect(result.verified).toBe(true);
    expect(result.trusted).toBe(true);
    expect(result.reason).toBe("Nonce signature matches the certified operational key.");
    expect(result.binding?.verifiedWith).toBe("EdDSA");
    expect(result.policyEvaluation?.decision).toBe("allow");
  });

  it("fails verification when the signature does not match the certified key", async () => {
    const prepared = await prepareHandshakeChallenge({
      certificateId: "XMKS-KYA-2026-000301",
    });

    const invalidSignature = signPayload(
      null,
      Buffer.from(prepared.challengeText, "utf8"),
      mismatchedPrivateKey,
    ).toString("base64url");
    const result = await verifyHandshakeChallengeResponse({
      challenge: prepared.challenge,
      signature: invalidSignature,
      signatureAlgorithm: "EdDSA",
    });

    expect(result.verified).toBe(false);
    expect(result.trusted).toBe(false);
    expect(result.reason).toContain("did not verify");
  });

  it("denies wallet-signing policy when the certificate profile is below the required trust level", async () => {
    const prepared = await prepareHandshakeChallenge({
      certificateId: "XMKS-KYA-2026-000301",
      transactionType: "wallet_signing",
    });

    const signature = signPayload(
      null,
      Buffer.from(prepared.challengeText, "utf8"),
      privateKey,
    ).toString("base64url");

    const result = await verifyHandshakeChallengeResponse({
      challenge: prepared.challenge,
      signature,
      signatureAlgorithm: "EdDSA",
      policy: {
        transactionType: "wallet_signing",
      },
    });

    expect(result.verified).toBe(true);
    expect(result.trusted).toBe(false);
    expect(result.policyEvaluation?.decision).toBe("deny");
    expect(result.policyEvaluation?.reasons).toEqual(
      expect.arrayContaining([
        "Certificate KYA level KYA-L2 is below required KYA-L3.",
        "Certificate risk class MCP-R1 exceeds allowed MCP-R0.",
      ]),
    );
  });
});

describe("KYA MCP handshake server", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue(buildCertificate());
  });

  it("exposes handshake tools over MCP and verifies a peer proof", async () => {
    const server = createKyaRegistryMcpServer();
    const client = new Client({
      name: "kya-test-client",
      version: "0.1.0",
    }, {
      capabilities: {},
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["kya_prepare_handshake", "kya_verify_handshake", "kya_evaluate_policy"]),
      );

      const prepared = await client.callTool({
        name: "kya_prepare_handshake",
        arguments: {
          certificateId: "XMKS-KYA-2026-000301",
          requester: "Remote treasury agent",
        },
      });
      const preparedStructured = prepared.structuredContent as {
        challenge: Record<string, unknown>;
        challengeText: string;
      };
      const signature = signPayload(
        null,
        Buffer.from(preparedStructured.challengeText, "utf8"),
        privateKey,
      ).toString("base64url");

      const verified = await client.callTool({
        name: "kya_verify_handshake",
        arguments: {
          challenge: preparedStructured.challenge,
          signature,
          signatureAlgorithm: "EdDSA",
        },
      });
      const verifiedStructured = verified.structuredContent as {
        verified: boolean;
        reason: string;
      };

      expect(verifiedStructured.verified).toBe(true);
      expect(verifiedStructured.reason).toContain("certified operational key");

      const evaluated = await client.callTool({
        name: "kya_evaluate_policy",
        arguments: {
          certificateId: "XMKS-KYA-2026-000301",
          policy: {
            transactionType: "agent_message",
          },
        },
      });
      const evaluatedStructured = evaluated.structuredContent as {
        trusted: boolean;
        policyEvaluation: { decision: string };
      };

      expect(evaluatedStructured.trusted).toBe(true);
      expect(evaluatedStructured.policyEvaluation.decision).toBe("allow");
    } finally {
      await clientTransport.close();
      await serverTransport.close();
      await server.close();
    }
  });
});
