import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  evaluateHostedCertificateTrustPolicy,
  prepareHandshakeChallenge,
  verifyHandshakeChallengeResponse,
} from "@/KYAregistry/services/handshake";

function toolResult(payload: Record<string, unknown>, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError,
  };
}

export function createKyaRegistryMcpServer() {
  const server = new McpServer({
    name: "xupra-kya-registry",
    version: "0.1.0",
  });

  server.registerTool(
    "kya_prepare_handshake",
    {
      title: "Prepare KYA Handshake",
      description:
        "Create a nonce challenge for a hosted Xupra KYA certificate. The peer agent signs the returned challengeText with the certified operational key before verification.",
      inputSchema: {
        certificateId: z.string().min(1).max(120).optional(),
        certificateUrl: z.url().optional(),
        transactionType: z.enum([
          "directory_lookup",
          "agent_message",
          "tool_invocation",
          "data_access",
          "payment_instruction",
          "wallet_signing",
        ]).default("agent_message"),
        nonce: z.string().min(16).max(512).optional(),
        requester: z.string().min(1).max(200).optional(),
        audience: z.string().min(1).max(200).optional(),
        transactionId: z.string().min(1).max(200).optional(),
        ttlSeconds: z.number().int().min(30).max(900).default(300),
      },
    },
    async (args) => {
      try {
        return toolResult(await prepareHandshakeChallenge(args));
      } catch (error) {
        return toolResult({
          error: error instanceof Error ? error.message : "Failed to prepare KYA handshake challenge.",
        }, true);
      }
    },
  );

  server.registerTool(
    "kya_verify_handshake",
    {
      title: "Verify KYA Handshake",
      description:
        "Verify a nonce signature against the certified operational key bound to a hosted Xupra KYA certificate.",
      inputSchema: {
        challenge: z.object({
          version: z.literal("xupra-kya-handshake-v1"),
          challengeId: z.string().min(1).max(120),
          certificateId: z.string().min(1).max(120),
          certificateUrl: z.url(),
          transactionType: z.enum([
            "directory_lookup",
            "agent_message",
            "tool_invocation",
            "data_access",
            "payment_instruction",
            "wallet_signing",
          ]),
          nonce: z.string().min(16).max(512),
          bindingThumbprint: z.string().min(16).max(128),
          requester: z.string().min(1).max(200).optional(),
          audience: z.string().min(1).max(200).optional(),
          transactionId: z.string().min(1).max(200).optional(),
          issuedAt: z.iso.datetime(),
          expiresAt: z.iso.datetime(),
          mcpServerUrl: z.url(),
        }).strict(),
        signature: z.string().min(32).max(4096),
        signatureAlgorithm: z.string().min(1).max(40).optional(),
        expectedSubjectBinding: z.object({
          did: z.string().min(1).max(240).optional(),
          agentCardUrl: z.url().optional(),
          endpointUrl: z.url().optional(),
        }).strict().optional(),
        policy: z.object({
          transactionType: z.enum([
            "directory_lookup",
            "agent_message",
            "tool_invocation",
            "data_access",
            "payment_instruction",
            "wallet_signing",
          ]).default("agent_message"),
          minimumKyaLevel: z.enum(["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"]).optional(),
          maximumRiskClass: z.enum(["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"]).optional(),
          handshakePreference: z.enum(["offline_ok", "live_preferred", "live_required"]).optional(),
          fallbackMode: z.enum(["deny_when_offline", "allow_offline_lookup"]).optional(),
          metadataAvailable: z.boolean().default(true),
          offlineLookupPerformed: z.boolean().default(true),
        }).strict().optional(),
      },
    },
    async (args) => {
      try {
        const result = await verifyHandshakeChallengeResponse(args);
        return toolResult(result, !result.verified);
      } catch (error) {
        return toolResult({
          error: error instanceof Error ? error.message : "Failed to verify KYA handshake response.",
        }, true);
      }
    },
  );

  server.registerTool(
    "kya_evaluate_policy",
    {
      title: "Evaluate KYA Trust Policy",
      description:
        "Evaluate transaction-specific KYA trust policy from the hosted certificate when offline lookup is used or before live challenge is attempted.",
      inputSchema: {
        certificateId: z.string().min(1).max(120).optional(),
        certificateUrl: z.url().optional(),
        expectedSubjectBinding: z.object({
          did: z.string().min(1).max(240).optional(),
          agentCardUrl: z.url().optional(),
          endpointUrl: z.url().optional(),
        }).strict().optional(),
        policy: z.object({
          transactionType: z.enum([
            "directory_lookup",
            "agent_message",
            "tool_invocation",
            "data_access",
            "payment_instruction",
            "wallet_signing",
          ]).default("agent_message"),
          minimumKyaLevel: z.enum(["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"]).optional(),
          maximumRiskClass: z.enum(["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"]).optional(),
          handshakePreference: z.enum(["offline_ok", "live_preferred", "live_required"]).optional(),
          fallbackMode: z.enum(["deny_when_offline", "allow_offline_lookup"]).optional(),
          metadataAvailable: z.boolean().default(true),
          offlineLookupPerformed: z.boolean().default(true),
        }).strict().optional(),
      },
    },
    async (args) => {
      try {
        return toolResult(await evaluateHostedCertificateTrustPolicy(args));
      } catch (error) {
        return toolResult({
          error: error instanceof Error ? error.message : "Failed to evaluate KYA trust policy.",
        }, true);
      }
    },
  );

  return server;
}
