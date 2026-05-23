import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    BILLING_ENFORCEMENT_MODE: "strict",
  },
  findUnique: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  assertEntitlement,
  getEntitlementsForOrganization,
  hasEntitlement,
} from "@/lib/services/entitlements";

beforeEach(() => {
  mocks.env.BILLING_ENFORCEMENT_MODE = "strict";
  mocks.findUnique.mockReset();
});

describe("entitlements", () => {
  it("denies Xupra AI for free organizations in strict billing mode", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(hasEntitlement("org-free", "xupra_pro_ai")).resolves.toBe(false);
    await expect(assertEntitlement("org-free", "xupra_pro_ai")).rejects.toThrow(
      "Organization is not entitled to use xupra_pro_ai",
    );
  });

  it("allows Xupra AI for pro organizations in strict billing mode", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      organizationId: "org-pro",
      tier: "pro",
      entitlementsJson: null,
    });

    await expect(hasEntitlement("org-pro", "xupra_pro_ai")).resolves.toBe(true);
  });

  it("honors entitlement overrides in strict billing mode", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      organizationId: "org-pro",
      tier: "pro",
      entitlementsJson: {
        xupra_pro_ai: false,
      },
    });

    const result = await getEntitlementsForOrganization("org-pro");

    expect(result.entitlements.xupra_pro_ai).toBe(false);
  });

  it("keeps development mode permissive without reading billing state", async () => {
    mocks.env.BILLING_ENFORCEMENT_MODE = "development";

    await expect(hasEntitlement("org-free", "xupra_pro_ai")).resolves.toBe(true);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
