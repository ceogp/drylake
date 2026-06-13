import { describe, expect, it } from "vitest";

import { connectionStateFromExtensionConnection, normalizeEntitlements } from "../services/connectionState";

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
      canUseHostedPlanning: false,
      canUseFixWithAI: false,
      canUseApprovedUpload: false,
      canUseDeepCloudAnalysis: false,
      canUseSuspiciousArtifactScan: true,
      canUseLocalWatchdog: false,
      canCreateTeam: false,
      canUseTeamBaseline: false,
      canUseContinuousWatch: false,
      canManageTeamPolicy: false,
    });
  });

  it("preserves the organization role from the extension connection payload", () => {
    expect(connectionStateFromExtensionConnection({
      editor: "vscode",
      auth: {
        mode: "cognito",
        provider: "aws-cognito",
        configured: true,
        pendingKeys: [],
        session: {
          status: "active",
          organizationId: "org-123",
          user: {
            id: "user-123",
            email: "user@example.com",
          },
        },
      },
      user: {
        id: "user-123",
        email: "user@example.com",
      },
      organization: {
        id: "org-123",
        name: "DryLake",
        slug: "drylake",
        tier: "team_security",
      },
      organizationRole: "admin",
      entitlements: {
        canUseTeamBaseline: true,
      },
      entitlementVersion: 3,
      plan: "team_security",
      subscription: {
        status: "active",
      },
    })).toMatchObject({
      organizationId: "org-123",
      organizationRole: "admin",
      plan: "team_security",
    });
  });
});
