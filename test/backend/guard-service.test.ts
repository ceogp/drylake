import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    guardScan: {
      create: vi.fn(),
    },
    guardArtifact: {
      create: vi.fn(),
    },
  },
  saveGuardArtifactText: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/storage/artifacts", () => ({
  saveGuardArtifactText: mocks.saveGuardArtifactText,
}));

import { recordGuardScanUpload } from "@/lib/services/guard";

const basePayload = {
  workspaceHash: "workspace-123456",
  sourceClient: "vscode",
  consentMode: "baseline_upload" as const,
  scan: {
    scannedAt: "2026-06-12T00:00:00.000Z",
    score: 72,
    rank: "Operator" as const,
    summary: {
      mcpServers: 1,
      findings: 2,
    },
    categoryScores: {
      mcpRisk: 60,
      secretHygiene: 70,
    },
    findings: [
      {
        id: "mcp:test",
        category: "mcp-risk",
        severity: "high" as const,
        title: "MCP server passes secret-like env vars",
        evidence: "ANTHROPIC_API_KEY is referenced.",
        recommendation: "Use scoped keys and review server permissions.",
      },
    ],
    connectionMap: {
      nodes: [],
      edges: [],
      highRiskPaths: [],
    },
    extensions: [],
    mcpServers: [],
    workspaceSurface: {
      deploymentFiles: [],
      iacFiles: [],
      ciWorkflowFiles: [],
      credentialLikeFiles: [],
      riskyPackageScripts: [],
      generatedFolders: [],
    },
    packageManagers: ["npm"],
    packageScripts: ["build"],
  },
  artifacts: [
    {
      kind: "mcp-config" as const,
      logicalPath: ".vscode/mcp.json",
      content: JSON.stringify({
        mcpServers: {
          test: {
            command: "npx",
            env: {
              ANTHROPIC_API_KEY: "sk-ant-test-secret-value",
            },
          },
        },
      }),
      mimeType: "application/json",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.guardScan.create.mockResolvedValue({
    id: "guard-scan-123",
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
  });
  mocks.prisma.guardArtifact.create.mockImplementation(async ({ data }) => ({
    id: "guard-artifact-123",
    kind: data.kind,
    logicalPath: data.logicalPath,
    sizeBytes: data.sizeBytes,
    redacted: data.redacted,
  }));
  mocks.saveGuardArtifactText.mockResolvedValue({
    storageKey: "guard/scans/guard-scan-123/artifacts/.vscode/mcp.json",
    mimeType: "application/json",
    sizeBytes: 128,
    checksumSha256: "stored-checksum",
  });
});

describe("recordGuardScanUpload", () => {
  it("stores scan metadata and redacted consented artifacts", async () => {
    const result = await recordGuardScanUpload({
      organizationId: "org-123",
      actorUserId: "user-123",
      payload: basePayload,
    });

    expect(result.guardScan.id).toBe("guard-scan-123");
    expect(result.artifacts).toHaveLength(1);
    expect(mocks.prisma.guardScan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-123",
        actorUserId: "user-123",
        sourceClient: "vscode",
        workspaceHash: "workspace-123456",
        score: 72,
        rank: "Operator",
        consentMode: "baseline_upload",
        uploadedArtifactCount: 1,
      }),
      select: {
        id: true,
        createdAt: true,
      },
    });
    expect(mocks.saveGuardArtifactText).toHaveBeenCalledWith(expect.objectContaining({
      guardScanId: "guard-scan-123",
      logicalPath: ".vscode/mcp.json",
      mimeType: "application/json",
    }));
    expect(mocks.saveGuardArtifactText.mock.calls[0][0].text).toContain("[REDACTED]");
    expect(mocks.saveGuardArtifactText.mock.calls[0][0].text).not.toContain("sk-ant-test-secret-value");
    expect(mocks.prisma.guardArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        guardScanId: "guard-scan-123",
        organizationId: "org-123",
        actorUserId: "user-123",
        kind: "mcp-config",
        logicalPath: ".vscode/mcp.json",
        contentHash: expect.any(String),
        redacted: true,
        storageKey: "guard/scans/guard-scan-123/artifacts/.vscode/mcp.json",
      }),
      select: {
        id: true,
        kind: true,
        logicalPath: true,
        sizeBytes: true,
        redacted: true,
      },
    });
  });

  it("does not store artifacts when consent mode is local", async () => {
    const result = await recordGuardScanUpload({
      organizationId: "org-123",
      actorUserId: "user-123",
      payload: {
        ...basePayload,
        consentMode: "local",
      },
    });

    expect(result.artifacts).toEqual([]);
    expect(mocks.prisma.guardScan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        consentMode: "local",
        uploadedArtifactCount: 0,
      }),
    }));
    expect(mocks.saveGuardArtifactText).not.toHaveBeenCalled();
    expect(mocks.prisma.guardArtifact.create).not.toHaveBeenCalled();
  });
});
