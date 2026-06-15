import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  updateInvoice: vi.fn(),
  findRegistryCase: vi.fn(),
  findCaseInvoices: vi.fn(),
  updateRegistryCase: vi.fn(),
  createRegistryEvent: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
    XUPRA_TRUST_STRIPE_MONTHLY_PRODUCT_ID: undefined,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trustBillingInvoice: {
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import { syncTrustInvoiceFromStripeInvoice } from "@/KYAregistry/services/billing";

describe("syncTrustInvoiceFromStripeInvoice", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.transaction.mockReset();
    mocks.updateInvoice.mockReset();
    mocks.findRegistryCase.mockReset();
    mocks.findCaseInvoices.mockReset();
    mocks.updateRegistryCase.mockReset();
    mocks.createRegistryEvent.mockReset();

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        trustBillingInvoice: {
          update: mocks.updateInvoice,
          findMany: mocks.findCaseInvoices,
        },
        trustRegistryCase: {
          findUnique: mocks.findRegistryCase,
          update: mocks.updateRegistryCase,
        },
        trustRegistryEvent: {
          create: mocks.createRegistryEvent,
        },
      }),
    );
  });

  it("marks the registry case paid when Stripe confirms invoice payment", async () => {
    const paidAt = new Date("2026-06-15T03:00:00.000Z");

    mocks.findUnique.mockResolvedValue({
      id: "local-invoice-1",
      status: "open",
      paidAt: null,
      registryCaseId: "case-1",
    });
    mocks.updateInvoice.mockResolvedValue({
      id: "local-invoice-1",
      registryCaseId: "case-1",
      status: "paid",
      stripeInvoiceId: "in_123",
      paidAt,
    });
    mocks.findRegistryCase.mockResolvedValue({
      id: "case-1",
      status: "invoiced",
      paymentStatus: "invoiced",
    });
    mocks.findCaseInvoices.mockResolvedValue([
      {
        status: "paid",
        paidAt,
      },
    ]);

    const result = await syncTrustInvoiceFromStripeInvoice({
      stripeInvoice: {
        id: "in_123",
        status: "paid",
        paid: true,
        due_date: null,
        customer: "cus_123",
        metadata: {
          trustBillingInvoiceId: "local-invoice-1",
        },
        status_transitions: {
          paid_at: Math.floor(paidAt.getTime() / 1000),
        },
        hosted_invoice_url: "https://pay.stripe.com/invoice/in_123",
        invoice_pdf: "https://files.stripe.com/invoice/in_123.pdf",
      } as never,
      sourceEventType: "invoice.payment_succeeded",
    });

    expect(mocks.updateInvoice).toHaveBeenCalledWith({
      where: { id: "local-invoice-1" },
      data: {
        status: "paid",
        stripeCustomerId: "cus_123",
        stripeInvoiceId: "in_123",
        hostedInvoiceUrl: "https://pay.stripe.com/invoice/in_123",
        invoicePdfUrl: "https://files.stripe.com/invoice/in_123.pdf",
        dueAt: null,
        paidAt,
      },
    });
    expect(mocks.updateRegistryCase).toHaveBeenCalledWith({
      where: { id: "case-1" },
      data: {
        paymentStatus: "paid",
        status: "paid",
      },
    });
    expect(mocks.createRegistryEvent).toHaveBeenCalledWith({
      data: {
        registryCaseId: "case-1",
        eventType: "payment_received",
        title: "KYA invoice paid",
        detail: "in_123",
        metadataJson: {
          invoiceId: "local-invoice-1",
          stripeInvoiceId: "in_123",
          previousPaymentStatus: "invoiced",
          nextPaymentStatus: "paid",
          sourceInvoiceStatus: "paid",
        },
      },
    });
    expect(result?.registryCase).toEqual({
      registryCaseId: "case-1",
      previousPaymentStatus: "invoiced",
      paymentStatus: "paid",
      status: "paid",
    });
  });

  it("does not regress a locally paid invoice when an older open event arrives later", async () => {
    const paidAt = new Date("2026-06-15T03:00:00.000Z");

    mocks.findUnique.mockResolvedValue({
      id: "local-invoice-2",
      status: "paid",
      paidAt,
      registryCaseId: "case-2",
    });
    mocks.updateInvoice.mockResolvedValue({
      id: "local-invoice-2",
      registryCaseId: "case-2",
      status: "paid",
      stripeInvoiceId: "in_456",
      paidAt,
    });
    mocks.findRegistryCase.mockResolvedValue({
      id: "case-2",
      status: "paid",
      paymentStatus: "paid",
    });
    mocks.findCaseInvoices.mockResolvedValue([
      {
        status: "paid",
        paidAt,
      },
    ]);

    await syncTrustInvoiceFromStripeInvoice({
      stripeInvoice: {
        id: "in_456",
        status: "open",
        paid: false,
        due_date: null,
        customer: "cus_456",
        metadata: {
          trustBillingInvoiceId: "local-invoice-2",
        },
        status_transitions: {
          paid_at: null,
        },
        hosted_invoice_url: "https://pay.stripe.com/invoice/in_456",
        invoice_pdf: "https://files.stripe.com/invoice/in_456.pdf",
      } as never,
      sourceEventType: "invoice.updated",
    });

    expect(mocks.updateInvoice).toHaveBeenCalledWith({
      where: { id: "local-invoice-2" },
      data: {
        status: "paid",
        stripeCustomerId: "cus_456",
        stripeInvoiceId: "in_456",
        hostedInvoiceUrl: "https://pay.stripe.com/invoice/in_456",
        invoicePdfUrl: "https://files.stripe.com/invoice/in_456.pdf",
        dueAt: null,
        paidAt,
      },
    });
    expect(mocks.updateRegistryCase).not.toHaveBeenCalled();
    expect(mocks.createRegistryEvent).not.toHaveBeenCalled();
  });

  it("ignores non-registry invoices", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await syncTrustInvoiceFromStripeInvoice({
      stripeInvoice: {
        id: "in_789",
        status: "open",
        paid: false,
        due_date: null,
        customer: "cus_789",
        metadata: {},
        status_transitions: {
          paid_at: null,
        },
        hosted_invoice_url: null,
        invoice_pdf: null,
      } as never,
    });

    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
