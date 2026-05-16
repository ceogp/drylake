import { GENERATED_HEADER, bulletList } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderClaudeMd(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    "# Claude Code Instructions",
    "",
    "Use `drylake.xu` as the source of truth for this work.",
    "",
    "## Approved Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Handoff",
    bulletList(runbook.handoff.instructions),
  ].join("\n");
}

