import type { XuPhaseAgent } from "../xu/types";

export type MultiAgentRunStatus = "pending" | "running" | "complete" | "failed";

export type MultiAgentAssignmentSource = "ai" | "manual";

export type MultiAgentAssignment = {
  agentId: XuPhaseAgent;
  label: string;
  assignmentSummary: string;
  assignmentBoundary: string;
};

export type MultiAgentAssignmentPlan = {
  runId: string;
  taskPrompt: string;
  assignmentSource: MultiAgentAssignmentSource;
  assignmentApprovedAt: string | null;
  modelTier: "nano" | "foundation" | null;
  assignments: MultiAgentAssignment[];
  conflictWarning: string | null;
};

export type AgentRunEntry = {
  id: XuPhaseAgent;
  label: string;
  assignmentSummary: string;
  assignmentBoundary: string;
  status: MultiAgentRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  command: string | null;
  installError: string | null;
  terminalName: string | null;
  promptFile: string | null;
};

export type MultiAgentRun = {
  id: string;
  status: MultiAgentRunStatus;
  taskPrompt: string;
  assignmentSource: MultiAgentAssignmentSource;
  assignmentApprovedAt: string | null;
  createdAt: string;
  agents: AgentRunEntry[];
};
