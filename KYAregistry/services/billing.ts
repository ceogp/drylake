import type { Prisma } from "@prisma/client";
import Stripe from "stripe";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const TRUST_ONBOARDING_SCAN_PRICE_CENTS = 1000;
export const TRUST_MONTHLY_REGISTRATION_PRICE_CENTS = 1000;
export const TRUST_INVOICE_DAYS_UNTIL_DUE = 14;

export type TrustInvoicePurpose = "onboarding_scan" | "rescan";

export type TrustInvoiceLineItem = {
  description: string;
  amountUsdCents: number;
  quantity?: number;
};

function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function trustInvoicePaidAt(invoice: Stripe.Invoice) {
  const paidAtUnix = invoice.status_transitions?.paid_at;

  if (typeof paidAtUnix === "number" && Number.isFinite(paidAtUnix)) {
    return new Date(paidAtUnix * 1000);
  }

  return invoice.status === "paid" ? new Date() : null;
}

export function isTrustInvoicePaid(input: {
  status?: string | null;
  paidAt?: Date | null;
}) {
  return input.status === "paid" || Boolean(input.paidAt);
}

function normalizeTrustInvoiceStatus(invoice: Stripe.Invoice) {
  if (isTrustInvoicePaid({ status: invoice.status, paidAt: trustInvoicePaidAt(invoice) })) {
    return "paid";
  }

  switch (invoice.status) {
    case "draft":
      return "draft";
    case "void":
      return "void";
    case "uncollectible":
      return "payment_failed";
    case "open":
      return "open";
    default:
      return invoice.status ?? "open";
  }
}

function aggregateRegistryCasePaymentStatus(
  invoices: Array<{
    status: string;
    paidAt: Date | null;
  }>,
) {
  if (invoices.some((invoice) => isTrustInvoicePaid(invoice))) {
    return "paid";
  }

  if (invoices.some((invoice) => invoice.status === "payment_failed")) {
    return "payment_failed";
  }

  if (invoices.some((invoice) => invoice.status === "void")) {
    return "void";
  }

  if (invoices.some((invoice) => ["draft", "open", "sent"].includes(invoice.status))) {
    return "invoiced";
  }

  return "not_invoiced";
}

function registryCaseStatusForPaymentState(currentStatus: string, paymentStatus: string) {
  if (paymentStatus === "paid") {
    if (["discovered", "contacted", "interested", "invoiced"].includes(currentStatus)) {
      return "paid";
    }

    return currentStatus;
  }

  if (["invoiced", "payment_failed", "void"].includes(paymentStatus)) {
    if (["discovered", "contacted", "interested", "paid"].includes(currentStatus)) {
      return "invoiced";
    }
  }

  return currentStatus;
}

function normalizeLineItems(lineItems: TrustInvoiceLineItem[]) {
  if (lineItems.length === 0) {
    throw new Error("At least one invoice line item is required.");
  }

  return lineItems.map((item) => {
    const quantity = item.quantity ?? 1;

    if (!Number.isInteger(item.amountUsdCents) || item.amountUsdCents < 1) {
      throw new Error("Invoice line item amount must be a positive integer in cents.");
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Invoice line item quantity must be a positive integer.");
    }

    return {
      ...item,
      quantity,
      totalUsdCents: item.amountUsdCents * quantity,
    };
  });
}

function invoiceTotal(lineItems: ReturnType<typeof normalizeLineItems>) {
  return lineItems.reduce((sum, item) => sum + item.totalUsdCents, 0);
}

async function createOrReuseStripeCustomer(input: {
  stripe: Stripe;
  organizationId?: string | null;
  customerEmail: string;
  customerName?: string | null;
  companyId?: string | null;
  registryCaseId?: string | null;
}) {
  const existingInvoice = await prisma.trustBillingInvoice.findFirst({
    where: {
      customerEmail: input.customerEmail,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.registryCaseId ? { registryCaseId: input.registryCaseId } : {}),
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { stripeCustomerId: true },
  });

  if (existingInvoice?.stripeCustomerId) {
    return existingInvoice.stripeCustomerId;
  }

  const existingSubscription = await prisma.trustBillingSubscription.findFirst({
    where: {
      customerEmail: input.customerEmail,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { stripeCustomerId: true },
  });

  if (existingSubscription?.stripeCustomerId) {
    return existingSubscription.stripeCustomerId;
  }

  const customer = await input.stripe.customers.create({
    email: input.customerEmail,
    name: input.customerName ?? undefined,
    metadata: {
      xupra_product: "trust_registry",
      organizationId: input.organizationId ?? "",
      companyId: input.companyId ?? "",
      registryCaseId: input.registryCaseId ?? "",
    },
  });

  return customer.id;
}

export function onboardingScanInvoiceLineItems(): TrustInvoiceLineItem[] {
  return [
    {
      description: "Xupra KYA hosted agent certificate review",
      amountUsdCents: TRUST_ONBOARDING_SCAN_PRICE_CENTS,
      quantity: 1,
    },
  ];
}

export function monthlyRegistrationLineItem(quantity = 1): TrustInvoiceLineItem {
  return {
    description: "Xupra KYA hosted certificate and registry maintenance",
    amountUsdCents: TRUST_MONTHLY_REGISTRATION_PRICE_CENTS,
    quantity,
  };
}

export async function createAndSendTrustInvoice(input: {
  organizationId?: string | null;
  companyId?: string | null;
  registryCaseId?: string | null;
  purpose: TrustInvoicePurpose;
  customerEmail: string;
  customerName?: string | null;
  lineItems: TrustInvoiceLineItem[];
  daysUntilDue?: number;
}) {
  const stripe = getStripeClient();

  if (!stripe) {
    return { configured: false as const };
  }

  const normalizedLineItems = normalizeLineItems(input.lineItems);
  const amountUsdCents = invoiceTotal(normalizedLineItems);
  const localInvoice = await prisma.trustBillingInvoice.create({
    data: {
      organizationId: input.organizationId ?? null,
      companyId: input.companyId ?? null,
      registryCaseId: input.registryCaseId ?? null,
      purpose: input.purpose,
      status: "draft",
      amountUsdCents,
      currency: "usd",
      lineItemsJson: toJson(normalizedLineItems),
      customerEmail: input.customerEmail,
    },
  });
  const stripeCustomerId = await createOrReuseStripeCustomer({
    stripe,
    organizationId: input.organizationId,
    companyId: input.companyId,
    registryCaseId: input.registryCaseId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
  });
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: input.daysUntilDue ?? TRUST_INVOICE_DAYS_UNTIL_DUE,
    auto_advance: false,
    metadata: {
      xupra_product: "trust_registry",
      trustBillingInvoiceId: localInvoice.id,
      organizationId: input.organizationId ?? "",
      companyId: input.companyId ?? "",
      registryCaseId: input.registryCaseId ?? "",
      purpose: input.purpose,
    },
  });

  for (const item of normalizedLineItems) {
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: invoice.id,
      amount: item.totalUsdCents,
      currency: "usd",
      description: item.quantity > 1 ? `${item.description} x ${item.quantity}` : item.description,
      metadata: {
        trustBillingInvoiceId: localInvoice.id,
        unitAmountUsdCents: String(item.amountUsdCents),
        quantity: String(item.quantity),
      },
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  const sent = await stripe.invoices.sendInvoice(finalized.id);

  const updatedInvoice = await prisma.trustBillingInvoice.update({
    where: { id: localInvoice.id },
    data: {
      status: sent.status ?? "sent",
      stripeCustomerId,
      stripeInvoiceId: sent.id,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      invoicePdfUrl: sent.invoice_pdf ?? finalized.invoice_pdf ?? null,
      dueAt: sent.due_date ? new Date(sent.due_date * 1000) : null,
      paidAt: sent.status === "paid" ? new Date() : null,
    },
  });

  return {
    configured: true as const,
    invoice: updatedInvoice,
    hostedInvoiceUrl: updatedInvoice.hostedInvoiceUrl,
  };
}

async function getMonthlyStripeProductId(stripe: Stripe) {
  if (env.XUPRA_TRUST_STRIPE_MONTHLY_PRODUCT_ID) {
    return env.XUPRA_TRUST_STRIPE_MONTHLY_PRODUCT_ID;
  }

  const product = await stripe.products.create({
    name: "Xupra KYA Registry Maintenance",
    description: "Monthly hosted certificate and registry maintenance for registered MCP servers and agents.",
    metadata: {
      xupra_product: "trust_registry",
    },
  });

  return product.id;
}

function stripeInvoiceIdFromLatestInvoice(value: string | Stripe.Invoice | null | undefined) {
  if (!value || typeof value === "string") {
    return typeof value === "string" ? value : null;
  }

  return value.id;
}

async function syncRegistryCasePaymentState(input: {
  tx: Prisma.TransactionClient;
  registryCaseId: string;
  sourceInvoiceId: string;
  sourceStripeInvoiceId: string | null;
  sourceInvoiceStatus: string;
}) {
  const registryCase = await input.tx.trustRegistryCase.findUnique({
    where: { id: input.registryCaseId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!registryCase) {
    return null;
  }

  const invoices = await input.tx.trustBillingInvoice.findMany({
    where: { registryCaseId: input.registryCaseId },
    select: {
      status: true,
      paidAt: true,
    },
  });
  const nextPaymentStatus = aggregateRegistryCasePaymentStatus(invoices);
  const nextStatus = registryCaseStatusForPaymentState(registryCase.status, nextPaymentStatus);

  if (nextPaymentStatus !== registryCase.paymentStatus || nextStatus !== registryCase.status) {
    await input.tx.trustRegistryCase.update({
      where: { id: input.registryCaseId },
      data: {
        paymentStatus: nextPaymentStatus,
        ...(nextStatus !== registryCase.status ? { status: nextStatus } : {}),
      },
    });
  }

  if (nextPaymentStatus !== registryCase.paymentStatus) {
    const isPaid = nextPaymentStatus === "paid";
    await input.tx.trustRegistryEvent.create({
      data: {
        registryCaseId: input.registryCaseId,
        eventType: isPaid ? "payment_received" : "payment_status_updated",
        title: isPaid ? "KYA invoice paid" : `Payment status ${nextPaymentStatus}`,
        detail: input.sourceStripeInvoiceId ?? input.sourceInvoiceId,
        metadataJson: toJson({
          invoiceId: input.sourceInvoiceId,
          stripeInvoiceId: input.sourceStripeInvoiceId,
          previousPaymentStatus: registryCase.paymentStatus,
          nextPaymentStatus,
          sourceInvoiceStatus: input.sourceInvoiceStatus,
        }),
      },
    });
  }

  return {
    registryCaseId: input.registryCaseId,
    previousPaymentStatus: registryCase.paymentStatus,
    paymentStatus: nextPaymentStatus,
    status: nextStatus,
  };
}

export async function syncTrustInvoiceFromStripeInvoice(input: {
  stripeInvoice: Stripe.Invoice;
  sourceEventType?: string;
}) {
  const trustBillingInvoiceId = input.stripeInvoice.metadata?.trustBillingInvoiceId?.trim() || null;
  const localInvoice = trustBillingInvoiceId
    ? await prisma.trustBillingInvoice.findUnique({
      where: { id: trustBillingInvoiceId },
      select: {
        id: true,
        status: true,
        paidAt: true,
        registryCaseId: true,
      },
    })
    : await prisma.trustBillingInvoice.findUnique({
      where: { stripeInvoiceId: input.stripeInvoice.id },
      select: {
        id: true,
        status: true,
        paidAt: true,
        registryCaseId: true,
      },
    });

  if (!localInvoice) {
    return null;
  }

  const incomingStatus = normalizeTrustInvoiceStatus(input.stripeInvoice);
  const incomingPaidAt = trustInvoicePaidAt(input.stripeInvoice);
  const preservePaidState =
    isTrustInvoicePaid(localInvoice) &&
    !isTrustInvoicePaid({ status: incomingStatus, paidAt: incomingPaidAt });
  const nextStatus = preservePaidState ? localInvoice.status : incomingStatus;
  const nextPaidAt = preservePaidState ? localInvoice.paidAt : incomingPaidAt;
  const stripeCustomerId =
    typeof input.stripeInvoice.customer === "string" ? input.stripeInvoice.customer : input.stripeInvoice.customer?.id ?? null;

  return prisma.$transaction(async (tx) => {
    const updatedInvoice = await tx.trustBillingInvoice.update({
      where: { id: localInvoice.id },
      data: {
        status: nextStatus,
        stripeCustomerId,
        stripeInvoiceId: input.stripeInvoice.id,
        hostedInvoiceUrl: input.stripeInvoice.hosted_invoice_url ?? null,
        invoicePdfUrl: input.stripeInvoice.invoice_pdf ?? null,
        dueAt: input.stripeInvoice.due_date ? new Date(input.stripeInvoice.due_date * 1000) : null,
        paidAt: nextPaidAt,
      },
    });

    const registryCase =
      updatedInvoice.registryCaseId
        ? await syncRegistryCasePaymentState({
          tx,
          registryCaseId: updatedInvoice.registryCaseId,
          sourceInvoiceId: updatedInvoice.id,
          sourceStripeInvoiceId: updatedInvoice.stripeInvoiceId,
          sourceInvoiceStatus: updatedInvoice.status,
        })
        : null;

    return {
      invoice: updatedInvoice,
      registryCase,
      sourceEventType: input.sourceEventType ?? null,
    };
  });
}

export async function createTrustMonthlyInvoiceSubscription(input: {
  organizationId?: string | null;
  companyId?: string | null;
  productId?: string | null;
  customerEmail: string;
  customerName?: string | null;
  quantity?: number;
  daysUntilDue?: number;
}) {
  const stripe = getStripeClient();

  if (!stripe) {
    return { configured: false as const };
  }

  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Monthly registry subscription quantity must be a positive integer.");
  }

  const localSubscription = await prisma.trustBillingSubscription.create({
    data: {
      organizationId: input.organizationId ?? null,
      companyId: input.companyId ?? null,
      productId: input.productId ?? null,
      status: "pending",
      quantity,
      amountUsdCents: TRUST_MONTHLY_REGISTRATION_PRICE_CENTS,
      currency: "usd",
      customerEmail: input.customerEmail,
    },
  });
  const stripeCustomerId = await createOrReuseStripeCustomer({
    stripe,
    organizationId: input.organizationId,
    companyId: input.companyId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
  });
  const stripeProductId = await getMonthlyStripeProductId(stripe);
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: input.daysUntilDue ?? TRUST_INVOICE_DAYS_UNTIL_DUE,
    description: "Xupra KYA hosted certificate and registry maintenance",
    items: [
      {
        price_data: {
          currency: "usd",
          product: stripeProductId,
          recurring: { interval: "month" },
          unit_amount: TRUST_MONTHLY_REGISTRATION_PRICE_CENTS,
        },
        quantity,
      },
    ],
    metadata: {
      xupra_product: "trust_registry",
      trustBillingSubscriptionId: localSubscription.id,
      organizationId: input.organizationId ?? "",
      companyId: input.companyId ?? "",
      productId: input.productId ?? "",
    },
    expand: ["latest_invoice"],
  });
  const firstInvoiceId = stripeInvoiceIdFromLatestInvoice(stripeSubscription.latest_invoice);
  const currentPeriodEndsAt = stripeSubscription.items.data[0]?.current_period_end
    ? new Date(stripeSubscription.items.data[0].current_period_end * 1000)
    : null;
  const updatedSubscription = await prisma.trustBillingSubscription.update({
    where: { id: localSubscription.id },
    data: {
      status: stripeSubscription.status,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      currentPeriodEndsAt,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  return {
    configured: true as const,
    subscription: updatedSubscription,
    firstInvoiceId,
  };
}
