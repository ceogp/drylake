import { z } from "zod";

import { generateAiText } from "@/lib/services/ai-text";

export const runbookGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  workspaceSummary: z.string().trim().min(1),
  currentRunbook: z.record(z.string(), z.unknown()).optional(),
});

export type RunbookGenerationInput = z.infer<typeof runbookGenerationInputSchema>;

const RUNBOOK_SYSTEM_PROMPT = [
  "You are generating a DryLake .xu runbook.",
  "Return only YAML.",
  "Do not wrap the response in Markdown fences.",
].join(" ");

export function buildRunbookDraftPrompt(input: RunbookGenerationInput) {
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
    "phase.agent optional enum: claude-code, codex, cursor, copilot, external-ai-prompt",
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

export function refineRunbookPurposePrompt(input: RunbookGenerationInput) {
  return `${buildRunbookDraftPrompt(input)}\n\nFocus this revision on purpose, users, goals, non-goals, and constraints.`;
}

export function refineRunbookArchitecturePrompt(input: RunbookGenerationInput) {
  return `${buildRunbookDraftPrompt(input)}\n\nFocus this revision on architecture summary, decisions, risks, assumptions, and provisioning preview.`;
}

export function generateRunbookPhasePlanPrompt(input: RunbookGenerationInput) {
  return `${buildRunbookDraftPrompt(input)}\n\nFocus this revision on phase-by-phase execution planning and acceptance criteria.`;
}

export async function generateRunbookContent(params: {
  input: RunbookGenerationInput;
  taskLabel: string;
  buildPrompt: (input: RunbookGenerationInput) => string;
}) {
  const content = await generateAiText({
    systemPrompt: RUNBOOK_SYSTEM_PROMPT,
    userPrompt: params.buildPrompt(params.input),
    taskLabel: params.taskLabel,
  });

  return { content };
}