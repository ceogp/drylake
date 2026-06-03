import * as path from "node:path";
import * as vscode from "vscode";

import { scanWorkspaceFiles } from "../services/workspaceScanner";
import type { XuHandoffProfileRef, XuPhaseAgent } from "../xu/types";

export type HandoffProfileSelection = {
  kind: XuHandoffProfileRef["kind"];
  label: string;
  logicalPath: string;
  sourcePlatform: XuHandoffProfileRef["sourcePlatform"];
  content: string;
};

const MAX_PROFILE_CHARS = 6_000;

export function supportsHandoffProfiles(agent: XuPhaseAgent) {
  return agent === "codex" || agent === "claude-code" || agent === "copilot" || agent === "blackbox";
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

  if (agent === "copilot") {
    return (
      category === "rule" &&
      (/^\.github\/copilot-instructions\.md$/i.test(normalized) || /^\.github\/instructions\/.+\.instructions\.md$/i.test(normalized))
    );
  }

  if (agent === "blackbox") {
    return (
      category === "skill" &&
      /^\.blackbox\/skills\/.+\/SKILL\.md$/i.test(normalized)
    );
  }

  return false;
}

function sourcePlatformForAgent(agent: XuPhaseAgent): HandoffProfileSelection["sourcePlatform"] | undefined {
  if (agent === "claude-code") {
    return "claude";
  }

  if (agent === "copilot") {
    return "copilot";
  }

  if (agent === "codex") {
    return "codex";
  }

  if (agent === "blackbox") {
    return "blackbox";
  }

  return undefined;
}

function sourcePlatformLabel(sourcePlatform: HandoffProfileSelection["sourcePlatform"]) {
  if (sourcePlatform === "codex") {
    return "Codex";
  }

  if (sourcePlatform === "claude") {
    return "Claude";
  }

  if (sourcePlatform === "blackbox") {
    return "Blackbox";
  }

  return "GitHub Copilot";
}

function kindForCategory(category: string): HandoffProfileSelection["kind"] {
  if (category === "skill") {
    return "skill";
  }

  if (category === "rule" || category === "instruction") {
    return "instruction";
  }

  return "agent";
}

export async function collectHandoffProfiles(agent: XuPhaseAgent): Promise<HandoffProfileSelection[]> {
  if (!supportsHandoffProfiles(agent)) {
    return [];
  }

  const files = await scanWorkspaceFiles(vscode.workspace.getConfiguration("xupra"));
  const sourcePlatform = sourcePlatformForAgent(agent);
  if (!sourcePlatform) {
    return [];
  }

  return files
    .filter((file) => matchesAgent(agent, file.logicalPath, file.category))
    .map((file): HandoffProfileSelection => ({
      kind: kindForCategory(file.category),
      label: profileLabel(file.logicalPath),
      logicalPath: normalizeLogicalPath(file.logicalPath),
      sourcePlatform,
      content: file.content,
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

export function handoffProfileRef(profile: HandoffProfileSelection): XuHandoffProfileRef {
  return {
    kind: profile.kind,
    label: profile.label,
    logicalPath: profile.logicalPath,
    sourcePlatform: profile.sourcePlatform,
  };
}

export function handoffProfileMatchesAgent(agent: XuPhaseAgent, profile: XuHandoffProfileRef | undefined) {
  if (!profile) {
    return false;
  }

  const sourcePlatform = sourcePlatformForAgent(agent);
  return Boolean(sourcePlatform && profile.sourcePlatform === sourcePlatform);
}

export async function resolveHandoffProfile(
  agent: XuPhaseAgent,
  profile: XuHandoffProfileRef | undefined,
): Promise<HandoffProfileSelection | undefined> {
  if (!profile || !handoffProfileMatchesAgent(agent, profile)) {
    return undefined;
  }

  const profiles = await collectHandoffProfiles(agent);
  return profiles.find((candidate) => candidate.logicalPath === normalizeLogicalPath(profile.logicalPath));
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
    `Use this ${sourcePlatformLabel(profile.sourcePlatform)} ${profile.kind} for this handoff.`,
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
