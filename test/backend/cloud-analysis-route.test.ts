import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cloudAnalysisJob: {
    create: vi.fn(),
  },
  guardScan: {
    findFirst: vi.fn(),
  },
  getEntitlementsForOrganization: vi.fn(),
  getRequestOrganizationContext: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cloudAnalysisJob: mocks.cloudAnalysisJob,
    guardScan: mocks.guardScan,
  },
}));

vi.mock("@/lib/services/entitlements", () => ({
  getEntitlementsForOrganization: mocks.getEntitlementsForOrganization,
}));

vi.mock("@/lib/services/request-organization", () => ({
  INVALID_EXTENSION_TOKEN_ERROR: "Invalid extension token",
  REQUEST_AUTHENTICATION_REQUIRED_ERROR: "Authentication required",
  getRequestOrganizationContext: mocks.getRequestOrganizationContext,
}));

import { POST } from "@/app/api/v1/guard/cloud-analysis/route";

function request(body: unknown) {
  return new Request("http://localhost/api/v1/guard/cloud-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRequestOrganizationContext.mockResolvedValue({ organizationId: "org-123", userId: "user-123" });
  mocks.getEntitlementsForOrganization.mockResolvedValue({
    resolved: {
      canUseApprovedUpload: true,
      canUseDeepCloudAnalysis: true,
    },
  });
  mocks.guardScan.findFirst.mockResolvedValue({ id: "scan-123" });
  mocks.cloudAnalysisJob.create.mockImplementation(async ({ data }) => ({
    id: "job-123",
    guardScanId: data.guardScanId,
    status: data.status,
    resultJson: data.resultJson,
    createdAt: new Date("2026-06-13T00:00:00.000Z"),
  }));
});

describe("Deep Cloud Analysis route", () => {
  it("correlates the extension dependency metadata shape in supply-chain review", async () => {
    const response = await POST(request({
      guardScanId: "scan-123",
      approvedPayload: {
        redactedFindings: [],
        dependencyMetadata: {
          packageManagers: ["npm"],
          packageScripts: ["build", "deploy"],
          riskyPackageScripts: [{ path: "package.json", name: "deploy", risk: "deployment" }],
        },
        filePathInventory: [],
        selectedPromptFiles: [],
      },
    }));
    const body = await response.json();
    const result = body.job.resultJson;

    expect(response.status).toBe(200);
    expect(result.supplyChainReview.packageSignals).toEqual(expect.arrayContaining([
      "package-manager:npm",
      "script:deploy",
      "risky-script:deploy",
    ]));
    expect(result.supplyChainReview.recommendation).not.toContain("No dependency metadata");
  });
});
