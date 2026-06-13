import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardBaseline: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  guardScan: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  guardWatchEvent: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  teamPolicy: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guardBaseline: mocks.guardBaseline,
    guardScan: mocks.guardScan,
    guardWatchEvent: mocks.guardWatchEvent,
    teamPolicy: mocks.teamPolicy,
  },
}));

import { compareScanToPreviousPersonalScan, evaluateContinuousWatch } from "@/lib/services/team-security";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.teamPolicy.upsert.mockResolvedValue({
    id: "policy-123",
    mcpDenylistJson: ["toolGateway"],
    extensionDenylistJson: ["unknown.agent-runner"],
  });
  mocks.guardScan.findMany.mockResolvedValue([
    {
      id: "scan-123",
      organizationId: "org-123",
      workspaceHash: "workspace-123",
      score: 72,
      findingsJson: [],
      summaryJson: { note: "unknown.agent-runner-backup should not count as exact extension denylist hit" },
      categoryScoresJson: {},
      connectionMapJson: {},
      mcpServersJson: [{ name: "toolGateway", command: "npx", configPath: ".cursor/mcp.json" }],
      extensionsJson: [{ id: "unknown.agent-runner", displayName: "Agent Runner", publisher: "unknown" }],
    },
  ]);
  mocks.guardScan.findFirst.mockResolvedValue({
    id: "scan-123",
    organizationId: "org-123",
    workspaceHash: "workspace-123",
    score: 72,
    findingsJson: [],
    mcpServersJson: [{ name: "toolGateway", command: "npx", configPath: ".cursor/mcp.json" }],
    extensionsJson: [{ id: "unknown.agent-runner", displayName: "Agent Runner", publisher: "unknown" }],
    workspaceSurfaceJson: {},
  });
  mocks.guardBaseline.findFirst.mockResolvedValue(null);
  mocks.guardWatchEvent.findFirst.mockResolvedValue(null);
  mocks.guardWatchEvent.create.mockImplementation(async ({ data }) => ({
    id: "event-123",
    eventType: data.eventType,
    severity: data.severity,
    logicalPath: data.logicalPath,
    guardScanId: data.guardScanId,
    createdAt: new Date("2026-06-13T00:00:00.000Z"),
  }));
});

describe("evaluateContinuousWatch", () => {
  it("enforces MCP and extension denylists using structured inventory", async () => {
    const result = await evaluateContinuousWatch({
      organizationId: "org-123",
      actorUserId: "user-123",
    });

    expect(result.eventsCreated).toBe(1);
    expect(mocks.guardWatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "policy_violation",
        severity: "high",
        logicalPath: "toolgateway, unknown.agent-runner",
        metadataJson: expect.objectContaining({
          deniedMcp: ["toolgateway"],
          deniedExtensions: ["unknown.agent-runner"],
        }),
      }),
      select: expect.any(Object),
    });
  });

  it("records baseline drift when structured MCP inventory changes", async () => {
    mocks.guardBaseline.findFirst.mockResolvedValueOnce({
      id: "baseline-123",
      guardScanId: "baseline-scan-123",
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
      guardScan: {
        id: "baseline-scan-123",
        score: 80,
        rank: "Guardian",
        findingsJson: [],
        mcpServersJson: [{ name: "approvedGateway", command: "node", configPath: ".cursor/mcp.json" }],
        extensionsJson: [],
        workspaceSurfaceJson: {},
      },
    });

    const result = await evaluateContinuousWatch({
      organizationId: "org-123",
      actorUserId: "user-123",
    });

    expect(result.eventsCreated).toBe(2);
    expect(mocks.guardWatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "baseline_drift",
        metadataJson: expect.objectContaining({
          newMcpToolCount: 1,
          newExtensionCount: 1,
        }),
      }),
      select: expect.any(Object),
    });
  });
});

describe("compareScanToPreviousPersonalScan", () => {
  it("compares a Security Pro user's current scan to the previous personal scan", async () => {
    mocks.guardScan.findFirst
      .mockResolvedValueOnce({
        id: "scan-current",
        organizationId: "org-123",
        actorUserId: "user-123",
        workspaceHash: "workspace-123",
        score: 65,
        rank: "Operator",
        createdAt: new Date("2026-06-13T00:00:00.000Z"),
        findingsJson: [{ id: "secret:new", category: "secret-hygiene", severity: "high", title: "New secret", path: ".env" }],
        mcpServersJson: [{ name: "toolGateway" }],
        extensionsJson: [{ id: "unknown.agent-runner" }],
        workspaceSurfaceJson: { deploymentFiles: [{ path: "scripts/deploy.sh" }] },
      })
      .mockResolvedValueOnce({
        id: "scan-previous",
        organizationId: "org-123",
        actorUserId: "user-123",
        workspaceHash: "workspace-123",
        score: 72,
        rank: "Operator",
        createdAt: new Date("2026-06-12T00:00:00.000Z"),
        findingsJson: [],
        mcpServersJson: [],
        extensionsJson: [],
        workspaceSurfaceJson: {},
      });

    const result = await compareScanToPreviousPersonalScan({
      organizationId: "org-123",
      actorUserId: "user-123",
      guardScanId: "scan-current",
    });

    expect(result.previousScan?.id).toBe("scan-previous");
    expect(result.diff?.newSecrets).toHaveLength(1);
    expect(result.diff?.newMcpTools).toEqual(["toolgateway"]);
    expect(result.diff?.newExtensions).toEqual(["unknown.agent-runner"]);
    expect(result.diff?.newDeploymentSurfaces).toEqual(["scripts/deploy.sh"]);
    expect(result.diff?.scoreDelta).toBe(-7);
  });

  it("skips personal previous-scan comparison for shared reports owned by another user", async () => {
    mocks.guardScan.findFirst.mockResolvedValueOnce({
      id: "scan-shared",
      organizationId: "org-123",
      actorUserId: "other-user",
      workspaceHash: "workspace-123",
      score: 71,
      rank: "Operator",
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      findingsJson: [],
      mcpServersJson: [],
      extensionsJson: [],
      workspaceSurfaceJson: {},
    });

    const result = await compareScanToPreviousPersonalScan({
      organizationId: "org-123",
      actorUserId: "user-123",
      guardScanId: "scan-shared",
    });

    expect(result.previousScan).toBeNull();
    expect(result.diff).toBeNull();
    expect(mocks.guardScan.findFirst).toHaveBeenCalledTimes(1);
  });
});
