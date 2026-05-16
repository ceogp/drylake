import type { ApplicationBuildRunbook } from "./types";

export type ApprovalType = "purpose" | "architecture";

export type ApprovalRecord = {
  type: ApprovalType;
  approvedAt: string;
  approvedBy: "local-user";
  runbook: "drylake.xu";
  summary: string;
};

export function buildApprovalRecord(params: {
  type: ApprovalType;
  runbook: ApplicationBuildRunbook;
  approvedAt?: string;
}): ApprovalRecord {
  return {
    type: params.type,
    approvedAt: params.approvedAt ?? new Date().toISOString(),
    approvedBy: "local-user",
    runbook: "drylake.xu",
    summary:
      params.type === "purpose"
        ? params.runbook.intent.purpose
        : params.runbook.architecture.summary,
  };
}

export function applyApproval(runbook: ApplicationBuildRunbook, type: ApprovalType): ApplicationBuildRunbook {
  if (type === "purpose") {
    return {
      ...runbook,
      confirmation: {
        ...runbook.confirmation,
        userApprovedIntent: true,
        status: runbook.confirmation.userApprovedArchitecture ? "approved" : "pending",
      },
      phases: runbook.phases.map((phase) =>
        phase.id === "01-intake" ? { ...phase, status: "approved" } : phase,
      ),
    };
  }

  return {
    ...runbook,
    confirmation: {
      ...runbook.confirmation,
      userApprovedArchitecture: true,
      status: runbook.confirmation.userApprovedIntent ? "approved" : "pending",
    },
    architecture: {
      ...runbook.architecture,
      status: "approved",
    },
    phases: runbook.phases.map((phase) =>
      phase.id === "02-architecture" ? { ...phase, status: "approved" } : phase,
    ),
  };
}

