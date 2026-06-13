import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type EntitlementKey =
  | "canUseHostedPlanning"
  | "canUseFixWithAI"
  | "canUseApprovedUpload"
  | "canUseDeepCloudAnalysis"
  | "canUseSuspiciousArtifactScan"
  | "canUseLocalWatchdog"
  | "canCreateTeam"
  | "canUseTeamBaseline"
  | "canUseContinuousWatch"
  | "canManageTeamPolicy"
  | "xupra_pro_ai"
  | "session_cloud_sync"
  | "pr_summary_generation";

export type EntitlementMap = Record<EntitlementKey, boolean>;
export type PlanTier = "free" | "pro" | "security_pro" | "team_security" | "enterprise";
export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export type ResolvedEntitlements = {
  plan: PlanTier;
  subjectType: "user" | "team";
  subjectId: string;
  entitlementVersion: number;
  canUseHostedPlanning: boolean;
  canUseFixWithAI: boolean;
  canUseApprovedUpload: boolean;
  canUseDeepCloudAnalysis: boolean;
  canUseSuspiciousArtifactScan: boolean;
  canUseLocalWatchdog: boolean;
  canCreateTeam: boolean;
  canUseTeamBaseline: boolean;
  canUseContinuousWatch: boolean;
  canManageTeamPolicy: boolean;
  billingStatus: BillingStatus;
  currentPeriodEnd?: string;
};

const DEFAULT_ENTITLEMENTS: Record<PlanTier, EntitlementMap> = {
  free: {
    canUseHostedPlanning: false,
    canUseFixWithAI: false,
    canUseApprovedUpload: false,
    canUseDeepCloudAnalysis: false,
    canUseSuspiciousArtifactScan: true,
    canUseLocalWatchdog: false,
    canCreateTeam: false,
    canUseTeamBaseline: false,
    canUseContinuousWatch: false,
    canManageTeamPolicy: false,
    xupra_pro_ai: false,
    session_cloud_sync: false,
    pr_summary_generation: false,
  },
  pro: {
    canUseHostedPlanning: true,
    canUseFixWithAI: false,
    canUseApprovedUpload: false,
    canUseDeepCloudAnalysis: false,
    canUseSuspiciousArtifactScan: true,
    canUseLocalWatchdog: false,
    canCreateTeam: false,
    canUseTeamBaseline: false,
    canUseContinuousWatch: false,
    canManageTeamPolicy: false,
    xupra_pro_ai: true,
    session_cloud_sync: true,
    pr_summary_generation: true,
  },
  security_pro: {
    canUseHostedPlanning: true,
    canUseFixWithAI: true,
    canUseApprovedUpload: true,
    canUseDeepCloudAnalysis: true,
    canUseSuspiciousArtifactScan: true,
    canUseLocalWatchdog: true,
    canCreateTeam: false,
    canUseTeamBaseline: false,
    canUseContinuousWatch: false,
    canManageTeamPolicy: false,
    xupra_pro_ai: true,
    session_cloud_sync: true,
    pr_summary_generation: true,
  },
  team_security: {
    canUseHostedPlanning: true,
    canUseFixWithAI: true,
    canUseApprovedUpload: true,
    canUseDeepCloudAnalysis: true,
    canUseSuspiciousArtifactScan: true,
    canUseLocalWatchdog: true,
    canCreateTeam: true,
    canUseTeamBaseline: true,
    canUseContinuousWatch: true,
    canManageTeamPolicy: true,
    xupra_pro_ai: true,
    session_cloud_sync: true,
    pr_summary_generation: true,
  },
  enterprise: {
    canUseHostedPlanning: true,
    canUseFixWithAI: true,
    canUseApprovedUpload: true,
    canUseDeepCloudAnalysis: true,
    canUseSuspiciousArtifactScan: true,
    canUseLocalWatchdog: true,
    canCreateTeam: true,
    canUseTeamBaseline: true,
    canUseContinuousWatch: true,
    canManageTeamPolicy: true,
    xupra_pro_ai: true,
    session_cloud_sync: true,
    pr_summary_generation: true,
  },
};

export const CAPABILITY_KEYS = [
  "canUseHostedPlanning",
  "canUseFixWithAI",
  "canUseApprovedUpload",
  "canUseDeepCloudAnalysis",
  "canUseSuspiciousArtifactScan",
  "canUseLocalWatchdog",
  "canCreateTeam",
  "canUseTeamBaseline",
  "canUseContinuousWatch",
  "canManageTeamPolicy",
] as const satisfies readonly EntitlementKey[];

export function normalizePlanTier(tier: string | null | undefined): PlanTier {
  const normalized = String(tier ?? "free").toLowerCase();
  if (
    normalized === "pro" ||
    normalized === "security_pro" ||
    normalized === "team_security" ||
    normalized === "enterprise"
  ) {
    return normalized;
  }

  return "free";
}

function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  const normalized = String(status ?? "none").toLowerCase();
  if (
    normalized === "trialing" ||
    normalized === "active" ||
    normalized === "past_due" ||
    normalized === "canceled" ||
    normalized === "incomplete"
  ) {
    return normalized;
  }

  return normalized === "free" || normalized === "trial" ? "none" : "none";
}

function defaultEntitlementsForTier(tier: string | null | undefined) {
  return DEFAULT_ENTITLEMENTS[normalizePlanTier(tier)];
}

export async function getOrganizationSubscription(organizationId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId },
  });
}

export async function getEntitlementsForOrganization(
  organizationId: string,
  options?: { userId?: string },
) {
  const subscription = await getOrganizationSubscription(organizationId);
  const organization = await prisma.organization?.findUnique?.({
    where: { id: organizationId },
    select: { id: true, tier: true, updatedAt: true },
  }) ?? null;

  const plan = normalizePlanTier(subscription?.tier ?? organization?.tier ?? "free");
  const base = defaultEntitlementsForTier(plan);
  const overrides = ((subscription?.entitlementsJson as Partial<EntitlementMap> | null) ?? {});
  const entitlements = {
    ...base,
    ...overrides,
  } satisfies EntitlementMap;
  const currentPeriodEnd = subscription?.currentPeriodEndsAt?.toISOString();
  const entitlementVersion = Math.max(
    subscription?.updatedAt?.getTime() ?? 0,
    organization?.updatedAt?.getTime() ?? 0,
  );
  const isTeamScopedPlan = plan === "team_security" || plan === "enterprise";
  const resolved: ResolvedEntitlements = {
    plan,
    subjectType: isTeamScopedPlan ? "team" : "user",
    subjectId: isTeamScopedPlan ? organizationId : options?.userId ?? organizationId,
    entitlementVersion,
    canUseHostedPlanning: Boolean(entitlements.canUseHostedPlanning),
    canUseFixWithAI: Boolean(entitlements.canUseFixWithAI),
    canUseApprovedUpload: Boolean(entitlements.canUseApprovedUpload),
    canUseDeepCloudAnalysis: Boolean(entitlements.canUseDeepCloudAnalysis),
    canUseSuspiciousArtifactScan: Boolean(entitlements.canUseSuspiciousArtifactScan),
    canUseLocalWatchdog: Boolean(entitlements.canUseLocalWatchdog),
    canCreateTeam: Boolean(entitlements.canCreateTeam),
    canUseTeamBaseline: Boolean(entitlements.canUseTeamBaseline),
    canUseContinuousWatch: Boolean(entitlements.canUseContinuousWatch),
    canManageTeamPolicy: Boolean(entitlements.canManageTeamPolicy),
    billingStatus: normalizeBillingStatus(subscription?.status),
    ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
  };

  return {
    subscription,
    entitlements,
    resolved,
  };
}

export async function hasEntitlement(organizationId: string, key: EntitlementKey) {
  if (env.BILLING_ENFORCEMENT_MODE === "development") {
    return true;
  }

  const { entitlements } = await getEntitlementsForOrganization(organizationId);
  return Boolean(entitlements[key]);
}

export async function assertEntitlement(organizationId: string, key: EntitlementKey) {
  const allowed = await hasEntitlement(organizationId, key);

  if (!allowed) {
    throw new Error(`Organization is not entitled to use ${key}`);
  }
}
