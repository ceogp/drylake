import { GENERATED_HEADER, bulletList } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderCursorRules(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    "# Cursor Rules",
    "",
    "description: DryLake execution runbook",
    "globs: **/*",
    "alwaysApply: true",
    "",
    "Use `drylake.xu` as the source of truth.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
  ].join("\n");
}
