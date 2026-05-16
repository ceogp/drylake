import { describe, expect, it } from "vitest";

import { createStarterXu } from "../xu/createStarterXu";
import { normalizeXu } from "../xu/normalizeXu";
import { parseXu } from "../xu/parseXu";
import { renderXu } from "../xu/renderXu";
import { validateXu } from "../xu/validateXu";
import { applyApproval, buildApprovalRecord } from "../xu/approvalState";

function validRunbook() {
  const runbook = createStarterXu({ prompt: "Build a task tracker", mode: "build-app" });
  runbook.intent.purpose = "Build a local task tracker.";
  runbook.architecture.summary = "Use the existing extension architecture and local files.";
  return runbook;
}

describe("xu runbooks", () => {
  it("parses a valid drylake.xu", () => {
    const runbook = validRunbook();
    const parsed = parseXu(renderXu(runbook));

    expect(parsed.validation.ok).toBe(true);
    expect(parsed.runbook?.kind).toBe("ApplicationBuildRunbook");
    expect(parsed.runbook?.metadata.name).toBe("build-a-task-tracker");
  });

  it("rejects invalid xu syntax", () => {
    const parsed = parseXu("xu: 1\nkind: [");

    expect(parsed.validation.ok).toBe(false);
    expect(parsed.runbook).toBeFalsy();
  });

  it("validates required fields", () => {
    const runbook = createStarterXu({ prompt: "Build", mode: "plan" });
    const result = validateXu(runbook);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.path === "intent.purpose")).toBe(true);
  });

  it("normalizes optional fields and keeps provisioning preview-only", () => {
    const normalized = normalizeXu({
      xu: 1,
      kind: "ApplicationBuildRunbook",
      metadata: { name: "partial", status: "draft" },
      intent: { rawPrompt: "partial", purpose: "Purpose" },
      phases: [{ id: "01", title: "One", steps: ["Do"], acceptance: ["Done"] }],
      provisioning: { commands: ["npm install"], safety: { executeAutomatically: true } },
    });

    expect(normalized.provisioning.commands).toEqual(["npm install"]);
    expect(normalized.provisioning.safety.requiresApprovalBeforeExecution).toBe(true);
    expect(normalized.provisioning.safety.executeAutomatically).toBe(false);
    expect(normalized.phases[0].gate).toBe("phase-review");
  });

  it("normalizes optional phase agent assignments", () => {
    const withAgent = normalizeXu({
      xu: 1,
      kind: "ApplicationBuildRunbook",
      metadata: { name: "partial", status: "draft" },
      intent: { rawPrompt: "partial", purpose: "Purpose" },
      phases: [
        { id: "01", title: "One", agent: "codex", steps: ["Do"], acceptance: ["Done"] },
        { id: "02", title: "Two", agent: "gpt-4", steps: ["Do"], acceptance: ["Done"] },
        { id: "03", title: "Three", steps: ["Do"], acceptance: ["Done"] },
      ],
    });

    expect(withAgent.phases[0].agent).toBe("codex");
    expect(withAgent.phases[1].agent).toBeUndefined();
    expect(withAgent.phases[2].agent).toBeUndefined();
    expect(parseXu(renderXu(withAgent)).runbook?.phases[0].agent).toBe("codex");
  });

  it("persists approval state records", () => {
    const approved = applyApproval(validRunbook(), "purpose");
    const record = buildApprovalRecord({ type: "purpose", runbook: approved, approvedAt: "2026-05-10T00:00:00.000Z" });

    expect(approved.confirmation.userApprovedIntent).toBe(true);
    expect(record.type).toBe("purpose");
    expect(record.approvedBy).toBe("local-user");
  });
});
