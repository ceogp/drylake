import { GENERATED_HEADER, bulletList } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderAgentsMd(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    "# Agent Instructions",
    "",
    "Follow the approved DryLake runbook in `drylake.xu`.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Review drylake.xu for the current purpose.",
    "",
    "## Goals",
    bulletList(runbook.intent.goals),
    "",
    "## Non-Goals",
    bulletList(runbook.intent.nonGoals),
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Execution Rules",
    bulletList(runbook.handoff.instructions),
  ].join("\n");
}

