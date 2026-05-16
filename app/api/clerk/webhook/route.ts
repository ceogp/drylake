import { NextResponse } from "next/server";
import { verifyWebhook, type WebhookEvent } from "@clerk/backend/webhooks";

import { prisma } from "@/lib/prisma";
import { entitlementsForTier } from "@/lib/services/billing";

const activePaidStatuses = new Set([
  "active",
  "past_due",
  "pastDue",
  "upcoming",
]);

type BillingSnapshot = {
  status: string;
  tier: "free" | "pro" | "enterprise";
  payerUserId: string | null;
  payerEmail: string | null;
  payerOrganizationId: string | null;
};

function isPaidItem(input: {
  status: string;
  amount?: number | null;
}) {
  return activePaidStatuses.has(input.status) && (input.amount ?? 0) > 0;
}

function inferTierFromItems(items: Array<{
  status: string;
  amount?: number | null;
  planSlug?: string | null;
}>) {
  const paidItems = items.filter((item) => isPaidItem({ status: item.status, amount: item.amount }));

  if (paidItems.length === 0) {
    return "free" as const;
  }

  const hasEnterprise = paidItems.some((item) => (item.planSlug ?? "").toLowerCase().includes("enterprise"));
  return hasEnterprise ? ("enterprise" as const) : ("pro" as const);
}

function extractSnapshot(event: WebhookEvent): BillingSnapshot | null {
  if (
    event.type === "subscription.created" ||
    event.type === "subscription.updated" ||
    event.type === "subscription.active" ||
    event.type === "subscription.pastDue"
  ) {
    const items = event.data.items.map((item) => ({
      status: item.status,
      amount: item.amount?.amount ?? null,
      planSlug: item.plan?.slug ?? null,
    }));

    return {
      status: event.data.status,
      tier: inferTierFromItems(items),
      payerUserId: event.data.payer?.user_id ?? null,
      payerEmail: event.data.payer?.email ?? null,
      payerOrganizationId: event.data.payer?.organization_id ?? null,
    };
  }

  if (
    event.type === "subscriptionItem.created" ||
    event.type === "subscriptionItem.updated" ||
    event.type === "subscriptionItem.active" ||
    event.type === "subscriptionItem.canceled" ||
    event.type === "subscriptionItem.upcoming" ||
    event.type === "subscriptionItem.ended" ||
    event.type === "subscriptionItem.abandoned" ||
    event.type === "subscriptionItem.incomplete" ||
    event.type === "subscriptionItem.pastDue" ||
    event.type === "subscriptionItem.freeTrialEnding"
  ) {
    return {
      status: event.data.status,
      tier: inferTierFromItems([
        {
          status: event.data.status,
          amount: event.data.amount?.amount ?? null,
          planSlug: event.data.plan?.slug ?? null,
        },
      ]),
      payerUserId: event.data.payer?.user_id ?? null,
      payerEmail: event.data.payer?.email ?? null,
      payerOrganizationId: event.data.payer?.organization_id ?? null,
    };
  }

  if (event.type === "paymentAttempt.created" || event.type === "paymentAttempt.updated") {
    const items = event.data.subscription_items.map((item) => ({
      status: item.status,
      amount: item.amount?.amount ?? null,
      planSlug: item.plan?.slug ?? null,
    }));

    return {
      status: event.data.status,
      tier: inferTierFromItems(items),
      payerUserId: event.data.payer.user_id ?? null,
      payerEmail: event.data.payer.email ?? null,
      payerOrganizationId: event.data.payer.organization_id ?? null,
    };
  }

  return null;
}

async function resolveOrganizationId(input: {
  payerOrganizationId: string | null;
  payerUserId: string | null;
  payerEmail: string | null;
}) {
  if (input.payerOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: input.payerOrganizationId },
      select: { id: true },
    });

    if (organization) {
      return organization.id;
    }
  }

  if (input.payerUserId) {
    const user = await prisma.user.findFirst({
      where: {
        authProvider: "clerk",
        authSubject: input.payerUserId,
      },
      select: { id: true },
    });

    if (user) {
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });

      if (membership) {
        return membership.organizationId;
      }
    }
  }

  if (input.payerEmail) {
    const user = await prisma.user.findUnique({
      where: { email: input.payerEmail },
      select: { id: true },
    });

    if (user) {
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });

      if (membership) {
        return membership.organizationId;
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const event = await verifyWebhook(request);
    const snapshot = extractSnapshot(event);

    if (!snapshot) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const organizationId = await resolveOrganizationId({
      payerOrganizationId: snapshot.payerOrganizationId,
      payerUserId: snapshot.payerUserId,
      payerEmail: snapshot.payerEmail,
    });

    if (!organizationId) {
      return NextResponse.json({ ok: true, skipped: "no_organization_match" });
    }

    const entitlements = entitlementsForTier(snapshot.tier);

    await prisma.subscription.upsert({
      where: { organizationId },
      update: {
        provider: "clerk",
        tier: snapshot.tier,
        status: snapshot.status,
        entitlementsJson: entitlements,
      },
      create: {
        organizationId,
        provider: "clerk",
        tier: snapshot.tier,
        status: snapshot.status,
        entitlementsJson: entitlements,
        limitsJson: {},
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { tier: snapshot.tier },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
