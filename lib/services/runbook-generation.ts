import { dump, load } from "js-yaml";
import { z } from "zod";

import { generateAiText } from "@/lib/services/ai-text";

export const runbookGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  workspaceSummary: z.string().trim().min(1),
  currentRunbook: z.object({}).catchall(z.unknown()).optional(),
});

export const runbookClarifyInputSchema = z.object({
  prompt: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  workspaceSummary: z.string().trim().min(1),
});

export const runbookPlanningChatInputSchema = runbookGenerationInputSchema.extend({
  chatTranscript: z.string().trim().min(1),
});

export type RunbookClarifyInput = z.infer<typeof runbookClarifyInputSchema>;

export type RunbookGenerationInput = z.infer<typeof runbookGenerationInputSchema>;

export type RunbookPlanningChatInput = z.infer<typeof runbookPlanningChatInputSchema>;

type RunbookGenerationOptions = {
  model?: string;
};

const RUNBOOK_SYSTEM_PROMPT = [
  "You are generating a DryLake .xu runbook.",
  "Return only YAML.",
  "Do not wrap the response in Markdown fences.",
].join(" ");

const RUNBOOK_PHASE_COUNT_INSTRUCTION =
  "phases: determine the correct number of phases for this specific task. Simple tasks may need 3 phases. Complex tasks may need 8 or more. Do not default to 5. Each phase must be meaningful and non-redundant.";

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;

const runbookJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "xu",
    "kind",
    "metadata",
    "intent",
    "confirmation",
    "architecture",
    "provisioning",
    "phases",
    "checks",
    "agentTargets",
    "handoff",
  ],
  properties: {
    xu: { type: "number", enum: [1] },
    kind: { type: "string", enum: ["ApplicationBuildRunbook"] },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["name", "owner", "status", "mode"],
      properties: {
        name: { type: "string" },
        owner: { type: "string" },
        status: { type: "string", enum: ["draft"] },
        mode: { type: "string", enum: ["build-app", "phases", "plan", "review"] },
      },
    },
    intent: {
      type: "object",
      additionalProperties: false,
      required: ["rawPrompt", "purpose", "users", "goals", "nonGoals", "constraints"],
      properties: {
        rawPrompt: { type: "string" },
        purpose: { type: "string" },
        users: stringArraySchema,
        goals: stringArraySchema,
        nonGoals: stringArraySchema,
        constraints: stringArraySchema,
      },
    },
    confirmation: {
      type: "object",
      additionalProperties: false,
      required: [
        "required",
        "status",
        "userApprovedIntent",
        "userApprovedArchitecture",
        "userApprovedProvisioning",
      ],
      properties: {
        required: { type: "boolean" },
        status: { type: "string", enum: ["pending"] },
        userApprovedIntent: { type: "boolean" },
        userApprovedArchitecture: { type: "boolean" },
        userApprovedProvisioning: { type: "boolean" },
      },
    },
    architecture: {
      type: "object",
      additionalProperties: false,
      required: ["status", "summary", "decisions", "risks", "assumptions"],
      properties: {
        status: { type: "string", enum: ["proposed"] },
        summary: { type: "string" },
        decisions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "choice", "rationale"],
            properties: {
              id: { type: "string" },
              choice: { type: "string" },
              rationale: { type: "string" },
            },
          },
        },
        risks: stringArraySchema,
        assumptions: stringArraySchema,
      },
    },
    provisioning: {
      type: "object",
      additionalProperties: false,
      required: ["status", "commands", "filesToCreate", "environmentVariables", "externalServices", "safety"],
      properties: {
        status: { type: "string", enum: ["draft"] },
        commands: stringArraySchema,
        filesToCreate: stringArraySchema,
        environmentVariables: stringArraySchema,
        externalServices: stringArraySchema,
        safety: {
          type: "object",
          additionalProperties: false,
          required: ["requiresApprovalBeforeExecution", "executeAutomatically"],
          properties: {
            requiresApprovalBeforeExecution: { type: "boolean" },
            executeAutomatically: { type: "boolean", enum: [false] },
          },
        },
      },
    },
    phases: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "agent", "gate", "status", "objective", "inputs", "outputs", "steps", "acceptance"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          agent: { type: ["string", "null"], enum: ["claude-code", "codex", "gemini", "hermes", "cursor", "copilot", null] },
          gate: { type: "string" },
          status: { type: "string", enum: ["pending", "active", "approved", "needs-revision", "complete"] },
          objective: { type: "string" },
          inputs: stringArraySchema,
          outputs: stringArraySchema,
          steps: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text", "status"],
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                status: { type: "string", enum: ["pending", "active", "approved", "needs-revision", "complete"] },
              },
            },
          },
          acceptance: stringArraySchema,
        },
      },
    },
    checks: {
      type: "object",
      additionalProperties: false,
      required: ["install", "dev", "build", "test", "lint"],
      properties: {
        install: { type: "string" },
        dev: { type: "string" },
        build: { type: "string" },
        test: { type: "string" },
        lint: { type: "string" },
      },
    },
    agentTargets: {
      type: "object",
      additionalProperties: false,
      required: ["agentsMd", "claudeMd", "copilotInstructions", "cursorRules", "codexSkill", "openclawSkill"],
      properties: {
        agentsMd: { type: "boolean" },
        claudeMd: { type: "boolean" },
        copilotInstructions: { type: "boolean" },
        cursorRules: { type: "boolean" },
        codexSkill: { type: "boolean" },
        openclawSkill: { type: "boolean" },
      },
    },
    handoff: {
      type: "object",
      additionalProperties: false,
      required: ["defaultAgent", "autopilot", "instructions"],
      properties: {
        defaultAgent: { type: "string" },
        autopilot: { type: "boolean" },
        instructions: stringArraySchema,
      },
    },
  },
} satisfies Record<string, unknown>;

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
    RUNBOOK_PHASE_COUNT_INSTRUCTION,
    "each phase must include id, title, optional agent, gate, status, objective, inputs, outputs, steps, acceptance",
    "phase.agent optional enum: claude-code, codex, gemini, cursor, aider, copilot, augment-code",
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
  model?: string;
}) {
  const content = await generateAiText({
    systemPrompt: RUNBOOK_SYSTEM_PROMPT,
    userPrompt: params.prompt,
    taskLabel: params.taskLabel,
    model: params.model,
    textFormat: {
      type: "json_schema",
      name: "drylake_runbook",
      schema: runbookJsonSchema,
      strict: true,
    },
  });

  try {
    return { content: dump(JSON.parse(content), { sortKeys: false, noRefs: true, lineWidth: 120 }) };
  } catch {
    return { content };
  }
}

export async function buildRunbookDraftPrompt(input: RunbookGenerationInput, options: RunbookGenerationOptions = {}) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook draft",
    model: options.model,
    prompt: [
      basePromptSections(input),
      "",
      "Create a complete draft runbook that is immediately usable by the DryLake parser and generators.",
      "Include realistic checks, agentTargets, and handoff instructions.",
      "Do not omit owner, checks, agentTargets, or handoff.",
    ].join("\n"),
  });
}

export async function refineRunbookPurposePrompt(input: RunbookGenerationInput, options: RunbookGenerationOptions = {}) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook purpose refinement",
    model: options.model,
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

export async function refineRunbookArchitecturePrompt(input: RunbookGenerationInput, options: RunbookGenerationOptions = {}) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook architecture refinement",
    model: options.model,
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

export async function generateRunbookPhasePlanPrompt(input: RunbookGenerationInput, options: RunbookGenerationOptions = {}) {
  return generateRunbookYaml({
    input,
    taskLabel: "runbook phase plan",
    model: options.model,
    prompt: [
      basePromptSections(input),
      "",
      "Revise the current runbook.",
      "Use the provided current runbook document as the source of truth when it is present; keep prior approved sections unless the new request requires a change.",
      "Focus this revision on phase-by-phase execution planning and acceptance criteria.",
      RUNBOOK_PHASE_COUNT_INSTRUCTION,
      "Ensure every phase has gate, status, objective, inputs, outputs, steps, and acceptance.",
      "Keep checks, agentTargets, and handoff aligned with the execution plan.",
    ].join("\n"),
  });
}

const CLARIFY_SYSTEM_PROMPT = [
  "You help scope a DryLake build session.",
  "Return between 2 and 4 short clarifying questions about the user's prompt.",
  "Return only a JSON array of strings. No prose, no Markdown fences.",
].join(" ");

function parseClarifyQuestions(raw: string): string[] {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const questions = parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
      return questions.slice(0, 4);
    }
  } catch {
    // fall through to line-based parsing
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, 4);
}

export async function clarifyRunbookIntent(input: RunbookClarifyInput, options: RunbookGenerationOptions = {}) {
  const userPrompt = [
    `Mode: ${input.mode}`,
    "",
    "User prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available.",
    "",
    "Return 2 to 4 short clarifying questions as a JSON array of strings.",
  ].join("\n");

  const content = await generateAiText({
    systemPrompt: CLARIFY_SYSTEM_PROMPT,
    userPrompt,
    taskLabel: "runbook clarifying questions",
    model: options.model,
  });

  return { questions: parseClarifyQuestions(content) };
}

const PLANNING_CHAT_SYSTEM_PROMPT = [
  "You are Xupra AI inside DryLake Planning Chat.",
  "Users are talking directly to the planning LLM.",
  "Return a JSON object with a reply string.",
  "Answer the user's latest planning-chat message directly and concisely in reply.",
  "When the user requests a concrete plan change and you can produce a complete updated .xu plan, include proposedRunbook as an ApplicationBuildRunbook object.",
  "If the user asks what you are, identify yourself as Xupra AI.",
  "Do not claim the runbook changed unless you explicitly describe a planning change that should be applied next.",
].join(" ");

function stripMarkdownFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json|yaml|yml|xu)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseProposedRunbook(value: unknown) {
  let candidate = value;

  if (typeof value === "string") {
    try {
      candidate = load(stripMarkdownFence(value));
    } catch {
      return undefined;
    }
  }

  if (
    isRecord(candidate) &&
    candidate.kind === "ApplicationBuildRunbook" &&
    Array.isArray(candidate.phases)
  ) {
    return candidate;
  }

  return undefined;
}

function parsePlanningChatReply(raw: string) {
  const trimmed = stripMarkdownFence(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    try {
      parsed = load(trimmed);
    } catch {
      parsed = undefined;
    }
  }

  if (isRecord(parsed) && typeof parsed.reply === "string" && parsed.reply.trim().length > 0) {
    const proposedRunbook = parseProposedRunbook(parsed.proposedRunbook);
    return proposedRunbook
      ? { reply: parsed.reply.trim(), proposedRunbook }
      : { reply: parsed.reply.trim() };
  }

  // Plain text is still accepted for compatibility with existing prompts and providers.
  return { reply: raw.trim() };
}

export async function generatePlanningChatReply(input: RunbookPlanningChatInput, options: RunbookGenerationOptions = {}) {
  const userPrompt = [
    `Mode: ${input.mode}`,
    "",
    "Original build-session prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available.",
    "",
    "Current runbook context:",
    serializeCurrentRunbook(input.currentRunbook),
    "",
    "Planning chat transcript:",
    input.chatTranscript,
  ].join("\n");

  const reply = await generateAiText({
    systemPrompt: PLANNING_CHAT_SYSTEM_PROMPT,
    userPrompt,
    taskLabel: "planning chat",
    model: options.model,
  });

  return parsePlanningChatReply(reply);
}
