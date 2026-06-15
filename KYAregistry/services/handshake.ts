import { constants, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  evaluateTrustPolicy,
  fallbackModeSchema,
  getDefaultTrustPolicy,
  getPublishedTrustPolicies,
  handshakePreferenceSchema,
  transactionTypeSchema,
} from "@/KYAregistry/services/trust-policy";
import {
  TRUST_REGISTRY_PRODUCT_NAME,
  getTrustRegistryUrl,
  sha256Hex,
  stableStringify,
} from "@/KYAregistry/services/registry";

const operationalKeyBindingSchema = z.object({
  method: z.literal("jwk"),
  publicJwk: z.record(z.string(), z.unknown()),
  keyId: z.string().trim().min(1).max(240).optional(),
  algorithms: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  did: z.string().trim().min(1).max(240).optional(),
  agentCardUrl: z.url().optional(),
  endpointUrl: z.url().optional(),
}).strict();

const handshakeChallengeSchema = z.object({
  version: z.literal("xupra-kya-handshake-v1"),
  challengeId: z.string().trim().min(1).max(120),
  certificateId: z.string().trim().min(1).max(120),
  certificateUrl: z.url(),
  transactionType: transactionTypeSchema,
  nonce: z.string().trim().min(16).max(512),
  bindingThumbprint: z.string().trim().min(16).max(128),
  requester: z.string().trim().min(1).max(200).optional(),
  audience: z.string().trim().min(1).max(200).optional(),
  transactionId: z.string().trim().min(1).max(200).optional(),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  mcpServerUrl: z.url(),
}).strict();

const prepareHandshakeInputSchema = z.object({
  certificateId: z.string().trim().min(1).max(120).optional(),
  certificateUrl: z.url().optional(),
  transactionType: transactionTypeSchema.default("agent_message"),
  nonce: z.string().trim().min(16).max(512).optional(),
  requester: z.string().trim().min(1).max(200).optional(),
  audience: z.string().trim().min(1).max(200).optional(),
  transactionId: z.string().trim().min(1).max(200).optional(),
  ttlSeconds: z.number().int().min(30).max(900).default(300),
}).refine((value) => Boolean(value.certificateId || value.certificateUrl), {
  message: "A certificateId or certificateUrl is required.",
});

const expectedSubjectBindingSchema = z.object({
  did: z.string().trim().min(1).max(240).optional(),
  agentCardUrl: z.url().optional(),
  endpointUrl: z.url().optional(),
}).strict();

const trustPolicyRequestSchema = z.object({
  transactionType: transactionTypeSchema.default("agent_message"),
  minimumKyaLevel: z.enum(["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"]).optional(),
  maximumRiskClass: z.enum(["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"]).optional(),
  handshakePreference: handshakePreferenceSchema.optional(),
  fallbackMode: fallbackModeSchema.optional(),
  metadataAvailable: z.boolean().default(true),
  offlineLookupPerformed: z.boolean().default(true),
}).strict();

const verifyHandshakeInputSchema = z.object({
  challenge: handshakeChallengeSchema,
  signature: z.string().trim().min(32).max(4096),
  signatureAlgorithm: z.string().trim().min(1).max(40).optional(),
  expectedSubjectBinding: expectedSubjectBindingSchema.optional(),
  policy: trustPolicyRequestSchema.optional(),
}).strict();

type OperationalKeyBinding = z.infer<typeof operationalKeyBindingSchema>;
type HandshakeChallenge = z.infer<typeof handshakeChallengeSchema>;

function certificateIsUsable(input: { status: string; expiresAt: Date }) {
  return input.status === "active" && input.expiresAt.getTime() > Date.now();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function tryParseOperationalKeyBinding(value: unknown): OperationalKeyBinding | null {
  const parsed = operationalKeyBindingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function base64UrlRandom(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function defaultCertificateUrl(certificateId: string) {
  return getTrustRegistryUrl(
    `/kya-registry/certificates/${encodeURIComponent(certificateId)}`,
    process.env.XUPRA_TRUST_REGISTRY_BASE_URL ?? "https://xupracorp.com",
  );
}

function mcpServerUrl() {
  return getTrustRegistryUrl(
    "/api/kya-registry/v1/mcp",
    process.env.XUPRA_TRUST_REGISTRY_BASE_URL ?? "https://xupracorp.com",
  );
}

function bindingThumbprint(binding: OperationalKeyBinding) {
  return `sha256:${sha256Hex(stableStringify(binding.publicJwk))}`;
}

function inferAlgorithms(binding: OperationalKeyBinding) {
  if (binding.algorithms?.length) {
    return binding.algorithms;
  }

  const jwk = binding.publicJwk as JsonWebKey;

  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    return ["EdDSA"];
  }

  if (jwk.kty === "EC" && jwk.crv === "P-256") {
    return ["ES256"];
  }

  if (jwk.kty === "EC" && jwk.crv === "P-384") {
    return ["ES384"];
  }

  if (jwk.kty === "RSA") {
    return ["RS256", "PS256"];
  }

  return [];
}

function createVerifierForAlgorithm(binding: OperationalKeyBinding, signatureAlgorithm: string | undefined) {
  const normalizedAlgorithm = signatureAlgorithm ?? inferAlgorithms(binding)[0];

  if (!normalizedAlgorithm) {
    throw new Error("No signature algorithm is available for this certified operational key binding.");
  }

  if (binding.algorithms?.length && !binding.algorithms.includes(normalizedAlgorithm)) {
    throw new Error(`Signature algorithm ${normalizedAlgorithm} is not allowed by the certified key binding.`);
  }

  const key = createPublicKey({
    key: binding.publicJwk as JsonWebKey,
    format: "jwk",
  } as Parameters<typeof createPublicKey>[0]);

  switch (normalizedAlgorithm) {
    case "EdDSA":
    case "Ed25519":
      return {
        algorithm: normalizedAlgorithm,
        verify(data: Buffer, signature: Buffer) {
          return verifySignature(null, data, key, signature);
        },
      };
    case "ES256":
      return {
        algorithm: normalizedAlgorithm,
        verify(data: Buffer, signature: Buffer) {
          return verifySignature("sha256", data, key, signature);
        },
      };
    case "ES384":
      return {
        algorithm: normalizedAlgorithm,
        verify(data: Buffer, signature: Buffer) {
          return verifySignature("sha384", data, key, signature);
        },
      };
    case "RS256":
      return {
        algorithm: normalizedAlgorithm,
        verify(data: Buffer, signature: Buffer) {
          return verifySignature("sha256", data, key, signature);
        },
      };
    case "PS256":
      return {
        algorithm: normalizedAlgorithm,
        verify(data: Buffer, signature: Buffer) {
          return verifySignature("sha256", data, {
            key,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
          }, signature);
        },
      };
    default:
      throw new Error(`Unsupported signature algorithm: ${normalizedAlgorithm}`);
  }
}

function resolveCertificateId(input: { certificateId?: string; certificateUrl?: string }) {
  if (input.certificateId) {
    return input.certificateId;
  }

  if (!input.certificateUrl) {
    throw new Error("A certificateId or certificateUrl is required.");
  }

  const url = new URL(input.certificateUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

function buildCertificateSnapshot(input: {
  certificateId: string;
  status: string;
  expiresAt: Date;
  publicUrl: string | null;
  company: {
    displayName: string;
    websiteUrl: string;
    country: string;
  };
  registryAsset: {
    id: string;
    name: string;
    assetType: string;
    protocol: string | null;
    did: string | null;
    endpointUrl: string | null;
    agentCardUrl: string | null;
  } | null;
  riskClass: string | null;
  kyaLevel: string | null;
}) {
  return {
    certificateId: input.certificateId,
    status: input.status,
    active: certificateIsUsable(input),
    publicUrl: input.publicUrl ?? defaultCertificateUrl(input.certificateId),
    company: {
      name: input.company.displayName,
      websiteUrl: input.company.websiteUrl,
      country: input.company.country,
    },
    asset: input.registryAsset ? {
      id: input.registryAsset.id,
      name: input.registryAsset.name,
      type: input.registryAsset.assetType,
      protocol: input.registryAsset.protocol,
      did: input.registryAsset.did,
      endpointUrl: input.registryAsset.endpointUrl,
      agentCardUrl: input.registryAsset.agentCardUrl,
    } : null,
    review: {
      riskClass: input.riskClass,
      kyaLevel: input.kyaLevel,
      expiresAt: input.expiresAt.toISOString(),
    },
  };
}

function subjectBindingMatches(
  expected: z.infer<typeof expectedSubjectBindingSchema> | undefined,
  actual: OperationalKeyBinding | undefined,
) {
  if (!expected) {
    return true;
  }

  if (!actual) {
    return false;
  }

  if (expected.did && expected.did !== actual.did) {
    return false;
  }

  if (expected.agentCardUrl && expected.agentCardUrl !== actual.agentCardUrl) {
    return false;
  }

  if (expected.endpointUrl && expected.endpointUrl !== actual.endpointUrl) {
    return false;
  }

  return true;
}

function evaluateCertificatePolicy(input: {
  certificate: {
    status: string;
    expiresAt: Date;
    riskClass: string | null;
    kyaLevel: string | null;
  };
  transactionType: z.infer<typeof transactionTypeSchema>;
  policy: z.infer<typeof trustPolicyRequestSchema> | undefined;
  subjectBindingMatched: boolean;
  liveChallengeAttempted: boolean;
  liveChallengeVerified: boolean;
}) {
  const defaults = getDefaultTrustPolicy(input.transactionType);

  return evaluateTrustPolicy({
    transactionType: input.transactionType,
    minimumKyaLevel: input.policy?.minimumKyaLevel ?? defaults.minimumKyaLevel,
    maximumRiskClass: input.policy?.maximumRiskClass ?? defaults.maximumRiskClass,
    handshakePreference: input.policy?.handshakePreference ?? defaults.handshakePreference,
    fallbackMode: input.policy?.fallbackMode ?? defaults.fallbackMode,
    metadataAvailable: input.policy?.metadataAvailable ?? true,
    offlineLookupPerformed: input.policy?.offlineLookupPerformed ?? true,
    liveChallengeAttempted: input.liveChallengeAttempted,
    liveChallengeVerified: input.liveChallengeVerified,
    subjectBindingMatched: input.subjectBindingMatched,
    certificateActive: certificateIsUsable(input.certificate),
    certificateKyaLevel: input.certificate.kyaLevel as "KYA-L0" | "KYA-L1" | "KYA-L2" | "KYA-L3" | null,
    certificateRiskClass: input.certificate.riskClass as "MCP-R0" | "MCP-R1" | "MCP-R2" | "MCP-R3" | null,
  });
}

export function getCertifiedOperationalBindingForAsset(asset: {
  metadataJson: unknown;
  did: string | null;
  agentCardUrl: string | null;
  endpointUrl: string | null;
}) {
  const metadata = asRecord(asset.metadataJson);
  const handshakeMetadata = asRecord(metadata?.handshake);
  const candidates = [
    metadata?.operationalBinding,
    metadata?.handshakeBinding,
    handshakeMetadata?.operationalBinding,
  ];

  for (const candidate of candidates) {
    const parsed = tryParseOperationalKeyBinding(candidate);

    if (parsed) {
      return {
        ...parsed,
        did: parsed.did ?? asset.did ?? undefined,
        agentCardUrl: parsed.agentCardUrl ?? asset.agentCardUrl ?? undefined,
        endpointUrl: parsed.endpointUrl ?? asset.endpointUrl ?? undefined,
      } satisfies OperationalKeyBinding;
    }
  }

  return null;
}

export function getCertifiedOperationalBindingDetails(input: {
  signedCertificateJson: unknown;
  registryAsset: {
    metadataJson: unknown;
    did: string | null;
    agentCardUrl: string | null;
    endpointUrl: string | null;
  } | null;
}) {
  const signedCertificate = asRecord(input.signedCertificateJson);
  const signedBinding = tryParseOperationalKeyBinding(signedCertificate?.subjectBinding);

  if (signedBinding) {
    return {
      binding: signedBinding,
      source: "certificate" as const,
      thumbprint: bindingThumbprint(signedBinding),
      algorithms: inferAlgorithms(signedBinding),
    };
  }

  if (!input.registryAsset) {
    return null;
  }

  const assetBinding = getCertifiedOperationalBindingForAsset(input.registryAsset);

  if (!assetBinding) {
    return null;
  }

  return {
    binding: assetBinding,
    source: "asset_metadata" as const,
    thumbprint: bindingThumbprint(assetBinding),
    algorithms: inferAlgorithms(assetBinding),
  };
}

async function loadHandshakeCertificate(certificateId: string) {
  return prisma.trustCertificate.findUnique({
    where: { certificateId },
    include: {
      company: true,
      registryAsset: true,
    },
  });
}

export async function prepareHandshakeChallenge(input: unknown) {
  const parsed = prepareHandshakeInputSchema.parse(input);
  const certificateId = resolveCertificateId(parsed);
  const certificate = await loadHandshakeCertificate(certificateId);

  if (!certificate?.company) {
    throw new Error("Hosted KYA certificate not found.");
  }

  if (!certificateIsUsable(certificate)) {
    throw new Error("Hosted KYA certificate is not active for agent-to-agent transactions.");
  }

  const bindingDetails = getCertifiedOperationalBindingDetails({
    signedCertificateJson: certificate.signedCertificateJson,
    registryAsset: certificate.registryAsset,
  });

  if (!bindingDetails) {
    throw new Error("Hosted KYA certificate does not include a certified operational key binding.");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + parsed.ttlSeconds * 1000);
  const challenge = {
    version: "xupra-kya-handshake-v1",
    challengeId: `kya-${base64UrlRandom(12)}`,
    certificateId: certificate.certificateId,
    certificateUrl: certificate.publicUrl ?? defaultCertificateUrl(certificate.certificateId),
    transactionType: parsed.transactionType,
    nonce: parsed.nonce ?? base64UrlRandom(32),
    bindingThumbprint: bindingDetails.thumbprint,
    requester: parsed.requester,
    audience: parsed.audience,
    transactionId: parsed.transactionId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    mcpServerUrl: mcpServerUrl(),
  } satisfies HandshakeChallenge;
  const challengeText = stableStringify(challenge);

  return {
    issuer: TRUST_REGISTRY_PRODUCT_NAME,
    challenge,
    challengeText,
    challengeHash: `sha256:${sha256Hex(challengeText)}`,
    certificate: buildCertificateSnapshot(certificate),
    binding: {
      ...bindingDetails.binding,
      thumbprint: bindingDetails.thumbprint,
      algorithms: bindingDetails.algorithms,
      source: bindingDetails.source,
    },
    policyDefaults: getDefaultTrustPolicy(parsed.transactionType),
    publishedPolicies: getPublishedTrustPolicies(),
    verification: {
      challengeTool: "kya_prepare_handshake",
      verifyTool: "kya_verify_handshake",
      mcpServerUrl: mcpServerUrl(),
    },
  };
}

export async function evaluateHostedCertificateTrustPolicy(input: unknown) {
  const parsed = z.object({
    certificateId: z.string().trim().min(1).max(120).optional(),
    certificateUrl: z.url().optional(),
    expectedSubjectBinding: expectedSubjectBindingSchema.optional(),
    policy: trustPolicyRequestSchema.optional(),
  }).refine((value) => Boolean(value.certificateId || value.certificateUrl), {
    message: "A certificateId or certificateUrl is required.",
  }).parse(input);
  const certificateId = resolveCertificateId(parsed);
  const certificate = await loadHandshakeCertificate(certificateId);

  if (!certificate?.company) {
    throw new Error("Hosted KYA certificate was not found.");
  }

  const bindingDetails = getCertifiedOperationalBindingDetails({
    signedCertificateJson: certificate.signedCertificateJson,
    registryAsset: certificate.registryAsset,
  });
  const transactionType = parsed.policy?.transactionType ?? "agent_message";
  const binding = bindingDetails?.binding;
  const subjectBindingMatched = subjectBindingMatches(parsed.expectedSubjectBinding, binding);
  const policyEvaluation = evaluateCertificatePolicy({
    certificate,
    transactionType,
    policy: parsed.policy,
    subjectBindingMatched,
    liveChallengeAttempted: false,
    liveChallengeVerified: false,
  });

  return {
    certificate: buildCertificateSnapshot(certificate),
    handshake: {
      supported: Boolean(bindingDetails),
      mcpServerUrl: mcpServerUrl(),
      challengeTool: "kya_prepare_handshake",
      verifyTool: "kya_verify_handshake",
    },
    subjectBinding: bindingDetails
      ? {
        ...binding,
        thumbprint: bindingDetails.thumbprint,
        algorithms: bindingDetails.algorithms,
      }
      : null,
    trusted: policyEvaluation.allowed,
    policyEvaluation,
  };
}

export async function verifyHandshakeChallengeResponse(input: unknown) {
  const parsed = verifyHandshakeInputSchema.parse(input);
  const challenge = handshakeChallengeSchema.parse(parsed.challenge);
  const certificate = await loadHandshakeCertificate(challenge.certificateId);

  if (!certificate?.company) {
    return {
      verified: false,
      trusted: false,
      reason: "Hosted KYA certificate was not found.",
      challenge,
    };
  }

  const bindingDetails = getCertifiedOperationalBindingDetails({
    signedCertificateJson: certificate.signedCertificateJson,
    registryAsset: certificate.registryAsset,
  });

  if (!bindingDetails) {
    return {
      verified: false,
      trusted: false,
      reason: "Hosted KYA certificate does not include a certified operational key binding.",
      certificate: buildCertificateSnapshot(certificate),
      challenge,
    };
  }

  if (!certificateIsUsable(certificate)) {
    return {
      verified: false,
      trusted: false,
      reason: "Hosted KYA certificate is not active for agent-to-agent transactions.",
      certificate: buildCertificateSnapshot(certificate),
      challenge,
    };
  }

  if (challenge.certificateUrl !== (certificate.publicUrl ?? defaultCertificateUrl(certificate.certificateId))) {
    return {
      verified: false,
      trusted: false,
      reason: "Challenge certificate URL does not match the hosted certificate.",
      certificate: buildCertificateSnapshot(certificate),
      challenge,
    };
  }

  if (challenge.bindingThumbprint !== bindingDetails.thumbprint) {
    return {
      verified: false,
      trusted: false,
      reason: "Challenge key binding does not match the certified operational key.",
      certificate: buildCertificateSnapshot(certificate),
      challenge,
    };
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return {
      verified: false,
      trusted: false,
      reason: "Challenge has expired.",
      certificate: buildCertificateSnapshot(certificate),
      challenge,
    };
  }

  const verifier = createVerifierForAlgorithm(bindingDetails.binding, parsed.signatureAlgorithm);
  const challengeText = stableStringify(challenge);
  const signature = Buffer.from(parsed.signature, "base64url");
  const verified = verifier.verify(Buffer.from(challengeText, "utf8"), signature);
  const subjectBindingMatched = subjectBindingMatches(parsed.expectedSubjectBinding, bindingDetails.binding);
  const policyEvaluation = evaluateCertificatePolicy({
    certificate,
    transactionType: parsed.policy?.transactionType ?? challenge.transactionType,
    policy: parsed.policy,
    subjectBindingMatched,
    liveChallengeAttempted: true,
    liveChallengeVerified: verified,
  });

  return {
    verified,
    trusted: verified && policyEvaluation.allowed,
    reason: verified
      ? "Nonce signature matches the certified operational key."
      : "Nonce signature did not verify against the certified operational key.",
    certificate: buildCertificateSnapshot(certificate),
    challenge,
    challengeText,
    challengeHash: `sha256:${sha256Hex(challengeText)}`,
    binding: {
      ...bindingDetails.binding,
      thumbprint: bindingDetails.thumbprint,
      algorithms: bindingDetails.algorithms,
      source: bindingDetails.source,
      verifiedWith: verifier.algorithm,
    },
    policyEvaluation,
    validUntil: verified
      ? new Date(Math.min(
        new Date(challenge.expiresAt).getTime(),
        certificate.expiresAt.getTime(),
      )).toISOString()
      : undefined,
  };
}
