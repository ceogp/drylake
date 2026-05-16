import { renderAgentsMd } from "./renderAgentsMd";
import { renderClaudeMd } from "./renderClaudeMd";
import { renderCodexSkill } from "./renderCodexSkill";
import { renderCopilotInstructions } from "./renderCopilotInstructions";
import { renderCursorRules } from "./renderCursorRules";
import { renderOpenClawSkill } from "./renderOpenClawSkill";
import { renderPhasePrompt } from "./renderPhasePrompt";
import { renderRunbookMd } from "./renderRunbookMd";
import type { ApplicationBuildRunbook, BuildSessionState } from "../xu/types";

export type GeneratedRunbookFile = {
  logicalPath: string;
  content: string;
};

export type RenderGeneratedFilesOptions = {
  activeProvider?: Pick<BuildSessionState, "providerId" | "providerLabel"> | null;
};

export function renderGeneratedFiles(
  runbook: ApplicationBuildRunbook,
  options: RenderGeneratedFilesOptions = {},
): GeneratedRunbookFile[] {
  const files: GeneratedRunbookFile[] = [
    {
      logicalPath: ".drylake/generated/RUNBOOK.md",
      content: renderRunbookMd(runbook),
    },
    ...runbook.phases.map((phase) => ({
      logicalPath: `.drylake/generated/phase-${phase.id}.md`,
      content: renderPhasePrompt(runbook, phase, { activeProvider: options.activeProvider }),
    })),
  ];

  if (runbook.agentTargets.agentsMd) {
    files.push({ logicalPath: ".drylake/generated/AGENTS.md", content: renderAgentsMd(runbook) });
  }

  if (runbook.agentTargets.claudeMd) {
    files.push({ logicalPath: ".drylake/generated/CLAUDE.md", content: renderClaudeMd(runbook) });
  }

  if (runbook.agentTargets.copilotInstructions) {
    files.push({
      logicalPath: ".drylake/generated/.github/copilot-instructions.md",
      content: renderCopilotInstructions(runbook),
    });
  }

  if (runbook.agentTargets.cursorRules) {
    files.push({
      logicalPath: ".drylake/generated/.cursor/rules/drylake.mdc",
      content: renderCursorRules(runbook),
    });
  }

  if (runbook.agentTargets.codexSkill) {
    files.push({
      logicalPath: ".drylake/generated/.agents/skills/drylake-execution/SKILL.md",
      content: renderCodexSkill(runbook),
    });
  }

  if (runbook.agentTargets.openclawSkill) {
    files.push({
      logicalPath: ".drylake/generated/.openclaw/skills/drylake-execution/SKILL.md",
      content: renderOpenClawSkill(runbook),
    });
  }

  return files;
}

