import { GENERATED_HEADER, bulletList, numberedList } from "./common";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ApplicationBuildRunbook, BuildSessionState, XuPhase, XuPhaseAgent } from "../xu/types";

const AGENT_PREAMBLES: Record<XuPhaseAgent, string> = {
  "claude-code": "You are running as Claude Code. Use the bash tool for file operations.",
  codex: "You are running as OpenAI Codex. Output shell commands and file patches.",
  gemini: "You are running as Gemini CLI. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  cursor: "You are running as Cursor CLI. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  copilot: "You are running as GitHub Copilot Chat. Use chat handoff context to guide the next coding step.",
};

const PROVIDER_PREAMBLES: Record<BuildSessionState["providerId"], string> = {
  "xupra-pro-ai": "Use the active DryLake build-session provider: Xupra AI.",
  "user-ide-ai": "Use the active DryLake build-session provider: User IDE AI.",
  "external-ai-prompt": "Copy this prompt into your preferred AI tool.",
};

type RenderPhasePromptOptions = {
  activeProvider?: Pick<BuildSessionState, "providerId" | "providerLabel"> | null;
};

function normalizeAgent(value: unknown): XuPhaseAgent | undefined {
  return typeof value === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(value)
    ? (value as XuPhaseAgent)
    : undefined;
}

function providerPreamble(activeProvider: RenderPhasePromptOptions["activeProvider"]) {
  if (!activeProvider) {
    return undefined;
  }

  return PROVIDER_PREAMBLES[activeProvider.providerId] ?? `Use the active DryLake build-session provider: ${activeProvider.providerLabel}.`;
}

function agentPreamble(runbook: ApplicationBuildRunbook, phase: XuPhase, options: RenderPhasePromptOptions) {
  const agent = phase.agent;

  if (agent) {
    return AGENT_PREAMBLES[agent];
  }

  const activeProviderPreamble = providerPreamble(options.activeProvider);
  if (activeProviderPreamble) {
    return activeProviderPreamble;
  }

  const defaultAgent = normalizeAgent(runbook.handoff.defaultAgent);
  if (defaultAgent) {
    return AGENT_PREAMBLES[defaultAgent];
  }

  return `Use the configured DryLake AI provider: ${runbook.handoff.defaultAgent || "session default"}.`;
}

export function renderPhasePrompt(runbook: ApplicationBuildRunbook, phase: XuPhase, options: RenderPhasePromptOptions = {}) {
  return [
    GENERATED_HEADER,
    `# Execute ${phase.id}: ${phase.title}`,
    "",
    agentPreamble(runbook, phase, options),
    "",
    `You are executing phase ${phase.id} from drylake.xu.`,
    "",
    "Do not skip approval gates.",
    "Do not modify files unless this phase requires it.",
    "Work through the phase steps in the listed order.",
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
    numberedList(phase.steps.map((step) => step.text)),
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

