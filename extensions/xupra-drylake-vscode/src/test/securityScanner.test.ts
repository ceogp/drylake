import { beforeEach, describe, expect, it, vi } from "vitest";

import { runSecurityScan } from "../services/securityScanner";
import { scanWorkspaceFiles } from "../services/workspaceScanner";

const envUri = { fsPath: "/workspace/.env", path: "/workspace/.env" };
const mcpUri = { fsPath: "/workspace/.cursor/mcp.json", path: "/workspace/.cursor/mcp.json" };
const packageUri = { fsPath: "/workspace/package.json", path: "/workspace/package.json" };
const workflowUri = { fsPath: "/workspace/.github/workflows/deploy.yml", path: "/workspace/.github/workflows/deploy.yml" };
const dockerUri = { fsPath: "/workspace/Dockerfile", path: "/workspace/Dockerfile" };

vi.mock("../services/workspaceScanner", () => ({
  scanWorkspaceFiles: vi.fn(),
}));

vi.mock("vscode", () => ({
  extensions: {
    all: [
      {
        id: "unknown.agent-runner",
        isActive: true,
        packageJSON: {
          name: "agent-runner",
          displayName: "Agent Runner",
          publisher: "unknown",
          version: "1.0.0",
          activationEvents: ["onStartupFinished"],
          contributes: {
            commands: [{ command: "agent.runShell", title: "Run Shell Agent" }],
            configuration: {},
          },
        },
      },
      {
        id: "vscode.git",
        isActive: true,
        packageJSON: {
          name: "git",
          displayName: "Git",
          publisher: "vscode",
          version: "1.0.0",
          isBuiltin: true,
        },
      },
    ],
  },
  Uri: {
    file: (value: string) => ({ fsPath: value, path: value }),
  },
  workspace: {
    getConfiguration: vi.fn(),
    getWorkspaceFolder: vi.fn((uri: { fsPath: string }) => uri.fsPath.startsWith("/workspace") ? { uri: { fsPath: "/workspace" } } : undefined),
    asRelativePath: vi.fn((uri: { path?: string; fsPath?: string }) => String(uri.path ?? uri.fsPath).replace("/workspace/", "")),
    findFiles: vi.fn(async (pattern: string) => {
      if (pattern.includes(".env")) {
        return [envUri];
      }

      if (pattern.includes("mcp.json")) {
        return [mcpUri];
      }

      if (pattern.endsWith("package.json")) {
        return [packageUri];
      }

      if (pattern.includes(".github/workflows")) {
        return [workflowUri];
      }

      if (pattern.endsWith("Dockerfile")) {
        return [dockerUri];
      }

      return [];
    }),
    fs: {
      stat: vi.fn(async (uri: { fsPath: string }) => {
        if ([envUri.fsPath, mcpUri.fsPath, packageUri.fsPath, workflowUri.fsPath, dockerUri.fsPath].includes(uri.fsPath)) {
          return { size: 2048 };
        }

        throw new Error("not found");
      }),
      readFile: vi.fn(async (uri: { fsPath: string }) => {
        if (uri.fsPath === envUri.fsPath) {
          return new TextEncoder().encode('OPENAI_API_KEY="sk-test123456789012345678901234567890"');
        }

        if (uri.fsPath === mcpUri.fsPath) {
          return new TextEncoder().encode(JSON.stringify({
            mcpServers: {
              toolGateway: {
                command: "npx",
                args: ["-y", "@toolhouse/mcp"],
                env: {
                  TOOL_GATEWAY_API_KEY: "redacted",
                },
              },
            },
          }));
        }

        if (uri.fsPath === packageUri.fsPath) {
          return new TextEncoder().encode(JSON.stringify({
            scripts: {
              build: "next build",
              deploy: "aws s3 sync ./out s3://production-bucket",
              "db:migrate": "prisma migrate deploy",
              test: "vitest run",
            },
          }));
        }

        if (uri.fsPath === workflowUri.fsPath || uri.fsPath === dockerUri.fsPath) {
          return new TextEncoder().encode("metadata only");
        }

        return new Uint8Array();
      }),
    },
  },
}));

beforeEach(() => {
  vi.mocked(scanWorkspaceFiles).mockResolvedValue([
    { logicalPath: ".claude/skills/reviewer/SKILL.md", category: "skill", content: "review" },
    { logicalPath: "AGENTS.md", category: "instruction", content: "instructions" },
  ] as never);
});

describe("security scanner", () => {
  it("builds an IDE firewall scan across agents, extensions, secrets, and MCP servers", async () => {
    const scan = await runSecurityScan();

    expect(scan.summary.agentFiles).toBe(2);
    expect(scan.summary.extensions).toBe(1);
    expect(scan.summary.mcpServers).toBe(1);
    expect(scan.summary.riskyFiles).toBe(1);
    expect(scan.summary.workspaceSurface).toBeGreaterThanOrEqual(4);
    expect(scan.secrets[0]).toMatchObject({ type: "OpenAI API key variable", path: ".env", variableName: "OPENAI_API_KEY" });
    expect(scan.secrets[0].evidence).not.toContain("sk-test");
    expect(scan.mcpServers[0].capabilities).toContain("connected tool gateway");
    expect(scan.mcpServers[0].riskFlags).toContain("Unpinned npx MCP server package.");
    expect(scan.extensions[0].riskFlags).toContain("Unknown or not-yet-approved publisher.");
    expect(scan.workspaceSurface.iacFiles[0]).toMatchObject({ path: "Dockerfile" });
    expect(scan.workspaceSurface.ciWorkflowFiles[0]).toMatchObject({ path: ".github/workflows/deploy.yml" });
    expect(scan.workspaceSurface.riskyPackageScripts.map((script) => script.name)).toEqual(["db:migrate", "deploy"]);
    expect(scan.findings.map((finding) => finding.id)).toContain("workspace:iac-surface");
    expect(scan.findings.map((finding) => finding.id)).toContain("workspace:ci-workflows");
    expect(scan.categoryScores.mcpRisk).toBeLessThan(100);
    expect(scan.findings.length).toBeGreaterThan(0);
    expect(scan.score).toBeLessThan(100);
  });
});
