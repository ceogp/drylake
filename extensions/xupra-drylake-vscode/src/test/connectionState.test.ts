import { describe, expect, it } from "vitest";

import { normalizeEntitlements } from "../services/connectionState";

describe("connection entitlements", () => {
  it("keeps only the new entitlement keys", () => {
    expect(
      normalizeEntitlements({
        xupra_pro_ai: true,
        session_cloud_sync: true,
        pr_summary_generation: false,
        deprecated_entitlement: true,
      }),
    ).toEqual({
      xupra_pro_ai: true,
      session_cloud_sync: true,
      pr_summary_generation: false,
    });
  });
});