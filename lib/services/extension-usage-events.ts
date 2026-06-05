import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const optionalText = (maxLength: number) => z.string().trim().min(1).max(maxLength).optional();
const optionalPromptText = z.string().trim().min(1).max(500_000).optional();
const PROMPT_PREVIEW_LENGTH = 1200;
const PROMPT_FULL_TEXT_LENGTH = 50_000;

export const extensionUsageEventInputSchema = z.object({
  eventName: z.string().trim().min(1).max(80),
  sessionId: optionalText(128),
  workspaceHash: optionalText(128),
  phaseId: optionalText(120),
  phaseTitle: optionalText(240),
  agentId: optionalText(80),
  skillLogicalPath: optionalText(500),
  actionType: optionalText(80),
  launchStatus: optionalText(80),
  reasonCode: optionalText(120),
  promptEstimatedTokens: z.number().int().min(0).max(100_000_000).optional(),
  promptKind: optionalText(80),
  promptText: optionalPromptText,
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type ExtensionUsageEventInput = z.infer<typeof extensionUsageEventInputSchema>;

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function redactPromptText(value: string) {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED AWS ACCESS KEY]")
    .replace(/\b(?:sk|rk|pk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s`]+["']?/gi, "$1=[REDACTED]");
}

function promptHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildPromptCaptureFields(event: ExtensionUsageEventInput) {
  if (!event.promptText) {
    return {
      promptKind: event.promptKind,
      promptPreview: undefined,
      promptText: undefined,
      promptHash: undefined,
      promptCaptured: false,
      promptCaptureMode: env.EXTENSION_PROMPT_CAPTURE_MODE,
    };
  }

  const rawPrompt = event.promptText.trim();
  const redactedPrompt = redactPromptText(rawPrompt);
  const captureMode = env.EXTENSION_PROMPT_CAPTURE_MODE;
  const promptPreview = captureMode === "preview" || captureMode === "full"
    ? truncateText(redactedPrompt, PROMPT_PREVIEW_LENGTH)
    : undefined;
  const capturedFullText = captureMode === "full"
    ? truncateText(redactedPrompt, PROMPT_FULL_TEXT_LENGTH)
    : undefined;

  return {
    promptKind: event.promptKind,
    promptPreview,
    promptText: capturedFullText,
    promptHash: promptHash(rawPrompt),
    promptCaptured: Boolean(promptPreview || capturedFullText),
    promptCaptureMode: captureMode,
  };
}

export async function recordExtensionUsageEvent(input: {
  organizationId: string;
  actorUserId: string;
  event: ExtensionUsageEventInput;
}) {
  const promptCapture = buildPromptCaptureFields(input.event);

  return prisma.extensionUsageEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventName: input.event.eventName,
      sessionId: input.event.sessionId,
      workspaceHash: input.event.workspaceHash,
      phaseId: input.event.phaseId,
      phaseTitle: input.event.phaseTitle,
      agentId: input.event.agentId,
      skillLogicalPath: input.event.skillLogicalPath,
      actionType: input.event.actionType,
      launchStatus: input.event.launchStatus,
      reasonCode: input.event.reasonCode,
      promptEstimatedTokens: input.event.promptEstimatedTokens,
      promptKind: promptCapture.promptKind,
      promptPreview: promptCapture.promptPreview,
      promptText: promptCapture.promptText,
      promptHash: promptCapture.promptHash,
      promptCaptured: promptCapture.promptCaptured,
      promptCaptureMode: promptCapture.promptCaptureMode,
      metadataJson: input.event.metadata as Prisma.InputJsonValue | undefined,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
}

export async function recordExtensionUsageEventBestEffort(input: Parameters<typeof recordExtensionUsageEvent>[0]) {
  try {
    return await recordExtensionUsageEvent(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to record DryLake extension usage event ${input.event.eventName}: ${detail}`);
    return undefined;
  }
}

export async function recordRunbookPlanningUsage(input: {
  organizationId: string;
  actorUserId: string;
  promptKind: string;
  promptText: string;
  metadata?: Record<string, unknown>;
}) {
  return recordExtensionUsageEventBestEffort({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    event: {
      eventName: input.promptKind === "planning_chat" ? "planning_chat_message" : "planning_prompt_submitted",
      actionType: input.promptKind,
      promptKind: input.promptKind,
      promptText: input.promptText,
      metadata: input.metadata,
    },
  });
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + 1);
}

function topCounts(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function getExtensionUsageSummary(organizationId: string, options?: { sinceDays?: number }) {
  const sinceDays = options?.sinceDays ?? 30;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const where = {
    organizationId,
    createdAt: {
      gte: since,
    },
  };

  const [totalEvents, promptedEvents, capturedPromptEvents, events] = await Promise.all([
    prisma.extensionUsageEvent.count({ where }),
    prisma.extensionUsageEvent.count({
      where: {
        ...where,
        promptHash: {
          not: null,
        },
      },
    }),
    prisma.extensionUsageEvent.count({
      where: {
        ...where,
        promptCaptured: true,
      },
    }),
    prisma.extensionUsageEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        eventName: true,
        phaseTitle: true,
        agentId: true,
        skillLogicalPath: true,
        actionType: true,
        launchStatus: true,
        reasonCode: true,
        promptEstimatedTokens: true,
        promptKind: true,
        promptPreview: true,
        promptHash: true,
        promptCaptured: true,
        promptCaptureMode: true,
        createdAt: true,
      },
    }),
  ]);

  const agentCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  const promptTokenEstimates: number[] = [];

  for (const event of events) {
    increment(agentCounts, event.agentId);
    increment(skillCounts, event.skillLogicalPath);

    if (typeof event.promptEstimatedTokens === "number") {
      promptTokenEstimates.push(event.promptEstimatedTokens);
    }
  }

  const averagePromptEstimatedTokens = promptTokenEstimates.length > 0
    ? Math.round(promptTokenEstimates.reduce((sum, value) => sum + value, 0) / promptTokenEstimates.length)
    : 0;

  return {
    sinceDays,
    totalEvents,
    promptedEvents,
    capturedPromptEvents,
    handoffLaunches: events.filter((event) => event.eventName === "phase_handoff_launched").length,
    handoffLaunchFailures: events.filter((event) => event.eventName === "phase_handoff_launch_failed").length,
    promptExports: events.filter((event) => event.eventName === "phase_handoff_exported").length,
    planningPrompts: events.filter((event) => event.eventName === "planning_prompt_submitted").length,
    planningChatMessages: events.filter((event) => event.eventName === "planning_chat_message").length,
    phaseCompletions: events.filter((event) => event.eventName === "phase_marked_complete").length,
    autopilotStarts: events.filter((event) => event.eventName === "phase_autopilot_started_next").length,
    agentSelections: events.filter((event) => event.eventName === "phase_agent_selected").length,
    skillSelections: events.filter((event) => event.eventName === "phase_skill_selected").length,
    agentSetupChecks: events.filter((event) => event.eventName === "agent_setup_checked").length,
    averagePromptEstimatedTokens,
    topAgents: topCounts(agentCounts, 8),
    topSkills: topCounts(skillCounts, 8),
    recentEvents: events.slice(0, 20),
  };
}
