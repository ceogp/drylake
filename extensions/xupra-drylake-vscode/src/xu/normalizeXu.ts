import { createStarterXu } from "./createStarterXu";
import { XU_PHASE_AGENTS } from "./types";
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuPhaseAgent, XuStep, XuStepStatus } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter((item) => item.trim().length > 0)
    : [];
}

function asStepStatus(value: unknown): XuStepStatus {
  return value === "active" ||
    value === "approved" ||
    value === "needs-revision" ||
    value === "complete"
    ? value
    : "pending";
}

function asSteps(value: unknown, phaseId: string): XuStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): XuStep | null => {
      const fallbackId = `${phaseId}-step-${String(index + 1).padStart(2, "0")}`;
      if (typeof item === "string") {
        const text = item.trim();
        return text.length === 0 ? null : { id: fallbackId, text, status: "pending" };
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const text = asString(record.text).trim();
        if (text.length === 0) {
          return null;
        }
        return {
          id: asString(record.id, fallbackId) || fallbackId,
          text,
          status: asStepStatus(record.status),
        };
      }

      return null;
    })
    .filter((step): step is XuStep => step !== null);
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asPhaseAgent(value: unknown): XuPhaseAgent | undefined {
  return typeof value === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(value)
    ? (value as XuPhaseAgent)
    : undefined;
}

function normalizePhase(value: unknown, index: number): XuPhase {
  const phase = asRecord(value);
  const id = asString(phase.id, `phase-${String(index + 1).padStart(2, "0")}`);

  return {
    id,
    title: asString(phase.title, id),
    agent: asPhaseAgent(phase.agent),
    gate: asString(phase.gate, "phase-review"),
    status:
      phase.status === "active" ||
      phase.status === "approved" ||
      phase.status === "needs-revision" ||
      phase.status === "complete"
        ? phase.status
        : "pending",
    objective: asString(phase.objective),
    inputs: asStringArray(phase.inputs),
    outputs: asStringArray(phase.outputs),
    steps: asSteps(phase.steps, id),
    acceptance: asStringArray(phase.acceptance),
  };
}

export function normalizeXu(value: unknown): ApplicationBuildRunbook {
  const starter = createStarterXu();
  const root = asRecord(value);
  const metadata = asRecord(root.metadata);
  const intent = asRecord(root.intent);
  const confirmation = asRecord(root.confirmation);
  const architecture = asRecord(root.architecture);
  const provisioning = asRecord(root.provisioning);
  const safety = asRecord(provisioning.safety);
  const checks = asRecord(root.checks);
  const agentTargets = asRecord(root.agentTargets);
  const handoff = asRecord(root.handoff);

  return {
    xu: 1,
    kind: "ApplicationBuildRunbook",
    metadata: {
      name: asString(metadata.name, starter.metadata.name),
      owner: asString(metadata.owner, starter.metadata.owner),
      status:
        metadata.status === "approved" ||
        metadata.status === "in-progress" ||
        metadata.status === "complete"
          ? metadata.status
          : "draft",
      mode:
        metadata.mode === "phases" ||
        metadata.mode === "plan" ||
        metadata.mode === "review" ||
        metadata.mode === "build-app"
          ? (metadata.mode as XuMode)
          : starter.metadata.mode,
    },
    intent: {
      rawPrompt: asString(intent.rawPrompt),
      purpose: asString(intent.purpose),
      users: asStringArray(intent.users),
      goals: asStringArray(intent.goals),
      nonGoals: asStringArray(intent.nonGoals),
      constraints: asStringArray(intent.constraints),
    },
    confirmation: {
      required: asBoolean(confirmation.required, true),
      status:
        confirmation.status === "approved" || confirmation.status === "needs-revision"
          ? confirmation.status
          : "pending",
      userApprovedIntent: asBoolean(confirmation.userApprovedIntent, false),
      userApprovedArchitecture: asBoolean(confirmation.userApprovedArchitecture, false),
      userApprovedProvisioning: asBoolean(confirmation.userApprovedProvisioning, false),
    },
    architecture: {
      status:
        architecture.status === "draft" ||
        architecture.status === "approved" ||
        architecture.status === "needs-revision"
          ? architecture.status
          : "proposed",
      summary: asString(architecture.summary),
      decisions: Array.isArray(architecture.decisions)
        ? architecture.decisions.map((item, index) => {
            const decision = asRecord(item);
            return {
              id: asString(decision.id, `decision-${index + 1}`),
              choice: asString(decision.choice),
              rationale: asString(decision.rationale),
            };
          })
        : [],
      risks: asStringArray(architecture.risks),
      assumptions: asStringArray(architecture.assumptions),
    },
    provisioning: {
      status: provisioning.status === "proposed" || provisioning.status === "approved" ? provisioning.status : "draft",
      commands: asStringArray(provisioning.commands),
      filesToCreate: asStringArray(provisioning.filesToCreate),
      environmentVariables: asStringArray(provisioning.environmentVariables),
      externalServices: asStringArray(provisioning.externalServices),
      safety: {
        requiresApprovalBeforeExecution: asBoolean(safety.requiresApprovalBeforeExecution, true),
        executeAutomatically: false,
      },
    },
    phases: Array.isArray(root.phases) && root.phases.length > 0
      ? root.phases.map(normalizePhase)
      : starter.phases,
    checks: {
      install: asString(checks.install, starter.checks.install),
      dev: asString(checks.dev, starter.checks.dev),
      build: asString(checks.build, starter.checks.build),
      test: asString(checks.test, starter.checks.test),
      lint: asString(checks.lint, starter.checks.lint),
    },
    agentTargets: {
      agentsMd: asBoolean(agentTargets.agentsMd, true),
      claudeMd: asBoolean(agentTargets.claudeMd, true),
      copilotInstructions: asBoolean(agentTargets.copilotInstructions, true),
      cursorRules: asBoolean(agentTargets.cursorRules, true),
      codexSkill: asBoolean(agentTargets.codexSkill, true),
      openclawSkill: asBoolean(agentTargets.openclawSkill, true),
    },
    handoff: {
      defaultAgent: asString(handoff.defaultAgent, starter.handoff.defaultAgent),
      instructions: asStringArray(handoff.instructions).length > 0
        ? asStringArray(handoff.instructions)
        : starter.handoff.instructions,
    },
  };
}

