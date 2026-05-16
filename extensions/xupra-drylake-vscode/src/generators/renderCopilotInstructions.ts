import { GENERATED_HEADER, bulletList } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderCopilotInstructions(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    "# GitHub Copilot Instructions",
    "",
    "Follow `drylake.xu` and the current phase prompt under `.drylake/generated/`.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Do Not",
    bulletList(runbook.intent.nonGoals),
  ].join("\n");
}

