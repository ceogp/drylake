import type { GenerateDraftRunbookInput } from "../DryLakeAiProvider";

const PHASE_COUNT_INSTRUCTION =
  "phases: determine the correct number of phases for this specific task. Simple tasks may need 3 phases. Complex tasks may need 8 or more. Do not default to 5. Each phase must be meaningful and non-redundant.";

function requestedStageInstruction(input: GenerateDraftRunbookInput) {
  return typeof input.requestedStageCount === "number"
    ? `User selected exactly ${input.requestedStageCount} planning steps in DryLake. Generate exactly ${input.requestedStageCount} phases.`
    : "If the user asks for a specific number of planning steps in natural language, honor that number when it is between 1 and 12.";
}

export function buildDraftRunbookPrompt(input: GenerateDraftRunbookInput) {
  return [
    "You are generating a DryLake .xu runbook.",
    "Return only YAML. Do not wrap it in Markdown fences.",
    "",
    "Required YAML contract:",
    "xu: 1",
    "kind: ApplicationBuildRunbook",
    "metadata.name: kebab-case project name",
    "metadata.status: draft",
    "intent.rawPrompt, intent.purpose, intent.users, intent.goals, intent.nonGoals, intent.constraints",
    "confirmation.required: true",
    "confirmation.status: pending",
    "confirmation.userApprovedIntent: false",
    "confirmation.userApprovedArchitecture: false",
    "confirmation.userApprovedProvisioning: false",
    "architecture.status: proposed",
    "architecture.summary, architecture.decisions, architecture.risks, architecture.assumptions",
    "provisioning.status: draft",
    "provisioning.commands, provisioning.filesToCreate, provisioning.environmentVariables, provisioning.externalServices",
    "provisioning.safety.requiresApprovalBeforeExecution: true",
    "provisioning.safety.executeAutomatically: false",
    PHASE_COUNT_INSTRUCTION,
    requestedStageInstruction(input),
    "each phase must include id, title, optional agent, gate, status, objective, inputs, outputs, steps, acceptance",
    "phase.agent optional enum: claude-code, codex, gemini, hermes, cursor, copilot, blackbox, goose, opencode, qwen, continue, cline, aider, kilo, auggie",
    "",
    `Mode: ${input.mode}`,
    "",
    "User prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available.",
  ].join("\n");
}

