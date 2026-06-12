import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  freePlanningModel: vi.fn(),
  generateAiText: vi.fn(),
}));

vi.mock("@/lib/services/ai-model-selection", () => ({
  freePlanningModel: mocks.freePlanningModel,
}));

vi.mock("@/lib/services/ai-text", () => ({
  generateAiText: mocks.generateAiText,
}));

import { generateGuardFixPlan, guardFixPlanInputSchema } from "@/lib/services/guard-remediation";

const input = guardFixPlanInputSchema.parse({
  workspaceHash: "workspace-123456",
  sourceClient: "vscode",
  scan: {
    scannedAt: "2026-06-12T01:19:32.000Z",
    score: 41,
    rank: "Scout",
    summary: { findings: 110, secrets: 17 },
    categoryScores: { mcpRisk: 5, secretHygiene: 0, ideBloat: 0, tokenWaste: 95, blastRadius: 82 },
    findings: [
      {
        id: "blast-radius",
        category: "blast-radius",
        severity: "critical",
        title: "Agent blast radius: secrets plus deployment surface",
        evidence: "Secret-like references and deploy surfaces were detected together.",
        recommendation: "Require approval before agent execution.",
        source: "workspace",
      },
    ],
    extensions: [
      {
        id: "GitLab.gitlab-workflow",
        displayName: "GitLab",
        publisher: "GitLab",
        isActive: true,
        accessLevel: "high",
        capabilityTags: ["source control", "workspace files"],
        riskFlags: ["High access extension is active."],
        accessSignals: ["Contributes commands and source control surfaces."],
      },
    ],
    secrets: [
      {
        path: ".env",
        line: 31,
        type: "AWS credential variable",
        variableName: "AWS_ACCESS_KEY_ID",
        severity: "high",
      },
    ],
    mcpServers: [
      {
        configPath: "drylake-cursor-plugin/mcp.json",
        name: "drylake",
        command: "npx",
        envKeys: ["DRYLAKE_AGENT_TOKEN"],
        capabilities: ["unknown tools"],
        riskFlags: ["Unpinned npx MCP server package."],
        severity: "high",
        blastRadius: "Unknown tool capability with secret-like variables.",
      },
    ],
    workspaceSurface: {
      deploymentFiles: [{ path: "scripts/deploy/verify-deploy.sh", type: "Deployment or migration surface" }],
      iacFiles: [{ path: "docker-compose.yml", type: "Infrastructure or deployment config" }],
      ciWorkflowFiles: [{ path: ".gitlab-ci.yml", type: "CI/CD workflow" }],
      credentialLikeFiles: [],
      riskyPackageScripts: [{ path: "package.json", name: "aws:deploy-staging", risk: "deployment" }],
      generatedFolders: [],
    },
    connectionMap: {
      highRiskPaths: ["GitLab: source control, workspace files, terminal/commands"],
      edges: [
        {
          from: "ide:vscode",
          to: "extension:GitLab.gitlab-workflow",
          label: "active extension",
          severity: "high",
        },
      ],
    },
  },
});

const plan = {
  summary: "Prioritize approval gates, secret isolation, and pinned MCP packages.",
  actions: [
    {
      title: "Require approval before agent execution",
      priority: "critical",
      category: "blast-radius",
      why: "Secrets and deploy surfaces are reachable from agent tooling.",
      recommendation: "Add an approval gate for command-capable agents before deploy or credential-adjacent tasks.",
      files: [".env", "package.json"],
      approvalRequired: true,
    },
  ],
  cautions: ["Do not paste secret values into prompts or reports."],
  nextSteps: ["Re-run DryLake Guard after remediation."],
} as const;

beforeEach(() => {
  mocks.freePlanningModel.mockReset();
  mocks.generateAiText.mockReset();
  mocks.freePlanningModel.mockReturnValue("claude-haiku-4-5-20251001");
  mocks.generateAiText.mockResolvedValue(JSON.stringify(plan));
});

describe("generateGuardFixPlan", () => {
  it("uses the supplied Haiku model and returns a validated remediation plan", async () => {
    const result = await generateGuardFixPlan(input, { model: "claude-haiku-4-5-20251001" });

    expect(result).toEqual(plan);
    expect(mocks.generateAiText).toHaveBeenCalledWith(expect.objectContaining({
      taskLabel: "Guard Fix with AI",
      model: "claude-haiku-4-5-20251001",
    }));
    expect(mocks.generateAiText.mock.calls[0][0].userPrompt).toContain("AWS_ACCESS_KEY_ID");
    expect(mocks.generateAiText.mock.calls[0][0].userPrompt).not.toContain("AKIA");
  });

  it("defaults to the free planning model for Guard remediation", async () => {
    await generateGuardFixPlan(input);

    expect(mocks.freePlanningModel).toHaveBeenCalledOnce();
    expect(mocks.generateAiText).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-haiku-4-5-20251001",
    }));
  });
});
