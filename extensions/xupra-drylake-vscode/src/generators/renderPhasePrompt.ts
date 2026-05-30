import { GENERATED_HEADER, bulletList, numberedList } from "./common";
import { renderHandoffProfilePrompt } from "../agents/handoffProfiles";
import type { HandoffProfileSelection } from "../agents/handoffProfiles";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ApplicationBuildRunbook, BuildSessionState, XuPhase, XuPhaseAgent } from "../xu/types";

const AGENT_PREAMBLES: Record<XuPhaseAgent, string> = {
  "claude-code": "You are running as Claude Code. Use the bash tool for file operations.",
  codex: "You are running as OpenAI Codex. Output shell commands and file patches.",
  gemini: "You are running as Gemini CLI. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  hermes: "You are running as Hermes Agent CLI. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  cursor: "You are running as Cursor CLI. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  copilot: "You are running as GitHub Copilot Chat. Use chat handoff context to guide the next coding step.",
};

const PROVIDER_PREAMBLES: Record<BuildSessionState["providerId"], string> = {
  "xupra-pro-ai": "Use the active DryLake build-session provider: Xupra AI.",
  "databricks-api": "Use the active DryLake build-session provider: Databricks API.",
  "claude-api": "Use the active DryLake build-session provider: Claude API.",
  "openai-api": "Use the active DryLake build-session provider: OpenAI API.",
  "hermes-agent": "Use the active DryLake build-session provider: Hermes Agent CLI.",
  "user-ide-ai": "Use the active DryLake build-session provider: User IDE AI.",
  "external-ai-prompt": "Copy this prompt into your preferred AI tool.",
};

type RenderPhasePromptOptions = {
  activeProvider?: Pick<BuildSessionState, "providerId" | "providerLabel"> | null;
  handoffProfile?: HandoffProfileSelection;
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
    renderHandoffProfilePrompt(options.handoffProfile),
    `You are executing phase ${phase.id} from drylake.xu.`,
    "",
    "The user clicked Run Handoff. Treat that click as approval to execute this phase now.",
    "If the runbook says explicit approval is required before execution, this Run Handoff invocation satisfies that approval for this phase's local execution.",
    "Do not stop for another planning approval before local, phase-scoped edits or non-destructive validation commands.",
    "Run the commands, file reads, file patches, and tests needed to satisfy this phase.",
    "Stop and ask only before irreversible external changes, billing-impacting cloud operations, credential creation/rotation, destructive filesystem actions, or provisioning commands unless userApprovedProvisioning is true.",
    "Keep changes limited to this phase objective and acceptance criteria.",
    "Work through the phase steps in order.",
    "Use the approved purpose, architecture, and constraints below.",
    "",
    "## Approval State",
    `- Intent approved: ${runbook.confirmation.userApprovedIntent ? "yes" : "no"}`,
    `- Architecture approved: ${runbook.confirmation.userApprovedArchitecture ? "yes" : "no"}`,
    `- Provisioning approved: ${runbook.confirmation.userApprovedProvisioning ? "yes" : "no"}`,
    `- Provisioning auto-execution allowed: ${runbook.provisioning.safety.executeAutomatically ? "yes" : "no"}`,
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
    "## Architecture Decisions",
    numberedList(runbook.architecture.decisions.map((decision) => `${decision.choice}: ${decision.rationale}`)),
    "",
    "## Architecture Risks",
    bulletList(runbook.architecture.risks),
    "",
    "## Architecture Assumptions",
    bulletList(runbook.architecture.assumptions),
    "",
    "## Phase Objective",
    phase.objective || "No objective recorded.",
    "",
    "## Phase Inputs",
    bulletList(phase.inputs),
    "",
    "## Phase Outputs",
    bulletList(phase.outputs),
    "",
    "## Steps",
    numberedList(phase.steps.map((step) => step.text)),
    "",
    "## Acceptance Criteria",
    bulletList(phase.acceptance),
    "",
    "Return:",
    "1. summary of work completed",
    "2. affected files",
    "3. commands/tests run and results",
    "4. risks or blockers, if any",
  ].join("\n");
}

