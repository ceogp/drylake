import { clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { entitlementsForTier } from "@/lib/services/billing";
import { recordAuditEvent } from "@/lib/services/audit";

const ACTIVE_PAID_STATUSES = new Set(["active", "past_due", "pastDue", "upcoming", "trialing"]);

type Tier = "free" | "pro" | "enterprise";

type ClerkBillingItem = {
  status?: string;
  amount?: { amount?: number | null } | null;
  plan?: { slug?: string | null; name?: string | null } | null;
  plan_id?: string | null;
};

type ClerkBillingSubscription = {
  id?: string;
  status?: string;
  payer_id?: string;
  subscription_items?: ClerkBillingItem[];
  items?: ClerkBillingItem[];
};

function pickItems(subscription: ClerkBillingSubscription | null | undefined) {
  if (!subscription) return [] as ClerkBillingItem[];
  return subscription.subscription_items ?? subscription.items ?? [];
}

function inferTier(items: ClerkBillingItem[]): Tier {
  const paidItems = items.filter((item) => {
    const status = String(item.status ?? "");
    const amount = item.amount?.amount ?? 0;
    return ACTIVE_PAID_STATUSES.has(status) && amount > 0;
  });

  if (paidItems.length === 0) return "free";

  const hasEnterprise = paidItems.some((item) => {
    const slug = String(item.plan?.slug ?? "").toLowerCase();
    const name = String(item.plan?.name ?? "").toLowerCase();
    return slug.includes("enterprise") || name.includes("enterprise");
  });

  return hasEnterprise ? "enterprise" : "pro";
}

async function fetchUserSubscription(clerkUserId: string): Promise<ClerkBillingSubscription | null> {
  try {
    const client = await clerkClient();
    // The billing API is experimental; cast through unknown to avoid SDK type drift.
    const billing = (client as unknown as {
      billing?: { getUserBillingSubscription?: (id: string) => Promise<unknown> };
    }).billing;

    if (!billing?.getUserBillingSubscription) return null;
    const result = (await billing.getUserBillingSubscription(clerkUserId)) as ClerkBillingSubscription | null;
    return result ?? null;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}


export type ClerkSyncResult = {
  ok: true;
  tier: Tier;
  status: string;
  source: "user" | "organization" | "none";
  payerId: string | null;
};

export async function syncSubscriptionFromClerk(organizationId: string): Promise<ClerkSyncResult> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: {
      memberships: {
        where: { user: { authProvider: "clerk" } },
        orderBy: { createdAt: "asc" },
        include: { user: true },
      },
    },
  });

  let subscription: ClerkBillingSubscription | null = null;
  let source: ClerkSyncResult["source"] = "none";

  for (const membership of organization.memberships) {
    const clerkUserId = membership.user.authSubject;
    if (!clerkUserId) continue;
    subscription = await fetchUserSubscription(clerkUserId);
    if (subscription) {
      source = "user";
      break;
    }
  }

  const items = pickItems(subscription);
  const tier = inferTier(items);
  const status = String(subscription?.status ?? (tier === "free" ? "free" : "active"));

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      provider: "clerk",
      tier,
      status,
      entitlementsJson: entitlementsForTier(tier),
    },
    create: {
      organizationId,
      provider: "clerk",
      tier,
      status,
      entitlementsJson: entitlementsForTier(tier),
      limitsJson: {},
    },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { tier },
  });

  await recordAuditEvent({
    organizationId,
    actorUserId: null,
    entityType: "subscription",
    entityId: organizationId,
    action: "billing.sync.clerk",
    metadata: { tier, status, source },
  });

  return {
    ok: true,
    tier,
    status,
    source,
    payerId: subscription?.payer_id ?? null,
  };
}

export async function setOrganizationTier(params: {
  organizationId: string;
  tier: Tier;
  operatorUsername?: string;
}) {
  const { organizationId, tier, operatorUsername } = params;
  const status = tier === "free" ? "free" : "active";

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      tier,
      status,
      entitlementsJson: entitlementsForTier(tier),
    },
    create: {
      organizationId,
      provider: "manual",
      tier,
      status,
      entitlementsJson: entitlementsForTier(tier),
      limitsJson: {},
    },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { tier },
  });

  await recordAuditEvent({
    organizationId,
    actorUserId: null,
    entityType: "subscription",
    entityId: organizationId,
    action: "billing.tier.manual_override",
    metadata: { tier, operatorUsername: operatorUsername ?? null },
  });
}
