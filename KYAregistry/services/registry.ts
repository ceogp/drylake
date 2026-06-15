import crypto from "node:crypto";

import { z } from "zod";

export const TRUST_REGISTRY_PRODUCT_NAME = "Xupra KYA Registry";
export const TRUST_REGISTRY_STANDARD_VERSION = "mcp-kya-basic-v0.1";
export const TRUST_REGISTRY_STANDARD_LABEL = "Xupra KYA Agent Transaction Standard v0.1";

export const mcpRiskClassSchema = z.enum(["MCP-R0", "MCP-R1", "MCP-R2", "MCP-R3"]);
export const kyaLevelSchema = z.enum(["KYA-L0", "KYA-L1", "KYA-L2", "KYA-L3"]);
export const trustDecisionSchema = z.enum(["pass", "needs_remediation", "fail"]);

export type McpRiskClass = z.infer<typeof mcpRiskClassSchema>;
export type KyaLevel = z.infer<typeof kyaLevelSchema>;
export type TrustDecision = z.infer<typeof trustDecisionSchema>;

export const companySizeClassSchema = z.enum(["small", "large"]);
export const trustProductCategorySchema = z.enum([
  "mcp_server",
  "kya_provider",
  "ai_agent_platform",
  "wallet_signing_provider",
  "x402_candidate",
  "xrpl_rlusd_candidate",
  "enterprise_mcp_gateway",
]);

export const mcpTransportSchema = z.enum(["stdio", "streamable_http", "both"]);
export const mcpPackageTypeSchema = z.enum([
  "npm",
  "pypi",
  "docker",
  "github_release",
  "remote_http_only",
]);

export const kyaQuestionnaireSchema = z.object({
  stableAgentIdentity: z.boolean().default(false),
  cryptographicallyVerifiableAgentIdentity: z.boolean().default(false),
  principalIdentity: z.boolean().default(false),
  consentRecord: z.boolean().default(false),
  delegatedAuthorityByActionType: z.boolean().default(false),
  amountFrequencyDestinationOrResourceLimits: z.boolean().default(false),
  delegationExpiry: z.boolean().default(false),
  delegationRevocation: z.boolean().default(false),
  auditLogs: z.boolean().default(false),
  signedOrTamperEvidentAuditLogs: z.boolean().default(false),
  thirdPartyVerificationApi: z.boolean().default(false),
  agentsCanInitiatePaymentsOrFinancialActions: z.boolean().default(false),
  humanApprovalThresholds: z.boolean().default(false),
  walletSigningPrivateKeyBoundariesDocumented: z.boolean().default(false),
}).strict();

export type KyaQuestionnaireAnswers = z.infer<typeof kyaQuestionnaireSchema>;

export const mcpPermissionProfileSchema = z.object({
  requiresSecrets: z.boolean().default(false),
  filesystemAccess: z.enum(["none", "read", "write"]).default("none"),
  shellExecution: z.boolean().default(false),
  networkAccess: z.boolean().default(false),
  databaseWriteAccess: z.boolean().default(false),
  emailMessageAccess: z.boolean().default(false),
  walletPaymentAccess: z.boolean().default(false),
  productionWriteAccess: z.boolean().default(false),
  broadSecretsAccess: z.boolean().default(false),
  privateKeyAccess: z.boolean().default(false),
}).strict();

export type McpPermissionProfile = z.infer<typeof mcpPermissionProfileSchema>;

export const trustScanSignalsSchema = z.object({
  declaredToolsMatchObservedTools: z.boolean().default(true),
  hiddenShellExecution: z.boolean().default(false),
  hiddenPrivateKeyAccess: z.boolean().default(false),
  hiddenEmailOrDataExfiltration: z.boolean().default(false),
  packageOwnershipMismatch: z.boolean().default(false),
  misleadingToolDescriptions: z.boolean().default(false),
  maintainerIdentityVerified: z.boolean().default(false),
  requiredSecretsDisclosed: z.boolean().default(true),
  criticalFindings: z.number().int().min(0).default(0),
  highFindings: z.number().int().min(0).default(0),
  mediumFindings: z.number().int().min(0).default(0),
}).strict();

export type TrustScanSignals = z.infer<typeof trustScanSignalsSchema>;

export function toBase64Url(value: Uint8Array | Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

export function sha256Hex(value: string | Uint8Array) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown) {
  return `sha256:${sha256Hex(stableStringify(value))}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}

export function scoreKyaQuestionnaire(input: unknown) {
  const answers = kyaQuestionnaireSchema.parse(input);
  const score =
    (answers.stableAgentIdentity ? 10 : 0) +
    (answers.cryptographicallyVerifiableAgentIdentity ? 10 : 0) +
    (answers.principalIdentity ? 15 : 0) +
    (answers.consentRecord ? 15 : 0) +
    (answers.delegatedAuthorityByActionType ? 5 : 0) +
    (answers.amountFrequencyDestinationOrResourceLimits ? 5 : 0) +
    (answers.delegationExpiry ? 5 : 0) +
    (answers.delegationRevocation ? 10 : 0) +
    (answers.auditLogs ? 10 : 0) +
    (answers.signedOrTamperEvidentAuditLogs ? 5 : 0) +
    (answers.thirdPartyVerificationApi ? 10 : 0);

  return {
    answers,
    score,
    kyaLevel: kyaLevelForScore(score),
    paymentControlsDocumented:
      !answers.agentsCanInitiatePaymentsOrFinancialActions ||
      (answers.humanApprovalThresholds && answers.walletSigningPrivateKeyBoundariesDocumented),
  };
}

export function kyaLevelForScore(score: number): KyaLevel {
  if (score >= 90) return "KYA-L3";
  if (score >= 70) return "KYA-L2";
  if (score >= 40) return "KYA-L1";
  return "KYA-L0";
}

export function classifyMcpRisk(input: unknown): McpRiskClass {
  const profile = mcpPermissionProfileSchema.parse(input);

  if (
    profile.shellExecution ||
    profile.filesystemAccess === "write" ||
    profile.walletPaymentAccess ||
    profile.productionWriteAccess ||
    profile.privateKeyAccess ||
    profile.broadSecretsAccess
  ) {
    return "MCP-R3";
  }

  if (profile.databaseWriteAccess || profile.emailMessageAccess) {
    return "MCP-R2";
  }

  if (
    profile.networkAccess ||
    profile.requiresSecrets ||
    profile.filesystemAccess === "read"
  ) {
    return "MCP-R1";
  }

  return "MCP-R0";
}

export function recommendTrustDecision(input: unknown): {
  decision: TrustDecision;
  reasons: string[];
} {
  const signals = trustScanSignalsSchema.parse(input);
  const failReasons = [
    signals.hiddenShellExecution ? "hidden shell execution" : null,
    signals.hiddenPrivateKeyAccess ? "hidden private-key access" : null,
    signals.hiddenEmailOrDataExfiltration ? "hidden email or data exfiltration" : null,
    signals.packageOwnershipMismatch ? "package ownership mismatch" : null,
    signals.misleadingToolDescriptions ? "misleading tool descriptions" : null,
    signals.criticalFindings > 0 ? "critical findings unresolved" : null,
  ].filter((reason): reason is string => Boolean(reason));

  if (failReasons.length > 0) {
    return { decision: "fail", reasons: failReasons };
  }

  const remediationReasons = [
    !signals.declaredToolsMatchObservedTools ? "declared tools do not match observed tools" : null,
    !signals.maintainerIdentityVerified ? "maintainer identity is not verified" : null,
    !signals.requiredSecretsDisclosed ? "required secrets are not disclosed" : null,
    signals.highFindings > 0 ? "high findings unresolved" : null,
    signals.mediumFindings > 0 ? "medium findings need review" : null,
  ].filter((reason): reason is string => Boolean(reason));

  if (remediationReasons.length > 0) {
    return { decision: "needs_remediation", reasons: remediationReasons };
  }

  return { decision: "pass", reasons: ["basic scan pass criteria satisfied"] };
}

export function formatCertificateId(input: {
  scope?: "XMKS" | "XMKS-MCP" | "XMKS-KYA" | "XMKS-JP" | "XMKS-XRPL-CANDIDATE";
  issuedAt?: Date;
  sequence: number;
}) {
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 999_999) {
    throw new Error("Certificate sequence must be an integer from 1 to 999999.");
  }

  const year = (input.issuedAt ?? new Date()).getUTCFullYear();
  return `${input.scope ?? "XMKS"}-${year}-${String(input.sequence).padStart(6, "0")}`;
}

export function getTrustRegistryUrl(pathname: string, baseUrl: string) {
  const url = new URL(pathname, baseUrl);
  return url.toString();
}
