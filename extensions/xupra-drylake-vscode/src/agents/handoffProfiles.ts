import * as path from "node:path";
import * as vscode from "vscode";

import { scanWorkspaceFiles } from "../services/workspaceScanner";
import type { XuPhaseAgent } from "../xu/types";

export type HandoffProfileSelection = {
  kind: "skill" | "agent";
  label: string;
  logicalPath: string;
  sourcePlatform: "codex" | "claude";
  content: string;
};

type HandoffProfileQuickPickItem = vscode.QuickPickItem & {
  profile?: HandoffProfileSelection;
};

const MAX_PROFILE_CHARS = 6_000;

export function supportsHandoffProfiles(agent: XuPhaseAgent) {
  return agent === "codex" || agent === "claude-code";
}

function normalizeLogicalPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function profileLabel(logicalPath: string) {
  const normalized = normalizeLogicalPath(logicalPath);
  if (/\/SKILL\.md$/i.test(normalized)) {
    return normalized.split("/").at(-2) ?? normalized;
  }

  return path.posix.basename(normalized, path.posix.extname(normalized)) || normalized;
}

function matchesAgent(agent: XuPhaseAgent, logicalPath: string, category: string) {
  const normalized = normalizeLogicalPath(logicalPath);
  if (agent === "codex") {
    return (
      category === "skill" &&
      (/^\.codex\/skills\/.+\/SKILL\.md$/i.test(normalized) || /^\.agents\/skills\/.+\/SKILL\.md$/i.test(normalized))
    ) || (
      category === "agent_config" &&
      /^\.codex\/agents\/.+\.toml$/i.test(normalized)
    );
  }

  if (agent === "claude-code") {
    return (
      category === "skill" &&
      /^\.claude\/skills\/.+\/SKILL\.md$/i.test(normalized)
    ) || (
      category === "subagent" &&
      /^\.claude\/agents\/.+\.md$/i.test(normalized)
    );
  }

  return false;
}

export async function collectHandoffProfiles(agent: XuPhaseAgent): Promise<HandoffProfileSelection[]> {
  if (!supportsHandoffProfiles(agent)) {
    return [];
  }

  const files = await scanWorkspaceFiles(vscode.workspace.getConfiguration("xupra"));
  const sourcePlatform = agent === "codex" ? "codex" : "claude";

  return files
    .filter((file) => matchesAgent(agent, file.logicalPath, file.category))
    .map((file): HandoffProfileSelection => ({
      kind: file.category === "skill" ? "skill" : "agent",
      label: profileLabel(file.logicalPath),
      logicalPath: normalizeLogicalPath(file.logicalPath),
      sourcePlatform,
      content: file.content,
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

export async function pickHandoffProfile(agent: XuPhaseAgent): Promise<HandoffProfileSelection | undefined> {
  const profiles = await collectHandoffProfiles(agent);
  if (profiles.length === 0) {
    return undefined;
  }

  const items: HandoffProfileQuickPickItem[] = [
    {
      label: "No skill/profile",
      description: "Run the handoff without extra skill context",
    },
    ...profiles.map((profile) => ({
      label: profile.label,
      description: `${profile.sourcePlatform} ${profile.kind}`,
      detail: profile.logicalPath,
      profile,
    })),
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Select Skill / Agent Profile",
    placeHolder: "Optional: add a Codex or Claude skill/profile to this handoff",
    ignoreFocusOut: true,
  });

  return picked?.profile;
}

export function renderHandoffProfilePrompt(profile: HandoffProfileSelection | undefined) {
  if (!profile) {
    return "";
  }

  const content = profile.content.length > MAX_PROFILE_CHARS
    ? `${profile.content.slice(0, MAX_PROFILE_CHARS)}\n\n[DryLake truncated this profile for handoff prompt size.]`
    : profile.content;

  return [
    "## Requested Skill / Agent Profile",
    "",
    `Use this ${profile.sourcePlatform === "codex" ? "Codex" : "Claude"} ${profile.kind} for this handoff.`,
    `- Name: ${profile.label}`,
    `- Source: ${profile.logicalPath}`,
    "",
    "Instructions excerpt:",
    "",
    "```text",
    content.replace(/```/g, "'''"),
    "```",
    "",
  ].join("\n");
}
