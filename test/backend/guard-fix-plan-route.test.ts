import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateGuardFixPlan: vi.fn(),
  getRequestOrganizationContext: vi.fn(),
  recordExtensionUsageEventBestEffort: vi.fn(),
  resolveGuardFixAccess: vi.fn(),
  safeParse: vi.fn(),
}));

vi.mock("@/lib/services/request-organization", () => ({
  INVALID_EXTENSION_TOKEN_ERROR: "Invalid extension token",
  REQUEST_AUTHENTICATION_REQUIRED_ERROR: "Authentication required",
  getRequestOrganizationContext: mocks.getRequestOrganizationContext,
}));

vi.mock("@/lib/services/extension-usage-events", () => ({
  recordExtensionUsageEventBestEffort: mocks.recordExtensionUsageEventBestEffort,
}));

vi.mock("@/lib/services/guard-fix-access", () => ({
  resolveGuardFixAccess: mocks.resolveGuardFixAccess,
}));

vi.mock("@/lib/services/guard-remediation", () => ({
  generateGuardFixPlan: mocks.generateGuardFixPlan,
  guardFixPlanInputSchema: { safeParse: mocks.safeParse },
}));

import { POST } from "@/app/api/v1/guard/fix-plan/route";

const payload = {
  workspaceHash: "workspace-123456",
  sourceClient: "vscode",
  scan: {
    scannedAt: "2026-06-12T01:19:32.000Z",
    score: 41,
    rank: "Scout",
    summary: { findings: 110 },
    categoryScores: { mcpRisk: 5, secretHygiene: 0 },
    findings: [
      {
        id: "blast-radius",
        category: "blast-radius",
        severity: "critical",
        title: "Agent blast radius",
        evidence: "Secrets and deploy surfaces detected together.",
        recommendation: "Require approval.",
      },
    ],
    extensions: [],
    secrets: [{ path: ".env", line: 31, type: "AWS credential variable", variableName: "AWS_ACCESS_KEY_ID", severity: "high" }],
    mcpServers: [],
    workspaceSurface: {
      deploymentFiles: [],
      iacFiles: [],
      ciWorkflowFiles: [],
      credentialLikeFiles: [],
      riskyPackageScripts: [],
      generatedFolders: [],
    },
    connectionMap: { highRiskPaths: [], edges: [] },
  },
};

const plan = {
  summary: "Fix the highest-risk Guard findings first.",
  actions: [
    {
      title: "Require agent approval",
      priority: "critical",
      category: "blast-radius",
      why: "Agents can reach secrets and deploy paths.",
      recommendation: "Add approval gates before command execution.",
      files: ["package.json"],
      approvalRequired: true,
    },
  ],
  cautions: ["Do not expose secret values."],
  nextSteps: ["Re-run the Guard scan."],
};

function request(body = payload) {
  return new Request("http://localhost/api/v1/guard/fix-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.generateGuardFixPlan.mockReset();
  mocks.getRequestOrganizationContext.mockReset();
  mocks.recordExtensionUsageEventBestEffort.mockReset();
  mocks.resolveGuardFixAccess.mockReset();
  mocks.safeParse.mockReset();

  mocks.safeParse.mockImplementation((body: unknown) => ({ success: true, data: body }));
  mocks.getRequestOrganizationContext.mockResolvedValue({ organizationId: "org-pro", userId: "user-123" });
  mocks.resolveGuardFixAccess.mockResolvedValue({
    paid: true,
    modelTier: "nano",
    model: "claude-haiku-4-5-20251001",
  });
  mocks.recordExtensionUsageEventBestEffort.mockResolvedValue(undefined);
  mocks.generateGuardFixPlan.mockResolvedValue(plan);
});

describe("Guard Fix with AI route", () => {
  it("generates a Haiku Guard fix plan for paid organizations", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      plan,
      modelTier: "nano",
      model: "claude-haiku-4-5-20251001",
    });
    expect(mocks.generateGuardFixPlan).toHaveBeenCalledWith(payload, {
      model: "claude-haiku-4-5-20251001",
    });
    expect(mocks.recordExtensionUsageEventBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-pro",
      actorUserId: "user-123",
      event: expect.objectContaining({
        eventName: "guard_fix_ai_requested",
        actionType: "guard_fix_ai",
        promptKind: "guard_fix_ai",
      }),
    }));
  });

  it("rejects free organizations before calling Haiku", async () => {
    mocks.resolveGuardFixAccess.mockResolvedValueOnce({
      paid: false,
      modelTier: "nano",
      model: "claude-haiku-4-5-20251001",
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toContain("paid Guard plan");
    expect(mocks.generateGuardFixPlan).not.toHaveBeenCalled();
    expect(mocks.recordExtensionUsageEventBestEffort).not.toHaveBeenCalled();
  });

  it("returns 401 when the extension is not registered", async () => {
    mocks.getRequestOrganizationContext.mockRejectedValueOnce(new Error("Authentication required"));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toContain("Register free");
    expect(mocks.generateGuardFixPlan).not.toHaveBeenCalled();
  });
});
