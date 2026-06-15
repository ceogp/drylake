import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  createStatusEvent: vi.fn(),
  createRegistryEvent: vi.fn(),
  updateRegistryCase: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trustCertificate: {
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/KYAregistry/services/billing", () => ({
  createAndSendTrustInvoice: vi.fn(),
  onboardingScanInvoiceLineItems: vi.fn(),
}));

vi.mock("@/KYAregistry/services/certificates", () => ({
  createSignedTrustCertificate: vi.fn(),
}));

vi.mock("@/KYAregistry/services/publication", () => ({
  publishTrustCertificateArtifacts: vi.fn(),
}));

import { updateRegistryCertificateStatus } from "@/KYAregistry/services/operator";

describe("updateRegistryCertificateStatus", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.transaction.mockReset();
    mocks.update.mockReset();
    mocks.count.mockReset();
    mocks.createStatusEvent.mockReset();
    mocks.createRegistryEvent.mockReset();
    mocks.updateRegistryCase.mockReset();

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        trustCertificate: {
          update: mocks.update,
          count: mocks.count,
        },
        trustCertificateStatusEvent: {
          create: mocks.createStatusEvent,
        },
        trustRegistryEvent: {
          create: mocks.createRegistryEvent,
        },
        trustRegistryCase: {
          update: mocks.updateRegistryCase,
        },
      }),
    );
  });

  it("records a status event and unpublishes the case when the last active certificate is suspended", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "cert-db-1",
      certificateId: "XMKS-KYA-2026-000201",
      status: "active",
      expiresAt: new Date("2027-06-14T00:00:00.000Z"),
      registryCaseId: "case-1",
      registryCase: {
        id: "case-1",
        status: "listed",
        publicListingEnabled: true,
      },
    });
    mocks.update.mockResolvedValue({
      id: "cert-db-1",
      status: "suspended",
    });
    mocks.count.mockResolvedValue(0);
    mocks.createStatusEvent.mockResolvedValue({ id: "status-event-1" });
    mocks.createRegistryEvent.mockResolvedValue({ id: "registry-event-1" });
    mocks.updateRegistryCase.mockResolvedValue({ id: "case-1" });

    const result = await updateRegistryCertificateStatus({
      certificateId: "XMKS-KYA-2026-000201",
      status: "suspended",
      reason: "Manual hold during remediation review.",
      actor: "operator",
    });

    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "cert-db-1" },
      data: {
        status: "suspended",
        lastCheckedAt: expect.any(Date),
      },
    });
    expect(mocks.createStatusEvent).toHaveBeenCalledWith({
      data: {
        certificateDbId: "cert-db-1",
        status: "suspended",
        reason: "Manual hold during remediation review.",
      },
    });
    expect(mocks.createRegistryEvent).toHaveBeenCalledWith({
      data: {
        registryCaseId: "case-1",
        eventType: "certificate_status_updated",
        title: "Certificate suspended",
        detail: "Manual hold during remediation review.",
        actor: "operator",
        metadataJson: {
          certificateId: "XMKS-KYA-2026-000201",
          previousStatus: "active",
          nextStatus: "suspended",
        },
      },
    });
    expect(mocks.updateRegistryCase).toHaveBeenCalledWith({
      where: { id: "case-1" },
      data: {
        publicListingEnabled: false,
        status: "certified",
      },
    });
    expect(result).toEqual({
      id: "cert-db-1",
      status: "suspended",
    });
  });

  it("blocks reactivation of an expired certificate", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "cert-db-2",
      certificateId: "XMKS-KYA-2026-000202",
      status: "revoked",
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      registryCaseId: "case-2",
      registryCase: {
        id: "case-2",
        status: "certified",
        publicListingEnabled: false,
      },
    });

    await expect(
      updateRegistryCertificateStatus({
        certificateId: "XMKS-KYA-2026-000202",
        status: "active",
      }),
    ).rejects.toThrow("Expired certificates cannot be reactivated. Issue a new certificate instead.");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
