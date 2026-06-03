import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scanWorkspaceFiles: vi.fn(),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({})),
  },
}));

vi.mock("../services/workspaceScanner", () => ({
  scanWorkspaceFiles: mocks.scanWorkspaceFiles,
}));

import {
  collectHandoffProfiles,
  handoffProfileMatchesAgent,
  renderHandoffProfilePrompt,
} from "../agents/handoffProfiles";

describe("handoff profiles", () => {
  beforeEach(() => {
    mocks.scanWorkspaceFiles.mockReset();
  });

  it("exposes DryLake skills to every phase agent", async () => {
    mocks.scanWorkspaceFiles.mockResolvedValue([
      {
        logicalPath: ".agents/skills/security/SKILL.md",
        category: "skill",
        content: "Check secrets and permissions before final handoff.",
      },
      {
        logicalPath: ".codex/skills/token-reduction/SKILL.md",
        category: "skill",
        content: "Reduce Codex prompt size.",
      },
    ]);

    const clineProfiles = await collectHandoffProfiles("cline");
    const kiloProfiles = await collectHandoffProfiles("kilo");

    expect(clineProfiles).toHaveLength(1);
    expect(clineProfiles[0]).toMatchObject({
      label: "security",
      logicalPath: ".agents/skills/security/SKILL.md",
      sourcePlatform: "drylake",
    });
    expect(kiloProfiles[0].sourcePlatform).toBe("drylake");
    expect(handoffProfileMatchesAgent("continue", clineProfiles[0])).toBe(true);
    expect(renderHandoffProfilePrompt(clineProfiles[0])).toContain("Use this DryLake skill for this handoff.");
    expect(renderHandoffProfilePrompt(clineProfiles[0])).toContain("Check secrets and permissions");
  });

  it("keeps native agent profiles scoped to their matching agent", async () => {
    mocks.scanWorkspaceFiles.mockResolvedValue([
      {
        logicalPath: ".codex/skills/token-reduction/SKILL.md",
        category: "skill",
        content: "Reduce Codex prompt size.",
      },
      {
        logicalPath: ".claude/skills/review/SKILL.md",
        category: "skill",
        content: "Review as Claude.",
      },
    ]);

    const codexProfiles = await collectHandoffProfiles("codex");
    const clineProfiles = await collectHandoffProfiles("cline");

    expect(codexProfiles.map((profile) => profile.sourcePlatform)).toEqual(["codex"]);
    expect(handoffProfileMatchesAgent("codex", codexProfiles[0])).toBe(true);
    expect(handoffProfileMatchesAgent("cline", codexProfiles[0])).toBe(false);
    expect(clineProfiles).toEqual([]);
  });
});
