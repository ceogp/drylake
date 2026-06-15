import { z } from "zod";

const kyaLevelOrder = ["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"] as const;
const riskClassOrder = ["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"] as const;

export const transactionTypeSchema = z.enum([
  "directory_lookup",
  "agent_message",
  "tool_invocation",
  "data_access",
  "payment_instruction",
  "wallet_signing",
]);

export const handshakePreferenceSchema = z.enum([
  "offline_ok",
  "live_preferred",
  "live_required",
]);

export const fallbackModeSchema = z.enum([
  "deny_when_offline",
  "allow_offline_lookup",
]);

export const trustPolicyInputSchema = z.object({
  transactionType: transactionTypeSchema.default("agent_message"),
  minimumKyaLevel: z.enum(kyaLevelOrder).optional(),
  maximumRiskClass: z.enum(riskClassOrder).optional(),
  handshakePreference: handshakePreferenceSchema.optional(),
  fallbackMode: fallbackModeSchema.optional(),
  metadataAvailable: z.boolean().default(true),
  liveChallengeAttempted: z.boolean().default(false),
  liveChallengeVerified: z.boolean().default(false),
  offlineLookupPerformed: z.boolean().default(true),
  subjectBindingMatched: z.boolean().default(true),
  certificateActive: z.boolean(),
  certificateKyaLevel: z.enum(kyaLevelOrder).optional().nullable(),
  certificateRiskClass: z.enum(riskClassOrder).optional().nullable(),
}).strict();

type TransactionType = z.infer<typeof transactionTypeSchema>;
type KyaLevel = typeof kyaLevelOrder[number];
type RiskClass = typeof riskClassOrder[number];
type HandshakePreference = z.infer<typeof handshakePreferenceSchema>;
type FallbackMode = z.infer<typeof fallbackModeSchema>;

type PolicyDefaults = {
  transactionType: TransactionType;
  minimumKyaLevel: KyaLevel;
  maximumRiskClass: RiskClass;
  handshakePreference: HandshakePreference;
  fallbackMode: FallbackMode;
};

const defaultPolicies: Record<TransactionType, PolicyDefaults> = {
  directory_lookup: {
    transactionType: "directory_lookup",
    minimumKyaLevel: "KYA-L1",
    maximumRiskClass: "MCP-R3",
    handshakePreference: "offline_ok",
    fallbackMode: "allow_offline_lookup",
  },
  agent_message: {
    transactionType: "agent_message",
    minimumKyaLevel: "KYA-L1",
    maximumRiskClass: "MCP-R2",
    handshakePreference: "live_preferred",
    fallbackMode: "allow_offline_lookup",
  },
  tool_invocation: {
    transactionType: "tool_invocation",
    minimumKyaLevel: "KYA-L2",
    maximumRiskClass: "MCP-R2",
    handshakePreference: "live_preferred",
    fallbackMode: "deny_when_offline",
  },
  data_access: {
    transactionType: "data_access",
    minimumKyaLevel: "KYA-L2",
    maximumRiskClass: "MCP-R1",
    handshakePreference: "live_preferred",
    fallbackMode: "deny_when_offline",
  },
  payment_instruction: {
    transactionType: "payment_instruction",
    minimumKyaLevel: "KYA-L2",
    maximumRiskClass: "MCP-R1",
    handshakePreference: "live_required",
    fallbackMode: "deny_when_offline",
  },
  wallet_signing: {
    transactionType: "wallet_signing",
    minimumKyaLevel: "KYA-L3",
    maximumRiskClass: "MCP-R0",
    handshakePreference: "live_required",
    fallbackMode: "deny_when_offline",
  },
};

function levelRank<T extends readonly string[]>(order: T, value: string | null | undefined) {
  if (!value) {
    return -1;
  }

  return order.indexOf(value as T[number]);
}

export function getDefaultTrustPolicy(transactionType: TransactionType) {
  return defaultPolicies[transactionType];
}

export function getPublishedTrustPolicies() {
  return Object.values(defaultPolicies);
}

export function evaluateTrustPolicy(input: unknown) {
  const parsed = trustPolicyInputSchema.parse(input);
  const defaults = getDefaultTrustPolicy(parsed.transactionType);
  const minimumKyaLevel = parsed.minimumKyaLevel ?? defaults.minimumKyaLevel;
  const maximumRiskClass = parsed.maximumRiskClass ?? defaults.maximumRiskClass;
  const handshakePreference = parsed.handshakePreference ?? defaults.handshakePreference;
  const fallbackMode = parsed.fallbackMode ?? defaults.fallbackMode;
  const reasons: string[] = [];

  if (!parsed.metadataAvailable) {
    reasons.push("Issuer metadata is unavailable.");
  }

  if (!parsed.certificateActive) {
    reasons.push("Hosted certificate is not active.");
  }

  if (!parsed.offlineLookupPerformed) {
    reasons.push("Hosted certificate lookup was not completed.");
  }

  const currentKyaRank = levelRank(kyaLevelOrder, parsed.certificateKyaLevel);
  const requiredKyaRank = levelRank(kyaLevelOrder, minimumKyaLevel);
  if (currentKyaRank < requiredKyaRank) {
    reasons.push(`Certificate KYA level ${parsed.certificateKyaLevel ?? "unknown"} is below required ${minimumKyaLevel}.`);
  }

  const currentRiskRank = levelRank(riskClassOrder, parsed.certificateRiskClass);
  const maximumRiskRank = levelRank(riskClassOrder, maximumRiskClass);
  if (currentRiskRank === -1 || currentRiskRank > maximumRiskRank) {
    reasons.push(`Certificate risk class ${parsed.certificateRiskClass ?? "unknown"} exceeds allowed ${maximumRiskClass}.`);
  }

  if (!parsed.subjectBindingMatched) {
    reasons.push("Subject binding did not match the certified asset identity.");
  }

  if (handshakePreference === "live_required" && !parsed.liveChallengeVerified) {
    reasons.push("Live challenge verification is required for this transaction type.");
  } else if (handshakePreference === "live_preferred" && parsed.liveChallengeAttempted && !parsed.liveChallengeVerified) {
    reasons.push("Live challenge verification was attempted but did not verify.");
  }

  if (!parsed.metadataAvailable && fallbackMode === "deny_when_offline") {
    reasons.push("Policy denies fallback when issuer metadata is unavailable.");
  }

  if (!parsed.liveChallengeVerified && handshakePreference !== "offline_ok" && fallbackMode === "deny_when_offline") {
    reasons.push("Policy denies offline-only fallback for this transaction type.");
  }

  const allowed = reasons.length === 0;

  return {
    allowed,
    decision: allowed ? "allow" as const : "deny" as const,
    reasons,
    policy: {
      transactionType: parsed.transactionType,
      minimumKyaLevel,
      maximumRiskClass,
      handshakePreference,
      fallbackMode,
    },
    evidence: {
      metadataAvailable: parsed.metadataAvailable,
      offlineLookupPerformed: parsed.offlineLookupPerformed,
      liveChallengeAttempted: parsed.liveChallengeAttempted,
      liveChallengeVerified: parsed.liveChallengeVerified,
      subjectBindingMatched: parsed.subjectBindingMatched,
      certificateKyaLevel: parsed.certificateKyaLevel ?? null,
      certificateRiskClass: parsed.certificateRiskClass ?? null,
      certificateActive: parsed.certificateActive,
    },
  };
}
