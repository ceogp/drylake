import { GENERATED_HEADER, renderPhaseSection, renderRunbookSummary } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderRunbookMd(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    renderRunbookSummary(runbook),
    "",
    "# Phases",
    "",
    ...runbook.phases.map(renderPhaseSection),
    "",
    "# Provisioning Preview",
    "",
    "Commands are preview-only in this version. DryLake will not run them automatically.",
    "",
    runbook.provisioning.commands.length > 0
      ? runbook.provisioning.commands.map((command) => `- \`${command}\``).join("\n")
      : "- No commands recorded.",
  ].join("\n");
}

