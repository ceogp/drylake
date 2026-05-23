import { z } from "zod";

import { generateAiText } from "@/lib/services/ai-text";

export const runnerAssignmentPlanningInputSchema = z.object({
  taskPrompt: z.string().trim().min(1),
  agents: z
    .array(
      z.object({
        agentId: z.string().trim().min(1),
        label: z.string().trim().min(1),
      }),
    )
    .min(1),
});

const runnerAssignmentSchema = z.object({
  agentId: z.string().trim().min(1),
  subtaskSummary: z.string().trim().min(1),
  scopeBoundary: z.string().trim().min(1),
});

const runnerAssignmentPlanningOutputSchema = z.object({
  assignments: z.array(runnerAssignmentSchema).min(1),
});

export type RunnerAssignmentPlanningInput = z.infer<typeof runnerAssignmentPlanningInputSchema>;
export type RunnerAssignment = z.infer<typeof runnerAssignmentSchema>;

type RunnerAssignmentPlanningOptions = {
  model?: string;
};

const RUNNER_ASSIGNMENT_SYSTEM_PROMPT = [
  "You plan DryLake Multi-Agent Runner assignments.",
  "Return only JSON with an assignments array.",
  "Create exactly one assignment per selected agent.",
  "Each assignment must have a non-overlapping scopeBoundary declared as a phase, file area, or feature slice.",
  "Do not assign two agents to the same files, phase, or feature slice.",
].join(" ");

function stripJsonFences(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

function parseAssignments(raw: string, input: RunnerAssignmentPlanningInput) {
  const parsedJson = JSON.parse(stripJsonFences(raw)) as unknown;
  const parsed = runnerAssignmentPlanningOutputSchema.parse(parsedJson);
  const expectedAgentIds = new Set(input.agents.map((agent) => agent.agentId));
  const seenAgentIds = new Set<string>();

  for (const assignment of parsed.assignments) {
    if (!expectedAgentIds.has(assignment.agentId)) {
      throw new Error(`Xupra AI returned an assignment for unknown agent ${assignment.agentId}.`);
    }

    if (seenAgentIds.has(assignment.agentId)) {
      throw new Error(`Xupra AI returned more than one assignment for ${assignment.agentId}.`);
    }

    seenAgentIds.add(assignment.agentId);
  }

  const missing = input.agents.filter((agent) => !seenAgentIds.has(agent.agentId));
  if (missing.length > 0) {
    throw new Error(`Xupra AI did not return assignments for: ${missing.map((agent) => agent.label).join(", ")}.`);
  }

  return {
    assignments: input.agents.map((agent) => {
      const assignment = parsed.assignments.find((item) => item.agentId === agent.agentId);
      if (!assignment) {
        throw new Error(`Xupra AI did not return an assignment for ${agent.label}.`);
      }
      return assignment;
    }),
  };
}

export async function planRunnerAssignments(
  input: RunnerAssignmentPlanningInput,
  options: RunnerAssignmentPlanningOptions = {},
) {
  const agentLines = input.agents
    .map((agent) => `- ${agent.agentId}: ${agent.label}`)
    .join("\n");

  const userPrompt = [
    "Top-level task:",
    input.taskPrompt,
    "",
    "Selected agents:",
    agentLines,
    "",
    "Return JSON in this exact shape:",
    '{ "assignments": [{ "agentId": "selected-agent-id", "subtaskSummary": "one focused task", "scopeBoundary": "distinct phase, file area, or feature slice" }] }',
    "",
    "Rules:",
    "- Include every selected agent exactly once.",
    "- Make subtask summaries actionable for an autonomous coding agent.",
    "- Scope boundaries must be distinct and specific enough to prevent workspace conflicts.",
    "- Do not include prose outside the JSON object.",
  ].join("\n");

  const content = await generateAiText({
    systemPrompt: RUNNER_ASSIGNMENT_SYSTEM_PROMPT,
    userPrompt,
    taskLabel: "runner assignment planning",
    model: options.model,
  });

  return parseAssignments(content, input);
}
