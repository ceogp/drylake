"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { requireAdminActionAccess } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/services/audit";
import { entitlementsForTier } from "@/lib/services/billing";

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required form value: ${key}`);
  }

  return value;
}

export async function suspendUserAction(formData: FormData) {
  const userId = getRequiredString(formData, "userId");
  const operatorUsername = await requireAdminActionAccess();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { take: 1 } },
  });
  const previousStatus = user.status;
  const organizationId = user.memberships[0]?.organizationId;

  if (!organizationId) {
    throw new Error("User does not belong to an organization.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "suspended" },
  });

  await recordAuditEvent({
    organizationId,
    actorUserId: null,
    entityType: "user",
    entityId: userId,
    action: "admin.user.suspend",
    metadata: { operatorUsername, previousStatus, userId, userEmail: user.email },
  });

  revalidatePath(`/admin/users/${userId}`, "page");
  revalidatePath(`/portal/users/${userId}`, "page");
}

export async function reactivateUserAction(formData: FormData) {
  const userId = getRequiredString(formData, "userId");
  const operatorUsername = await requireAdminActionAccess();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { take: 1 } },
  });
  const previousStatus = user.status;
  const organizationId = user.memberships[0]?.organizationId;

  if (!organizationId) {
    throw new Error("User does not belong to an organization.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "active" },
  });

  await recordAuditEvent({
    organizationId,
    actorUserId: null,
    entityType: "user",
    entityId: userId,
    action: "admin.user.reactivate",
    metadata: { operatorUsername, previousStatus, userId, userEmail: user.email },
  });

  revalidatePath(`/admin/users/${userId}`, "page");
  revalidatePath(`/portal/users/${userId}`, "page");
}

export async function overrideTierAction(formData: FormData): Promise<{ error: string } | undefined> {
  const userId = getRequiredString(formData, "userId");
  const newTier = getRequiredString(formData, "newTier");
  const orgId = getRequiredString(formData, "orgId");
  const operatorUsername = await requireAdminActionAccess();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { subscriptions: true },
  });
  const previousTier = organization.tier;
  const subscription = organization.subscriptions[0];
  let stripeAction = "none";

  if (!["free", "pro", "enterprise"].includes(newTier)) {
    throw new Error("Invalid tier.");
  }

  if (subscription?.stripeSubscriptionId && !env.STRIPE_SECRET_KEY) {
    return { error: "Tier update failed — Stripe is not configured. No changes were made." };
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { tier: newTier },
    }),
    ...(subscription
      ? [
          prisma.subscription.update({
            where: { organizationId: orgId },
            data: {
              tier: newTier,
              entitlementsJson: entitlementsForTier(newTier),
              cancelAtPeriodEnd: true,
            },
          }),
        ]
      : []),
  ]);

  if (subscription?.stripeSubscriptionId && env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      stripeAction = "cancel_at_period_end";
    } catch {
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: orgId },
          data: { tier: previousTier },
        }),
        prisma.subscription.update({
          where: { organizationId: orgId },
          data: {
            tier: previousTier,
            entitlementsJson: entitlementsForTier(previousTier),
            cancelAtPeriodEnd: false,
          },
        }),
      ]);

      return { error: "Tier update failed — Stripe could not be reached. No changes were made." };
    }
  }

  await recordAuditEvent({
    organizationId: orgId,
    actorUserId: null,
    entityType: "organization",
    entityId: orgId,
    action: "admin.org.tier_override",
    metadata: { operatorUsername, previousTier, newTier, orgId, stripeAction },
  });

  revalidatePath(`/admin/users/${userId}`, "page");
  revalidatePath(`/portal/users/${userId}`, "page");
}

export async function refundAction(formData: FormData): Promise<{ error: string } | undefined> {
  const stripeCustomerId = getRequiredString(formData, "stripeCustomerId");
  const stripeChargeId = getRequiredString(formData, "stripeChargeId");
  const amountCents = getRequiredString(formData, "amountCents");
  const currency = getRequiredString(formData, "currency");
  const orgId = getRequiredString(formData, "orgId");
  const operatorUsername = await requireAdminActionAccess();

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured.");
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  try {
    await stripe.refunds.create({ charge: stripeChargeId });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Refund failed. Stripe could not be reached.",
    };
  }

  await recordAuditEvent({
    organizationId: orgId,
    actorUserId: null,
    entityType: "subscription",
    entityId: orgId,
    action: "admin.billing.refund",
    metadata: {
      operatorUsername,
      stripeChargeId,
      amountCents: Number(amountCents),
      currency,
      stripeCustomerId,
    },
  });

  revalidatePath("/admin/billing", "page");
  revalidatePath("/portal/billing", "page");

  return undefined;
}
