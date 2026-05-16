import { createStarterXu } from "./createStarterXu";
import type { ApplicationBuildRunbook, XuMode } from "./types";

function firstSentence(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(.+?[.!?])\s/);
  return (match?.[1] ?? trimmed).slice(0, 220);
}

function modePurpose(mode: XuMode, prompt: string) {
  const summary = firstSentence(prompt);
  if (summary) {
    return summary;
  }

  switch (mode) {
    case "build-app":
      return "Build an application from an approved DryLake runbook.";
    case "phases":
      return "Break the requested work into approval-gated execution phases.";
    case "plan":
      return "Create an inspectable implementation plan for AI coding agents.";
    case "review":
      return "Review or repair the workspace through an approval-gated runbook.";
  }
}

export function createLocalDraftXu(params: {
  prompt: string;
  mode: XuMode;
  workspaceSummary?: string;
  currentRunbook?: ApplicationBuildRunbook;
}) {
  const base = params.currentRunbook ?? createStarterXu({ prompt: params.prompt, mode: params.mode });
  const purpose = modePurpose(params.mode, params.prompt);
  const workspaceNote = params.workspaceSummary?.split("\n").find((line) => line.startsWith("Workspace:")) ?? "Workspace: current";

  return {
    ...base,
    metadata: {
      ...base.metadata,
      mode: params.mode,
      status: "draft",
    },
    intent: {
      ...base.intent,
      rawPrompt: params.prompt,
      purpose,
      users: base.intent.users.length > 0 ? base.intent.users : ["developer"],
      goals:
        base.intent.goals.length > 0
          ? base.intent.goals
          : [
              "Create an inspectable drylake.xu runbook.",
              "Confirm purpose before architecture work.",
              "Approve architecture before execution handoff.",
              "Generate native agent files from the approved runbook.",
            ],
      nonGoals:
        base.intent.nonGoals.length > 0
          ? base.intent.nonGoals
          : [
              "Do not deploy or publish from this runbook.",
              "Do not run provisioning commands automatically.",
              "Do not call production APIs from the runbook flow.",
            ],
      constraints:
        base.intent.constraints.length > 0
          ? base.intent.constraints
          : [
              "Local-first workflow.",
              "Preview provisioning before execution.",
              "Keep generated artifacts under .drylake/generated first.",
              "Preserve user files with backups before overwrite.",
            ],
    },
    architecture: {
      ...base.architecture,
      status: "proposed",
      summary:
        base.architecture.summary ||
        `Use the current workspace as the source of truth (${workspaceNote}). Keep the runbook, approvals, generated files, and phase handoffs inspectable on disk.`,
      decisions:
        base.architecture.decisions.length > 0
          ? base.architecture.decisions
          : [
              {
                id: "ADR-001",
                choice: "Use drylake.xu as the workflow source of truth.",
                rationale: "The user can inspect and version purpose, constraints, architecture, phases, and handoff instructions.",
              },
              {
                id: "ADR-002",
                choice: "Generate preview artifacts before installing root instruction files.",
                rationale: "Preview-first generation makes the workflow safe to test in development.",
              },
            ],
      risks:
        base.architecture.risks.length > 0
          ? base.architecture.risks
          : [
              "The generated draft is local and deterministic when no integrated AI is available.",
              "Execution still depends on the user's chosen coding agent.",
            ],
      assumptions:
        base.architecture.assumptions.length > 0
          ? base.architecture.assumptions
          : [
              "The user will approve purpose and architecture before execution.",
              "Provisioning commands are reviewed manually.",
            ],
    },
    provisioning: {
      ...base.provisioning,
      status: "draft",
      commands: base.provisioning.commands.length > 0 ? base.provisioning.commands : ["npm install", "npm run build"],
      filesToCreate:
        base.provisioning.filesToCreate.length > 0
          ? base.provisioning.filesToCreate
          : [".drylake/generated/RUNBOOK.md", ".drylake/generated/AGENTS.md", ".drylake/generated/CLAUDE.md"],
      safety: {
        requiresApprovalBeforeExecution: true,
        executeAutomatically: false,
      },
    },
  } satisfies ApplicationBuildRunbook;
}
