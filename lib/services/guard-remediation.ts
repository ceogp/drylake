import { z } from "zod";

import { freePlanningModel } from "@/lib/services/ai-model-selection";
import { generateAiText } from "@/lib/services/ai-text";

const guardSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
const remediationPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
const safeDeveloperRankSchema = z.enum(["Scout", "Builder", "Operator", "Guardian", "Sentinel"]);
const jsonObjectSchema = z.record(z.string(), z.unknown());

const findingSchema = z.object({
  id: z.string().trim().min(1).max(500),
  category: z.string().trim().min(1).max(120),
  severity: guardSeveritySchema,
  title: z.string().trim().min(1).max(500),
  evidence: z.string().trim().min(1).max(2000),
  recommendation: z.string().trim().min(1).max(2000),
  source: z.string().trim().min(1).max(80).optional(),
  path: z.string().trim().min(1).max(1000).optional(),
  line: z.number().int().min(1).max(10_000_000).optional(),
}).strict();

const extensionSchema = z.object({
  id: z.string().trim().min(1).max(300),
  displayName: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(180),
  isActive: z.boolean(),
  accessLevel: z.enum(["low", "medium", "high"]),
  capabilityTags: z.array(z.string().trim().min(1).max(200)).max(24),
  riskFlags: z.array(z.string().trim().min(1).max(500)).max(24),
  accessSignals: z.array(z.string().trim().min(1).max(500)).max(24),
}).strict();

const secretSchema = z.object({
  path: z.string().trim().min(1).max(1000),
  line: z.number().int().min(1).max(10_000_000).optional(),
  type: z.string().trim().min(1).max(180),
  variableName: z.string().trim().min(1).max(240).optional(),
  severity: guardSeveritySchema,
}).strict();

const mcpServerSchema = z.object({
  configPath: z.string().trim().min(1).max(1000),
  name: z.string().trim().min(1).max(240),
  command: z.string().trim().min(1).max(240).optional(),
  envKeys: z.array(z.string().trim().min(1).max(240)).max(40),
  capabilities: z.array(z.string().trim().min(1).max(300)).max(40),
  riskFlags: z.array(z.string().trim().min(1).max(500)).max(40),
  severity: guardSeveritySchema,
  blastRadius: z.string().trim().min(1).max(1200),
}).strict();

const pathTypeSchema = z.object({
  path: z.string().trim().min(1).max(1000),
  type: z.string().trim().min(1).max(240),
}).strict();

const riskyPackageScriptSchema = z.object({
  path: z.string().trim().min(1).max(1000),
  name: z.string().trim().min(1).max(240),
  risk: z.string().trim().min(1).max(240),
}).strict();

const generatedFolderSchema = z.object({
  path: z.string().trim().min(1).max(1000),
  fileCount: z.number().int().min(0).max(10_000_000),
}).strict();

const workspaceSurfaceSchema = z.object({
  deploymentFiles: z.array(pathTypeSchema).max(80),
  iacFiles: z.array(pathTypeSchema).max(80),
  ciWorkflowFiles: z.array(pathTypeSchema).max(80),
  credentialLikeFiles: z.array(pathTypeSchema).max(80),
  riskyPackageScripts: z.array(riskyPackageScriptSchema).max(100),
  generatedFolders: z.array(generatedFolderSchema).max(60),
}).strict();

const connectionMapSchema = z.object({
  highRiskPaths: z.array(z.string().trim().min(1).max(1200)).max(80),
  edges: z.array(z.object({
    from: z.string().trim().min(1).max(500),
    to: z.string().trim().min(1).max(500),
    label: z.string().trim().min(1).max(240),
    severity: guardSeveritySchema,
  }).strict()).max(120),
}).strict();

export const guardFixPlanInputSchema = z.object({
  workspaceHash: z.string().trim().min(8).max(160).optional(),
  sourceClient: z.string().trim().min(1).max(40).default("vscode"),
  scan: z.object({
    scannedAt: z.string().datetime(),
    score: z.number().int().min(0).max(100),
    rank: safeDeveloperRankSchema,
    summary: jsonObjectSchema,
    categoryScores: jsonObjectSchema,
    findings: z.array(findingSchema).max(80),
    extensions: z.array(extensionSchema).max(60),
    secrets: z.array(secretSchema).max(120),
    mcpServers: z.array(mcpServerSchema).max(60),
    workspaceSurface: workspaceSurfaceSchema,
    connectionMap: connectionMapSchema,
  }).strict(),
}).strict();

export type GuardFixPlanInput = z.infer<typeof guardFixPlanInputSchema>;

export const guardFixPlanSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  actions: z.array(z.object({
    title: z.string().trim().min(1).max(220),
    priority: remediationPrioritySchema,
    category: z.string().trim().min(1).max(120),
    why: z.string().trim().min(1).max(1000),
    recommendation: z.string().trim().min(1).max(1200),
    files: z.array(z.string().trim().min(1).max(1000)).max(20),
    approvalRequired: z.boolean(),
  }).strict()).min(1).max(12),
  cautions: z.array(z.string().trim().min(1).max(800)).min(1).max(10),
  nextSteps: z.array(z.string().trim().min(1).max(800)).min(1).max(10),
}).strict();

export type GuardFixPlan = z.infer<typeof guardFixPlanSchema>;

const guardFixPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "actions", "cautions", "nextSteps"],
  properties: {
    summary: { type: "string" },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "priority", "category", "why", "recommendation", "files", "approvalRequired"],
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
          category: { type: "string" },
          why: { type: "string" },
          recommendation: { type: "string" },
          files: {
            type: "array",
            maxItems: 20,
            items: { type: "string" },
          },
          approvalRequired: { type: "boolean" },
        },
      },
    },
    cautions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "string" },
    },
    nextSteps: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "string" },
    },
  },
};

const systemPrompt = [
  "You are DryLake Guard Fix with AI.",
  "Create a practical security remediation plan from a redacted DryLake Guard scan.",
  "Use only the provided scan evidence. Do not invent file contents, secret values, tool permissions, cloud resources, or completed changes.",
  "Never ask for, repeat, infer, or output secret values. Secret variable names and file paths are allowed.",
  "Do not claim that you modified files. This endpoint generates a plan only. It does not write to the workspace.",
  "Prioritize agent blast radius, MCP/tool risk, exposed secret references, IDE bloat, token waste, and deploy/CI workspace surface.",
  "Every action must explain why it matters, what to change, which paths are involved when known, and whether explicit user approval is required.",
].join("\n");

function parseJsonObject(rawText: string) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const content = fenced ? fenced[1].trim() : trimmed;
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("DryLake Guard Fix with AI returned invalid JSON.");
  }

  return JSON.parse(content.slice(first, last + 1)) as unknown;
}

export async function generateGuardFixPlan(input: GuardFixPlanInput, options?: { model?: string }) {
  const model = options?.model ?? freePlanningModel();
  const rawText = await generateAiText({
    taskLabel: "Guard Fix with AI",
    model,
    systemPrompt,
    userPrompt: [
      "Create a DryLake Guard remediation plan for this redacted scan.",
      "Keep the response concise enough for an IDE panel but specific enough that a developer can act on it.",
      "Return JSON only.",
      JSON.stringify(input, null, 2),
    ].join("\n\n"),
    textFormat: {
      type: "json_schema",
      name: "DryLakeGuardFixPlan",
      schema: guardFixPlanJsonSchema,
      strict: true,
    },
  });

  return guardFixPlanSchema.parse(parseJsonObject(rawText));
}
