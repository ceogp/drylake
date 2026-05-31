import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    OPENAI_MODEL: "gpt-5.5",
    OPENAI_FREE_MODEL: "gpt-5.4-nano",
  },
  getEntitlementsForOrganization: vi.fn(),
  findOrganization: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/services/entitlements", () => ({
  getEntitlementsForOrganization: mocks.getEntitlementsForOrganization,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: mocks.findOrganization,
    },
  },
}));

import { resolveRunbookPlanningAccess } from "@/lib/services/runbook-planning-access";

beforeEach(() => {
  mocks.getEntitlementsForOrganization.mockReset();
  mocks.findOrganization.mockReset();

  mocks.getEntitlementsForOrganization.mockResolvedValue({
    subscription: { tier: "free" },
    entitlements: { xupra_pro_ai: false },
  });
  mocks.findOrganization.mockResolvedValue({ tier: "free" });
});

describe("resolveRunbookPlanningAccess", () => {
  it("returns foundation when entitlement allows Xupra AI", async () => {
    mocks.getEntitlementsForOrganization.mockResolvedValueOnce({
      subscription: { tier: "free" },
      entitlements: { xupra_pro_ai: true },
    });

    await expect(resolveRunbookPlanningAccess("org-pro")).resolves.toEqual({
      tier: "foundation",
      model: "gpt-5.5",
    });
  });

  it("returns foundation for paid subscription tiers even when entitlement is stale", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.getEntitlementsForOrganization.mockResolvedValueOnce({
      subscription: { tier: "pro" },
      entitlements: { xupra_pro_ai: false },
    });

    try {
      await expect(resolveRunbookPlanningAccess("org-pro")).resolves.toEqual({
        tier: "foundation",
        model: "gpt-5.5",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[runbook-planning-access] enabling foundation model via paid-tier fallback",
        expect.objectContaining({ organizationId: "org-pro", subscriptionTier: "pro" }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns foundation for paid organization tiers even when subscription is free", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.findOrganization.mockResolvedValueOnce({ tier: "enterprise" });

    try {
      await expect(resolveRunbookPlanningAccess("org-enterprise")).resolves.toEqual({
        tier: "foundation",
        model: "gpt-5.5",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[runbook-planning-access] enabling foundation model via paid-tier fallback",
        expect.objectContaining({ organizationId: "org-enterprise", organizationTier: "enterprise" }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns nano for free organizations without entitlement", async () => {
    await expect(resolveRunbookPlanningAccess("org-free")).resolves.toEqual({
      tier: "nano",
      model: "gpt-5.4-nano",
    });
  });
});
