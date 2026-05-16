import { GENERATED_HEADER, bulletList } from "./common";
import type { ApplicationBuildRunbook } from "../xu/types";

export function renderCodexSkill(runbook: ApplicationBuildRunbook) {
  return [
    GENERATED_HEADER,
    "# DryLake Execution Skill",
    "",
    "name: drylake-execution",
    "description: Execute the approved DryLake runbook phase by phase.",
    "",
    "Use this skill when executing a DryLake Agent Runbook.",
    "",
    "## Source",
    "Read `drylake.xu` before making changes.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Required Behavior",
    bulletList(runbook.handoff.instructions),
  ].join("\n");
}
