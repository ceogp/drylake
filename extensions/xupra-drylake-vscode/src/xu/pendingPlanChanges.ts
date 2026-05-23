import type { ApplicationBuildRunbook, XuPhase } from "./types";

export type PendingPlanChangeStatus = "pending" | "applied" | "discarded";
export type PendingPhaseResolutionStatus = "approved" | "rejected";

export type PendingPhaseResolution = {
  status: PendingPhaseResolutionStatus;
  resolvedAt: string;
};

export type PendingPlanChangeSet = {
  id: string;
  sourceChatMessageId: string;
  createdAt: string;
  baseRunbookPath: string;
  proposedRunbook: ApplicationBuildRunbook;
  affectedPhaseIds: string[];
  phaseSummaries: Record<string, string>;
  phaseResolutions: Record<string, PendingPhaseResolution>;
  status: PendingPlanChangeStatus;
};

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortedValue(child)]),
  );
}

function comparableStep(step: XuPhase["steps"][number]) {
  return {
    id: step.id,
    text: step.text,
  };
}

function comparablePhase(phase: XuPhase | undefined) {
  if (!phase) {
    return null;
  }

  return sortedValue({
    id: phase.id,
    title: phase.title,
    gate: phase.gate,
    objective: phase.objective,
    inputs: phase.inputs,
    outputs: phase.outputs,
    steps: phase.steps.map(comparableStep),
    acceptance: phase.acceptance,
  });
}

function samePhase(left: XuPhase | undefined, right: XuPhase | undefined) {
  return JSON.stringify(comparablePhase(left)) === JSON.stringify(comparablePhase(right));
}

function phaseById(runbook: ApplicationBuildRunbook, phaseId: string) {
  return runbook.phases.find((phase) => phase.id === phaseId);
}

export function affectedPhaseIds(current: ApplicationBuildRunbook, proposed: ApplicationBuildRunbook) {
  const proposedIds = proposed.phases.map((phase) => phase.id);
  const currentOnlyIds = current.phases
    .map((phase) => phase.id)
    .filter((phaseId) => !proposedIds.includes(phaseId));
  const ids = [...proposedIds, ...currentOnlyIds];

  return ids.filter((phaseId) => !samePhase(phaseById(current, phaseId), phaseById(proposed, phaseId)));
}

export function describePhaseChange(
  current: ApplicationBuildRunbook,
  proposed: ApplicationBuildRunbook,
  phaseId: string,
) {
  const currentPhase = phaseById(current, phaseId);
  const proposedPhase = phaseById(proposed, phaseId);

  if (!currentPhase && proposedPhase) {
    return `New phase: ${proposedPhase.title}`;
  }

  if (currentPhase && !proposedPhase) {
    return "Remove this phase from the plan.";
  }

  if (!currentPhase || !proposedPhase) {
    return "Phase plan changed.";
  }

  const changes: string[] = [];
  if (currentPhase.title !== proposedPhase.title) {
    changes.push(`Title changes to "${proposedPhase.title}"`);
  }
  if (currentPhase.objective !== proposedPhase.objective) {
    changes.push("Objective changes");
  }
  if (currentPhase.steps.map(comparableStep).length !== proposedPhase.steps.map(comparableStep).length) {
    changes.push(`Steps change from ${currentPhase.steps.length} to ${proposedPhase.steps.length}`);
  } else if (
    JSON.stringify(currentPhase.steps.map(comparableStep)) !==
    JSON.stringify(proposedPhase.steps.map(comparableStep))
  ) {
    changes.push("Step details change");
  }
  if (JSON.stringify(currentPhase.acceptance) !== JSON.stringify(proposedPhase.acceptance)) {
    changes.push("Acceptance criteria change");
  }
  if (JSON.stringify(currentPhase.inputs) !== JSON.stringify(proposedPhase.inputs)) {
    changes.push("Inputs change");
  }
  if (JSON.stringify(currentPhase.outputs) !== JSON.stringify(proposedPhase.outputs)) {
    changes.push("Outputs change");
  }
  if (currentPhase.gate !== proposedPhase.gate) {
    changes.push(`Gate changes to "${proposedPhase.gate}"`);
  }

  return changes.slice(0, 3).join("; ") || "Phase details changed.";
}

export function createPendingPlanChangeSet(params: {
  sourceChatMessageId: string;
  baseRunbookPath: string;
  currentRunbook: ApplicationBuildRunbook;
  proposedRunbook: ApplicationBuildRunbook;
  now?: Date;
}): PendingPlanChangeSet {
  const createdAt = (params.now ?? new Date()).toISOString();
  const changedPhaseIds = affectedPhaseIds(params.currentRunbook, params.proposedRunbook);

  return {
    id: `plan-change-${createdAt.replace(/[:.]/g, "-")}`,
    sourceChatMessageId: params.sourceChatMessageId,
    createdAt,
    baseRunbookPath: params.baseRunbookPath,
    proposedRunbook: params.proposedRunbook,
    affectedPhaseIds: changedPhaseIds,
    phaseSummaries: Object.fromEntries(
      changedPhaseIds.map((phaseId) => [
        phaseId,
        describePhaseChange(params.currentRunbook, params.proposedRunbook, phaseId),
      ]),
    ),
    phaseResolutions: {},
    status: "pending",
  };
}

function mergeExecutionState(current: XuPhase | undefined, proposed: XuPhase): XuPhase {
  if (!current) {
    return proposed;
  }

  return {
    ...proposed,
    agent: current.agent,
    status: current.status,
    steps: proposed.steps.map((step) => {
      const currentStep = current.steps.find((item) => item.id === step.id);
      return currentStep ? { ...step, status: currentStep.status } : step;
    }),
  };
}

function insertNewPhase(currentPhases: XuPhase[], proposedPhases: XuPhase[], phase: XuPhase) {
  const proposedIndex = proposedPhases.findIndex((item) => item.id === phase.id);
  const beforeIds = new Set(proposedPhases.slice(0, proposedIndex).map((item) => item.id));
  let insertAt = 0;

  currentPhases.forEach((item, index) => {
    if (beforeIds.has(item.id)) {
      insertAt = index + 1;
    }
  });

  return [
    ...currentPhases.slice(0, insertAt),
    phase,
    ...currentPhases.slice(insertAt),
  ];
}

export function applyApprovedPhaseChange(
  current: ApplicationBuildRunbook,
  pending: PendingPlanChangeSet,
  phaseId: string,
) {
  const proposedPhase = pending.proposedRunbook.phases.find((phase) => phase.id === phaseId);
  const currentPhase = current.phases.find((phase) => phase.id === phaseId);

  let phases: XuPhase[];
  if (!proposedPhase) {
    phases = current.phases.filter((phase) => phase.id !== phaseId);
  } else if (currentPhase) {
    phases = current.phases.map((phase) =>
      phase.id === phaseId ? mergeExecutionState(phase, proposedPhase) : phase,
    );
  } else {
    phases = insertNewPhase(current.phases, pending.proposedRunbook.phases, proposedPhase);
  }

  return {
    ...current,
    phases,
  };
}

export function resolvePendingPhase(
  pending: PendingPlanChangeSet,
  phaseId: string,
  status: PendingPhaseResolutionStatus,
  now = new Date(),
): PendingPlanChangeSet {
  const phaseResolutions = {
    ...pending.phaseResolutions,
    [phaseId]: {
      status,
      resolvedAt: now.toISOString(),
    },
  };
  const unresolved = pending.affectedPhaseIds.filter((id) => !phaseResolutions[id]);
  const approvedCount = Object.values(phaseResolutions).filter((resolution) => resolution.status === "approved").length;

  return {
    ...pending,
    phaseResolutions,
    status: unresolved.length === 0 ? (approvedCount > 0 ? "applied" : "discarded") : "pending",
  };
}

export function isPendingPhaseUnresolved(pending: PendingPlanChangeSet, phaseId: string) {
  return pending.status === "pending" &&
    pending.affectedPhaseIds.includes(phaseId) &&
    !pending.phaseResolutions[phaseId];
}
