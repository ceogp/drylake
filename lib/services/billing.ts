import Stripe from "stripe";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/services/audit";

function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}

export function entitlementsForTier(tier: string) {
  switch (tier) {
    case "pro":
      return {
        xupra_pro_ai: true,
        session_cloud_sync: true,
        pr_summary_generation: true,
      };
    case "enterprise":
      return {
        xupra_pro_ai: true,
        session_cloud_sync: true,
        pr_summary_generation: true,
      };
    default:
      return {
        xupra_pro_ai: false,
        session_cloud_sync: false,
        pr_summary_generation: false,
      };
  }
}

async function upsertSubscriptionFromStripe(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string;
  stripePriceId?: string | null;
  status: string;
  currentPeriodEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const organization = await prisma.organization.findFirst({
    where: {
      OR: [
        params.stripeCustomerId ? { subscriptions: { some: { stripeCustomerId: params.stripeCustomerId } } } : undefined,
        { subscriptions: { some: { stripeSubscriptionId: params.stripeSubscriptionId } } },
      ].filter(Boolean) as unknown as [],
    },
    include: {
      subscriptions: true,
    },
  });

  if (!organization) {
    return null;
  }

  const tier =
    params.stripePriceId && params.stripePriceId === env.STRIPE_ENTERPRISE_PRICE_ID
      ? "enterprise"
      : params.stripePriceId && params.stripePriceId === env.STRIPE_PRO_PRICE_ID
        ? "pro"
        : "free";

  return prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      provider: "stripe",
      tier,
      status: params.status,
      stripeCustomerId: params.stripeCustomerId ?? undefined,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripePriceId: params.stripePriceId ?? undefined,
      currentPeriodEndsAt: params.currentPeriodEndsAt ?? undefined,
      cancelAtPeriodEnd: Boolean(params.cancelAtPeriodEnd),
      entitlementsJson: entitlementsForTier(tier),
    },
    create: {
      organizationId: organization.id,
      provider: "stripe",
      tier,
      status: params.status,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripePriceId: params.stripePriceId ?? null,
      currentPeriodEndsAt: params.currentPeriodEndsAt ?? null,
      cancelAtPeriodEnd: Boolean(params.cancelAtPeriodEnd),
      entitlementsJson: entitlementsForTier(tier),
      limitsJson: {},
    },
  });
}

async function upsertSubscriptionForOrganization(params: {
  organizationId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  status: string;
  currentPeriodEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const tier =
    params.stripePriceId && params.stripePriceId === env.STRIPE_ENTERPRISE_PRICE_ID
      ? "enterprise"
      : params.stripePriceId && params.stripePriceId === env.STRIPE_PRO_PRICE_ID
        ? "pro"
        : "free";

  return prisma.subscription.upsert({
    where: { organizationId: params.organizationId },
    update: {
      provider: "stripe",
      tier,
      status: params.status,
      stripeCustomerId: params.stripeCustomerId ?? undefined,
      stripeSubscriptionId: params.stripeSubscriptionId ?? undefined,
      stripePriceId: params.stripePriceId ?? undefined,
      currentPeriodEndsAt: params.currentPeriodEndsAt ?? undefined,
      cancelAtPeriodEnd: Boolean(params.cancelAtPeriodEnd),
      entitlementsJson: entitlementsForTier(tier),
    },
    create: {
      organizationId: params.organizationId,
      provider: "stripe",
      tier,
      status: params.status,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      stripePriceId: params.stripePriceId ?? null,
      currentPeriodEndsAt: params.currentPeriodEndsAt ?? null,
      cancelAtPeriodEnd: Boolean(params.cancelAtPeriodEnd),
      entitlementsJson: entitlementsForTier(tier),
      limitsJson: {},
    },
  });
}

export async function createCheckoutSession(params: {
  organizationId: string;
  userEmail: string;
  priceLookup: "pro" | "enterprise";
  successUrl?: string;
  cancelUrl?: string;
}) {
  const stripe = getStripeClient();

  if (!stripe) {
    return { configured: false as const };
  }

  const priceId =
    params.priceLookup === "enterprise" ? env.STRIPE_ENTERPRISE_PRICE_ID : env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    return { configured: false as const };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: params.userEmail,
    success_url: params.successUrl ?? `${env.APP_BASE_URL}/billing?success=1`,
    cancel_url: params.cancelUrl ?? `${env.APP_BASE_URL}/billing?canceled=1`,
    metadata: {
      organizationId: params.organizationId,
    },
    customer: subscription?.stripeCustomerId ?? undefined,
  });

  return {
    configured: true as const,
    url: session.url,
  };
}

export async function createBillingPortalSession(params: {
  organizationId: string;
}) {
  const stripe = getStripeClient();

  if (!stripe) {
    return { configured: false as const };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: params.organizationId },
  });

  if (!subscription?.stripeCustomerId) {
    return { configured: false as const };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${env.APP_BASE_URL}/billing`,
  });

  return {
    configured: true as const,
    url: session.url,
  };
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
  const stripe = getStripeClient();

  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook is not configured");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;

      if (organizationId && session.customer) {
        const stripeCustomerId = String(session.customer);
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

        if (stripeSubscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const priceId = stripeSubscription.items.data[0]?.price?.id ?? null;

          await upsertSubscriptionForOrganization({
            organizationId,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: priceId,
            status: stripeSubscription.status,
            currentPeriodEndsAt: stripeSubscription.items.data[0]?.current_period_end
              ? new Date(stripeSubscription.items.data[0].current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          });
        } else {
          await upsertSubscriptionForOrganization({
            organizationId,
            stripeCustomerId,
            status: "trial",
          });
        }
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id ?? null;

      const synced = await upsertSubscriptionFromStripe({
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodEndsAt: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      if (synced) {
        await recordAuditEvent({
          organizationId: synced.organizationId,
          entityType: "subscription",
          entityId: synced.id,
          action: `stripe.${event.type}`,
          metadata: {
            tier: synced.tier,
            status: synced.status,
            stripeSubscriptionId: synced.stripeSubscriptionId,
          },
        });
      }
      break;
    }
  }

  return event;
}
