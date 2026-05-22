import type { GenerateDraftRunbookInput } from "../DryLakeAiProvider";

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
    "phases: at least five phases with id, title, optional agent, gate, status, objective, inputs, outputs, steps, acceptance",
    "phase.agent optional enum: claude-code, codex, gemini, cursor, cline, continue, aider, copilot, augment-code",
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

