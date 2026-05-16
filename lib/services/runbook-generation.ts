import { dump } from "js-yaml";
import { z } from "zod";

import { generateAiText } from "@/lib/services/ai-text";

export const runbookGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  workspaceSummary: z.string().trim().min(1),
  currentRunbook: z.object({}).catchall(z.unknown()).optional(),
});

export type RunbookGenerationInput = z.infer<typeof runbookGenerationInputSchema>;

const RUNBOOK_SYSTEM_PROMPT = [
  "You are generating a DryLake .xu runbook.",
  "Return only YAML.",
  "Do not wrap the response in Markdown fences.",
].join(" ");

function runbookContractLines() {
  return [
    "Required YAML contract:",
    "xu: 1",
    "kind: ApplicationBuildRunbook",
    "metadata.name: kebab-case project name",
    "metadata.owner: owning editor, team, or workflow label",
    "metadata.status: draft",
    "metadata.mode: build-app | phases | plan | review",
    "intent.rawPrompt, intent.purpose, intent.users, intent.goals, intent.nonGoals, intent.constraints",
    "confirmation.required: true",
    "confirmation.status: pending",
    "confirmation.userApprovedIntent: false",
    "confirmation.userApprovedArchitecture: false",
    "confirmation.userApprovedProvisioning: false",
    "architecture.status: proposed",
    "architecture.summary, architecture.decisions[{ id, choice, rationale }], architecture.risks, architecture.assumptions",
    "provisioning.status: draft",
    "provisioning.commands, provisioning.filesToCreate, provisioning.environmentVariables, provisioning.externalServices",
    "provisioning.safety.requiresApprovalBeforeExecution: true",
    "provisioning.safety.executeAutomatically: false",
    "phases: at least five phases",
    "each phase must include id, title, optional agent, gate, status, objective, inputs, outputs, steps, acceptance",
    "phase.agent optional enum: claude-code, codex, cursor, copilot, external-ai-prompt",
    "checks.install, checks.dev, checks.build, checks.test, checks.lint",
    "agentTargets.agentsMd, agentTargets.claudeMd, agentTargets.copilotInstructions, agentTargets.cursorRules, agentTargets.codexSkill, agentTargets.openclawSkill",
    "handoff.defaultAgent, handoff.instructions",
  ];
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableJsonValue(child)]),
  );
}

function serializeCurrentRunbook(currentRunbook: RunbookGenerationInput["currentRunbook"]) {
  if (!currentRunbook) {
    return "No current runbook provided.";
  }

  try {
    return dump(stableJsonValue(currentRunbook), {
      sortKeys: true,
      noRefs: true,
      lineWidth: 120,
    }).trim();
  } catch {
    try {
      return JSON.stringify(stableJsonValue(currentRunbook), null, 2);
    } catch {
      return "Current runbook provided but could not be serialized. Preserve any existing approved structure when revising.";
    }
  }
}

function basePromptSections(input: RunbookGenerationInput) {
  return [
    "You are generating a DryLake .xu runbook.",
    "Return only YAML. Do not wrap it in Markdown fences.",
    "",
    ...runbookContractLines(),
    "",
    `Mode: ${input.mode}`,
    "",
    "User prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available.",
    "",
    "Current runbook context to preserve and revise when present:",
    serializeCurrentRunbook(input.currentRunbook),
  ].join("\n");
}

async function generateRunbookYaml(params: {
  input: RunbookGenerationInput;
  taskLabel: string;
  prompt: string;
}) {
  const content = await generateAiText({
    systemPrompt: RUNBOOK_SYSTEM_PROMPT,
    userPrompt: params.prompt,
    taskLabel: params.taskLabel,
  });

  return { content };
}

export async function buildRunbookDraftPrompt(input: RunbookGenerationInput) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook draft",
    prompt: [
      basePromptSections(input),
      "",
      "Create a complete draft runbook that is immediately usable by the DryLake parser and generators.",
      "Include realistic checks, agentTargets, and handoff instructions.",
      "Do not omit owner, checks, agentTargets, or handoff.",
    ].join("\n"),
  });
}

export async function refineRunbookPurposePrompt(input: RunbookGenerationInput) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook purpose refinement",
    prompt: [
      basePromptSections(input),
      "",
      "Revise the current runbook.",
      "Use the provided current runbook document as the source of truth when it is present; do not regenerate a fresh unrelated runbook.",
      "Focus this revision on intent.purpose, intent.users, intent.goals, intent.nonGoals, and intent.constraints.",
      "Preserve architecture, provisioning, phases, checks, agentTargets, and handoff unless the user prompt clearly requires changes.",
    ].join("\n"),
  });
}

export async function refineRunbookArchitecturePrompt(input: RunbookGenerationInput) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook architecture refinement",
    prompt: [
      basePromptSections(input),
      "",
      "Revise the current runbook.",
      "Use the provided current runbook document as the source of truth when it is present; keep unchanged sections stable.",
      "Focus this revision on architecture.summary, architecture.decisions, architecture.risks, architecture.assumptions, and provisioning readiness.",
      "Keep approval gates explicit and preserve intent, phases, checks, agentTargets, and handoff unless the user prompt requires updates.",
    ].join("\n"),
  });
}

export async function generateRunbookPhasePlanPrompt(input: RunbookGenerationInput) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook phase plan",
    prompt: [
      basePromptSections(input),
      "",
      "Revise the current runbook.",
      "Use the provided current runbook document as the source of truth when it is present; keep prior approved sections unless the new request requires a change.",
      "Focus this revision on phase-by-phase execution planning and acceptance criteria.",
      "Ensure there are at least five phases and every phase has gate, status, objective, inputs, outputs, steps, and acceptance.",
      "Keep checks, agentTargets, and handoff aligned with the execution plan.",
    ].join("\n"),
  });
}