import Stripe from "stripe";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { entitlementsForTier } from "@/lib/services/billing";
import { recordAuditEvent } from "@/lib/services/audit";

type Tier = "free" | "pro" | "security_pro" | "team_security" | "enterprise";
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

// ---------- Stripe live sync ----------

const STRIPE_ACTIVE_STATUSES = new Set<string>(["active", "trialing", "past_due"]);

function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

function tierForStripePriceId(priceId: string | null | undefined): Tier {
  if (priceId && env.STRIPE_ENTERPRISE_PRICE_ID && priceId === env.STRIPE_ENTERPRISE_PRICE_ID) {
    return "enterprise";
  }
  if (priceId && env.STRIPE_TEAM_SECURITY_PRICE_ID && priceId === env.STRIPE_TEAM_SECURITY_PRICE_ID) {
    return "team_security";
  }
  if (priceId && env.STRIPE_SECURITY_PRO_PRICE_ID && priceId === env.STRIPE_SECURITY_PRO_PRICE_ID) {
    return "security_pro";
  }
  if (priceId && env.STRIPE_PRO_PRICE_ID && priceId === env.STRIPE_PRO_PRICE_ID) {
    return "pro";
  }
  return "free";
}

function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  // Prefer enterprise > pro > active > trialing > others.
  const ranked = subs
    .filter((sub) => STRIPE_ACTIVE_STATUSES.has(sub.status))
    .map((sub) => {
      const priceId = sub.items.data[0]?.price?.id ?? null;
      const tier = tierForStripePriceId(priceId);
      const tierWeight = tier === "enterprise" ? 5 : tier === "team_security" ? 4 : tier === "security_pro" ? 3 : tier === "pro" ? 2 : 1;
      const statusWeight = sub.status === "active" ? 3 : sub.status === "trialing" ? 2 : 1;
      return { sub, score: tierWeight * 10 + statusWeight };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.sub ?? null;
}

export type StripeSyncResult = {
  ok: true;
  tier: Tier;
  status: string;
  source: "customer" | "email" | "none";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export async function syncSubscriptionFromStripe(organizationId: string): Promise<StripeSyncResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      ok: true,
      tier: "free",
      status: "free",
      source: "none",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: {
      subscriptions: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        include: { user: true },
      },
    },
  });

  const existingSub = organization.subscriptions[0] ?? null;
  const customerIds = new Set<string>();
  if (existingSub?.stripeCustomerId) customerIds.add(existingSub.stripeCustomerId);

  // Also discover customers by member email so freshly-paid users sync without prior webhook.
  const emails = Array.from(
    new Set(
      organization.memberships
        .map((m) => m.user.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  );

  for (const email of emails) {
    try {
      const list = await stripe.customers.list({ email, limit: 5 });
      for (const customer of list.data) {
        if (customer.id) customerIds.add(customer.id);
      }
    } catch (error) {
      console.warn("[billing-sync] stripe.customers.list failed", { email, error });
    }
  }

  let bestSubscription: Stripe.Subscription | null = null;
  let sourceCustomerId: string | null = null;
  let source: StripeSyncResult["source"] = "none";

  for (const customerId of customerIds) {
    try {
      const subsResponse = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const candidate = pickBestSubscription(subsResponse.data);
      if (!candidate) continue;

      const candidatePrice = candidate.items.data[0]?.price?.id ?? null;
      const candidateTier = tierForStripePriceId(candidatePrice);

      const currentPrice = bestSubscription?.items.data[0]?.price?.id ?? null;
      const currentTier = tierForStripePriceId(currentPrice);
      const currentWeight = currentTier === "enterprise" ? 5 : currentTier === "team_security" ? 4 : currentTier === "security_pro" ? 3 : currentTier === "pro" ? 2 : 0;
      const candidateWeight = candidateTier === "enterprise" ? 5 : candidateTier === "team_security" ? 4 : candidateTier === "security_pro" ? 3 : candidateTier === "pro" ? 2 : 0;

      if (!bestSubscription || candidateWeight > currentWeight) {
        bestSubscription = candidate;
        sourceCustomerId = customerId;
        source = existingSub?.stripeCustomerId === customerId ? "customer" : "email";
      }
    } catch (error) {
      console.warn("[billing-sync] stripe.subscriptions.list failed", { customerId, error });
    }
  }

  const priceId = bestSubscription?.items.data[0]?.price?.id ?? null;
  const tier = tierForStripePriceId(priceId);
  const status = bestSubscription?.status ?? (existingSub?.status ?? (tier === "free" ? "free" : "active"));
  const stripeSubscriptionId = bestSubscription?.id ?? null;
  const periodEndUnix = bestSubscription?.items.data[0]?.current_period_end ?? null;

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      provider: "stripe",
      tier,
      status,
      stripeCustomerId: sourceCustomerId ?? undefined,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      stripePriceId: priceId ?? undefined,
      currentPeriodEndsAt: periodEndUnix ? new Date(periodEndUnix * 1000) : undefined,
      cancelAtPeriodEnd: Boolean(bestSubscription?.cancel_at_period_end),
      entitlementsJson: entitlementsForTier(tier),
    },
    create: {
      organizationId,
      provider: "stripe",
      tier,
      status,
      stripeCustomerId: sourceCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      currentPeriodEndsAt: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: Boolean(bestSubscription?.cancel_at_period_end),
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
    action: "billing.sync.stripe",
    metadata: {
      tier,
      status,
      source,
      stripeCustomerId: sourceCustomerId,
      stripeSubscriptionId,
    },
  });

  return {
    ok: true,
    tier,
    status,
    source,
    stripeCustomerId: sourceCustomerId,
    stripeSubscriptionId,
  };
}
