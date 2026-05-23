import type { ApplicationBuildRunbook, XuValidationDiagnostic, XuValidationResult } from "./types";

function requireString(
  diagnostics: XuValidationDiagnostic[],
  path: string,
  value: unknown,
  message: string,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    diagnostics.push({ path, message });
  }
}

function requireArray(
  diagnostics: XuValidationDiagnostic[],
  path: string,
  value: unknown,
  message: string,
) {
  if (!Array.isArray(value) || value.length === 0) {
    diagnostics.push({ path, message });
  }
}

export function validateXu(runbook: ApplicationBuildRunbook): XuValidationResult {
  const diagnostics: XuValidationDiagnostic[] = [];

  if (runbook.xu !== 1) {
    diagnostics.push({ path: "xu", message: "Runbook must declare xu: 1." });
  }

  if (runbook.kind !== "ApplicationBuildRunbook") {
    diagnostics.push({
      path: "kind",
      message: "Runbook kind must be ApplicationBuildRunbook.",
    });
  }

  requireString(diagnostics, "metadata.name", runbook.metadata.name, "Runbook must have metadata.name.");
  if (runbook.metadata.status !== "draft") {
    requireString(diagnostics, "intent.purpose", runbook.intent.purpose, "Runbook must have intent.purpose.");
  }
  requireArray(diagnostics, "phases", runbook.phases, "Runbook must include at least one phase.");

  runbook.phases.forEach((phase, index) => {
    const prefix = `phases[${index}]`;
    requireString(diagnostics, `${prefix}.id`, phase.id, "Each phase must have an id.");
    requireString(diagnostics, `${prefix}.title`, phase.title, "Each phase must have a title.");
    requireArray(diagnostics, `${prefix}.steps`, phase.steps, "Each phase must include steps.");
    requireArray(diagnostics, `${prefix}.acceptance`, phase.acceptance, "Each phase must include acceptance criteria.");
  });

  if (!runbook.provisioning.safety.requiresApprovalBeforeExecution) {
    diagnostics.push({
      path: "provisioning.safety.requiresApprovalBeforeExecution",
      message: "Provisioning must require approval before execution.",
    });
  }

  if (runbook.provisioning.safety.executeAutomatically) {
    diagnostics.push({
      path: "provisioning.safety.executeAutomatically",
      message: "DryLake v1 must not execute provisioning automatically.",
    });
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
  };
}

