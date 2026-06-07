import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateAiText } from "@/lib/services/ai-text";
import { freePlanningModel } from "@/lib/services/ai-model-selection";

const TRIAL_CREDITS = 3;
const TRIAL_EXPIRES_IN_HOURS = 72;
const TRIAL_REGISTRATION_LIMIT_PER_HOUR = 20;

export const AGENT_TOKEN_SCOPES = [
  "preflight:create",
  "plan:read",
  "phase:read",
  "handoff:create",
  "tokens:estimate",
  "phase:update",
] as const;

const SOURCE_CLIENTS = [
  "cursor",
  "vscode",
  "claude_code",
  "codex",
  "copilot",
  "gemini",
  "mcp",
  "a2a",
  "unknown",
] as const;

export const agentRegistrationInputSchema = z.object({
  agent_name: z.string().trim().min(1).max(120).optional(),
  source_client: z.enum(SOURCE_CLIENTS).default("unknown"),
}).strict();

export const preflightInputSchema = z.object({
  task: z.string().trim().min(1).max(20_000),
  target_agent: z.string().trim().min(1).max(80).optional(),
  source_client: z.enum(SOURCE_CLIENTS).default("unknown"),
  tier: z.enum(["basic", "validated"]).default("basic"),
  repo_summary: z.string().trim().max(10_000).optional(),
}).strict();

export type AgentRegistrationInput = z.infer<typeof agentRegistrationInputSchema>;
export type PreflightInput = z.infer<typeof preflightInputSchema>;

const phaseSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(140),
  objective: z.string().min(1).max(800),
  steps: z.array(z.string().min(1).max(500)).min(2).max(8),
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(8),
  risks: z.array(z.string().min(1).max(500)).max(6),
}).strict();

const preflightOutputSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1000),
  phases: z.array(phaseSchema).min(2).max(12),
  token_budget: z.object({
    estimated_original_tokens: z.number().int().min(1),
    estimated_handoff_tokens: z.number().int().min(1),
    compression_ratio: z.number().min(0).max(1),
  }).strict(),
  next_phase_contract: z.object({
    phase_id: z.string().min(1).max(40),
    objective: z.string().min(1).max(800),
    allowed_scope: z.array(z.string().min(1).max(500)).min(1).max(8),
    exit_criteria: z.array(z.string().min(1).max(500)).min(1).max(8),
  }).strict(),
  handoff: z.object({
    target_agent: z.string().min(1).max(80),
    prompt: z.string().min(1).max(12_000),
  }).strict(),
  assurance: z.object({
    risk_classification: z.enum(["low", "medium", "high"]),
    test_checklist: z.array(z.string().min(1).max(500)).min(1).max(10),
    rollback_plan: z.array(z.string().min(1).max(500)).min(1).max(10),
    dependency_impact_review: z.array(z.string().min(1).max(500)).min(1).max(10),
    validation_phase: z.object({
      objective: z.string().min(1).max(800),
      steps: z.array(z.string().min(1).max(500)).min(1).max(8),
    }).strict(),
  }).strict().nullable(),
}).strict();

export type PreflightOutput = z.infer<typeof preflightOutputSchema>;

export class AgentPreflightError extends Error {
  constructor(
    public readonly code:
      | "rate_limited"
      | "agent_token_missing"
      | "agent_token_invalid"
      | "agent_token_expired"
      | "payment_required",
    message: string,
  ) {
    super(message);
  }
}

const preflightJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "phases",
    "token_budget",
    "next_phase_contract",
    "handoff",
    "assurance",
  ],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    phases: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "objective", "steps", "acceptance", "risks"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          objective: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          acceptance: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
        },
      },
    },
    token_budget: {
      type: "object",
      additionalProperties: false,
      required: ["estimated_original_tokens", "estimated_handoff_tokens", "compression_ratio"],
      properties: {
        estimated_original_tokens: { type: "integer" },
        estimated_handoff_tokens: { type: "integer" },
        compression_ratio: { type: "number" },
      },
    },
    next_phase_contract: {
      type: "object",
      additionalProperties: false,
      required: ["phase_id", "objective", "allowed_scope", "exit_criteria"],
      properties: {
        phase_id: { type: "string" },
        objective: { type: "string" },
        allowed_scope: { type: "array", items: { type: "string" } },
        exit_criteria: { type: "array", items: { type: "string" } },
      },
    },
    handoff: {
      type: "object",
      additionalProperties: false,
      required: ["target_agent", "prompt"],
      properties: {
        target_agent: { type: "string" },
        prompt: { type: "string" },
      },
    },
    assurance: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "risk_classification",
            "test_checklist",
            "rollback_plan",
            "dependency_impact_review",
            "validation_phase",
          ],
          properties: {
            risk_classification: { type: "string", enum: ["low", "medium", "high"] },
            test_checklist: { type: "array", items: { type: "string" } },
            rollback_plan: { type: "array", items: { type: "string" } },
            dependency_impact_review: { type: "array", items: { type: "string" } },
            validation_phase: {
              type: "object",
              additionalProperties: false,
              required: ["objective", "steps"],
              properties: {
                objective: { type: "string" },
                steps: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      ],
    },
  },
} as const;

function randomSegment(byteLength = 18) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function tokenHash(token: string) {
  return sha256(`drylake-agent-token:${token}`);
}

function taskHash(task: string) {
  return sha256(`drylake-preflight-task:${task}`);
}

function ipHash(ip: string | null | undefined) {
  const normalized = ip?.trim();
  if (!normalized) {
    return null;
  }

  return sha256(`drylake-agent-registration:${env.APP_ENCRYPTION_KEY}:${normalized}`);
}

function buyCreditsUrl(agentId: string) {
  return `${env.APP_BASE_URL}/agent-billing/${encodeURIComponent(agentId)}`;
}

export function getAgentRegisterUrl() {
  return `${env.APP_BASE_URL}/drylake/mcp`;
}

export function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

export function estimatePreflightTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function preflightCreditCost(tier: PreflightInput["tier"]) {
  return tier === "validated" ? 3 : 1;
}

export function paymentRequiredPayload(agentId: string, message?: string) {
  return {
    status: "payment_required" as const,
    message: message ?? "DryLake Agent Preflight costs 1 credit for Basic and 3 credits for Validated planning tasks.",
    buy_credits_url: buyCreditsUrl(agentId),
    credit_packs: [
      { price_usd: 10, credits: 10 },
      { price_usd: 25, credits: 25 },
      { price_usd: 100, credits: 100 },
    ],
  };
}

export async function registerTrialAgent(input: AgentRegistrationInput, requestIp?: string | null) {
  const normalizedInput = agentRegistrationInputSchema.parse(input);
  const registrationIpHash = ipHash(requestIp);

  if (registrationIpHash) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRegistrations = await prisma.agentToken.count({
      where: {
        registrationIpHash,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentRegistrations >= TRIAL_REGISTRATION_LIMIT_PER_HOUR) {
      throw new AgentPreflightError(
        "rate_limited",
        "Too many DryLake trial agent registrations from this network. Try again later or connect a DryLake account.",
      );
    }
  }

  const rawToken = `dlk_trial_${randomSegment(32)}`;
  const externalId = `ag_${randomSegment(12)}`;
  const expiresAt = new Date(Date.now() + TRIAL_EXPIRES_IN_HOURS * 60 * 60 * 1000);
  const agent = await prisma.agentToken.create({
    data: {
      externalId,
      name: normalizedInput.agent_name ?? `${normalizedInput.source_client} trial agent`,
      sourceClient: normalizedInput.source_client,
      tokenPrefix: rawToken.slice(0, 18),
      tokenHash: tokenHash(rawToken),
      status: "trial",
      plan: "agent_trial",
      scopesJson: [...AGENT_TOKEN_SCOPES],
      balanceCredits: TRIAL_CREDITS,
      expiresAt,
      registrationIpHash,
    },
  });

  return {
    status: "registered" as const,
    agent_id: agent.externalId,
    agent_token: rawToken,
    plan: agent.plan,
    free_credits: TRIAL_CREDITS,
    expires_in_hours: TRIAL_EXPIRES_IN_HOURS,
    price_per_basic_preflight_usd: 1,
    buy_credits_url: buyCreditsUrl(agent.externalId),
  };
}

async function getAgentByToken(rawToken: string | null) {
  if (!rawToken) {
    throw new AgentPreflightError("agent_token_missing", "Missing DryLake agent token.");
  }

  const agent = await prisma.agentToken.findUnique({
    where: {
      tokenHash: tokenHash(rawToken),
    },
  });

  if (!agent || agent.revokedAt || agent.status === "revoked") {
    throw new AgentPreflightError("agent_token_invalid", "DryLake agent token is invalid or revoked.");
  }

  if (agent.expiresAt && agent.expiresAt.getTime() <= Date.now()) {
    await prisma.agentToken.update({
      where: { id: agent.id },
      data: { status: "expired" },
    });
    throw new AgentPreflightError("agent_token_expired", "DryLake trial agent token has expired.");
  }

  if (agent.status === "expired") {
    throw new AgentPreflightError("agent_token_expired", "DryLake trial agent token has expired.");
  }

  return agent;
}

function buildPreflightPrompt(input: PreflightInput) {
  const tierInstructions = input.tier === "validated"
    ? [
      "Return a Validated Preflight.",
      "The assurance object is required.",
      "Include risk classification, test checklist, rollback plan, dependency impact review, and a validation phase.",
    ]
    : [
      "Return a Basic Preflight.",
      "Set assurance to null.",
    ];

  return [
    "Create a DryLake Agent Preflight for a coding agent before it edits code.",
    "The output must help the receiving agent implement one active phase safely and let the owner see the planning contract.",
    "Do not claim code has been written. Do not run tools. Do not request secrets.",
    `Requested tier: ${input.tier}`,
    `Source client: ${input.source_client}`,
    `Target agent: ${input.target_agent ?? "unspecified"}`,
    input.repo_summary ? `Repo summary:\n${input.repo_summary}` : "Repo summary: not provided.",
    "",
    "Task:",
    input.task,
    "",
    "Rules:",
    "- Produce 3 to 7 phases unless the task is obviously smaller or larger.",
    "- The first phase is the active next-phase contract.",
    "- Keep the handoff focused on the first phase only.",
    "- Include acceptance criteria and risks per phase.",
    "- Estimate original task tokens and focused handoff tokens.",
    "- Make the handoff prompt directly usable by Claude Code, Codex, Cursor, Cline, or another coding agent.",
    ...tierInstructions.map((line) => `- ${line}`),
  ].join("\n");
}

async function generatePreflight(input: PreflightInput): Promise<PreflightOutput> {
  const rawText = await generateAiText({
    systemPrompt: [
      "You are Xupra AI inside DryLake Agent Preflight.",
      "You are a planning expert for coding-agent work.",
      "Return only JSON matching the provided schema.",
    ].join(" "),
    userPrompt: buildPreflightPrompt(input),
    taskLabel: "agent preflight planning",
    model: freePlanningModel(),
    textFormat: {
      type: "json_schema",
      name: "drylake_agent_preflight",
      schema: preflightJsonSchema as unknown as Record<string, unknown>,
      strict: true,
    },
  });

  const parsed = preflightOutputSchema.parse(JSON.parse(rawText));

  if (input.tier === "validated" && !parsed.assurance) {
    throw new Error("Xupra AI returned a Basic preflight for a Validated preflight request.");
  }

  return parsed;
}

function taskPreview(task: string) {
  return task.trim().slice(0, 500);
}

function jsonInput(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export async function runAgentPreflight(rawToken: string | null, input: PreflightInput) {
  const parsedInput = preflightInputSchema.parse(input);
  const agent = await getAgentByToken(rawToken);
  const cost = preflightCreditCost(parsedInput.tier);

  if (agent.balanceCredits < cost) {
    return paymentRequiredPayload(
      agent.externalId,
      `DryLake ${parsedInput.tier === "validated" ? "Validated" : "Basic"} Preflight requires ${cost} credit${cost === 1 ? "" : "s"}.`,
    );
  }

  const debitData: Prisma.AgentTokenUpdateManyMutationInput = {
    balanceCredits: { decrement: cost },
    lastUsedAt: new Date(),
  };

  if (agent.status === "trial") {
    debitData.freeCreditsUsed = { increment: cost };
  }

  const debit = await prisma.agentToken.updateMany({
    where: {
      id: agent.id,
      status: { in: ["trial", "paid"] },
      balanceCredits: { gte: cost },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    data: debitData,
  });

  if (debit.count !== 1) {
    const latest = await prisma.agentToken.findUnique({ where: { id: agent.id } });
    if (latest?.expiresAt && latest.expiresAt.getTime() <= Date.now()) {
      throw new AgentPreflightError("agent_token_expired", "DryLake trial agent token has expired.");
    }

    return paymentRequiredPayload(agent.externalId);
  }

  try {
    const preflight = await generatePreflight(parsedInput);
    const originalEstimate = Math.max(
      estimatePreflightTokens(parsedInput.task),
      preflight.token_budget.estimated_original_tokens,
    );
    const handoffEstimate = Math.max(
      estimatePreflightTokens(preflight.handoff.prompt),
      preflight.token_budget.estimated_handoff_tokens,
    );
    const run = await prisma.agentPreflightRun.create({
      data: {
        agentTokenId: agent.id,
        organizationId: agent.organizationId,
        status: "created",
        tier: parsedInput.tier,
        sourceClient: parsedInput.source_client,
        targetAgent: parsedInput.target_agent ?? preflight.handoff.target_agent,
        taskPreview: taskPreview(parsedInput.task),
        taskHash: taskHash(parsedInput.task),
        title: preflight.title,
        creditsDebited: cost,
        estimatedOriginalTokens: originalEstimate,
        estimatedHandoffTokens: handoffEstimate,
        planJson: jsonInput({
          title: preflight.title,
          summary: preflight.summary,
          phases: preflight.phases,
          token_budget: {
            ...preflight.token_budget,
            estimated_original_tokens: originalEstimate,
            estimated_handoff_tokens: handoffEstimate,
          },
          next_phase_contract: preflight.next_phase_contract,
        }),
        handoffJson: jsonInput(preflight.handoff),
        assuranceJson: preflight.assurance ? jsonInput(preflight.assurance) : undefined,
      },
    });

    return {
      status: "ok" as const,
      agent_id: agent.externalId,
      preflight_id: run.id,
      plan_id: run.id,
      active_phase_id: preflight.next_phase_contract.phase_id,
      handoff_id: `${run.id}:handoff`,
      tier: parsedInput.tier,
      credits_debited: cost,
      remaining_credits: agent.balanceCredits - cost,
      audit_url: `${env.APP_BASE_URL}/app/agents?preflight=${encodeURIComponent(run.id)}`,
      plan: {
        title: preflight.title,
        summary: preflight.summary,
        phases: preflight.phases,
      },
      token_budget: {
        ...preflight.token_budget,
        estimated_original_tokens: originalEstimate,
        estimated_handoff_tokens: handoffEstimate,
      },
      next_phase_contract: preflight.next_phase_contract,
      handoff: preflight.handoff,
      assurance: preflight.assurance,
    };
  } catch (error) {
    const refundData: Prisma.AgentTokenUpdateInput = {
      balanceCredits: { increment: cost },
    };

    if (agent.status === "trial") {
      refundData.freeCreditsUsed = { decrement: cost };
    }

    await prisma.agentToken.update({
      where: { id: agent.id },
      data: refundData,
    });

    throw error;
  }
}
