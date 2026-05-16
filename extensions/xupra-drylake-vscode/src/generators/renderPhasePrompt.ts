import { GENERATED_HEADER, bulletList, numberedList } from "./common";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ApplicationBuildRunbook, XuPhase, XuPhaseAgent } from "../xu/types";

const AGENT_PREAMBLES: Record<XuPhaseAgent, string> = {
  "claude-code": "You are running as Claude Code. Use the bash tool for file operations.",
  codex: "You are running as Codex CLI. Output shell commands and file patches.",
  cursor: "You are running inside Cursor. Use the Composer for multi-file edits.",
  copilot: "You are running as GitHub Copilot. Use inline suggestions and chat.",
  "external-ai-prompt": "Copy this prompt into your preferred AI tool.",
};

function normalizeAgent(value: unknown): XuPhaseAgent | undefined {
  return typeof value === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(value)
    ? (value as XuPhaseAgent)
    : undefined;
}

function agentPreamble(runbook: ApplicationBuildRunbook, phase: XuPhase) {
  const agent = phase.agent ?? normalizeAgent(runbook.handoff.defaultAgent);

  if (agent) {
    return AGENT_PREAMBLES[agent];
  }

  return `Use the configured DryLake AI provider: ${runbook.handoff.defaultAgent || "session default"}.`;
}

export function renderPhasePrompt(runbook: ApplicationBuildRunbook, phase: XuPhase) {
  return [
    GENERATED_HEADER,
    `# Execute ${phase.id}: ${phase.title}`,
    "",
    agentPreamble(runbook, phase),
    "",
    `You are executing phase ${phase.id} from drylake.xu.`,
    "",
    "Do not skip approval gates.",
    "Do not modify files unless this phase requires it.",
    "Use the approved purpose, architecture, and constraints below.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose has not been confirmed.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture has not been approved.",
    "",
    "## Phase Objective",
    phase.objective || "No objective recorded.",
    "",
    "## Steps",
    numberedList(phase.steps),
    "",
    "## Acceptance Criteria",
    bulletList(phase.acceptance),
    "",
    "Return:",
    "1. proposed changes",
    "2. affected files",
    "3. risks",
    "4. verification plan",
  ].join("\n");
}

