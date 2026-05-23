import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildRunbookDraftPrompt: vi.fn(),
  clarifyRunbookIntent: vi.fn(),
  generateRunbookPhasePlanPrompt: vi.fn(),
  getRequestOrganizationId: vi.fn(),
  refineRunbookArchitecturePrompt: vi.fn(),
  refineRunbookPurposePrompt: vi.fn(),
  resolveRunbookPlanningAccess: vi.fn(),
  safeParse: vi.fn(),
}));

vi.mock("@/lib/services/request-organization", () => ({
  INVALID_EXTENSION_TOKEN_ERROR: "Invalid extension token",
  REQUEST_AUTHENTICATION_REQUIRED_ERROR: "Authentication required",
  getRequestOrganizationId: mocks.getRequestOrganizationId,
}));

vi.mock("@/lib/services/runbook-planning-access", () => ({
  resolveRunbookPlanningAccess: mocks.resolveRunbookPlanningAccess,
}));

vi.mock("@/lib/services/runbook-generation", () => ({
  buildRunbookDraftPrompt: mocks.buildRunbookDraftPrompt,
  clarifyRunbookIntent: mocks.clarifyRunbookIntent,
  generateRunbookPhasePlanPrompt: mocks.generateRunbookPhasePlanPrompt,
  refineRunbookArchitecturePrompt: mocks.refineRunbookArchitecturePrompt,
  refineRunbookPurposePrompt: mocks.refineRunbookPurposePrompt,
  runbookClarifyInputSchema: { safeParse: mocks.safeParse },
  runbookGenerationInputSchema: { safeParse: mocks.safeParse },
}));

import { POST as clarify } from "@/app/api/v1/drylake/runbooks/clarify/route";
import { POST as draft } from "@/app/api/v1/drylake/runbooks/draft/route";
import { POST as generatePhases } from "@/app/api/v1/drylake/runbooks/generate-phases/route";
import { POST as refineArchitecture } from "@/app/api/v1/drylake/runbooks/refine-architecture/route";
import { POST as refinePurpose } from "@/app/api/v1/drylake/runbooks/refine-purpose/route";

function runbookRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Build checkout",
      mode: "build-app",
      workspaceSummary: "Workspace: test",
    }),
  });
}

beforeEach(() => {
  mocks.buildRunbookDraftPrompt.mockReset();
  mocks.clarifyRunbookIntent.mockReset();
  mocks.generateRunbookPhasePlanPrompt.mockReset();
  mocks.getRequestOrganizationId.mockReset();
  mocks.refineRunbookArchitecturePrompt.mockReset();
  mocks.refineRunbookPurposePrompt.mockReset();
  mocks.resolveRunbookPlanningAccess.mockReset();
  mocks.safeParse.mockReset();

  mocks.getRequestOrganizationId.mockResolvedValue("org-free");
  mocks.resolveRunbookPlanningAccess.mockResolvedValue({ tier: "nano", model: "gpt-5.4-nano" });
  mocks.safeParse.mockImplementation((body: unknown) => ({ success: true, data: body }));
});

describe("runbook route model tier responses", () => {
  it.each([
    {
      name: "draft",
      path: "/api/v1/drylake/runbooks/draft",
      post: draft,
      service: mocks.buildRunbookDraftPrompt,
      result: { content: "xu: 1\nkind: ApplicationBuildRunbook\n" },
    },
    {
      name: "generate-phases",
      path: "/api/v1/drylake/runbooks/generate-phases",
      post: generatePhases,
      service: mocks.generateRunbookPhasePlanPrompt,
      result: { content: "xu: 1\nkind: ApplicationBuildRunbook\n" },
    },
    {
      name: "refine-purpose",
      path: "/api/v1/drylake/runbooks/refine-purpose",
      post: refinePurpose,
      service: mocks.refineRunbookPurposePrompt,
      result: { content: "xu: 1\nkind: ApplicationBuildRunbook\n" },
    },
    {
      name: "refine-architecture",
      path: "/api/v1/drylake/runbooks/refine-architecture",
      post: refineArchitecture,
      service: mocks.refineRunbookArchitecturePrompt,
      result: { content: "xu: 1\nkind: ApplicationBuildRunbook\n" },
    },
    {
      name: "clarify",
      path: "/api/v1/drylake/runbooks/clarify",
      post: clarify,
      service: mocks.clarifyRunbookIntent,
      result: { questions: ["Who uses it?"] },
    },
  ])("returns modelTier for $name responses", async ({ path, post, service, result }) => {
    service.mockResolvedValueOnce(result);

    const response = await post(runbookRequest(path));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      ...result,
      modelTier: "nano",
    });
    expect(service).toHaveBeenCalledWith(expect.anything(), { model: "gpt-5.4-nano" });
  });

  it("preserves sanitized draft AI error messages in the API payload", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-pro");
    mocks.resolveRunbookPlanningAccess.mockResolvedValueOnce({ tier: "foundation", model: "gpt-5.4" });
    mocks.buildRunbookDraftPrompt.mockRejectedValueOnce(
      new Error("Xupra AI is not configured: OPENAI_MODEL is missing."),
    );

    try {
      const response = await draft(runbookRequest("/api/v1/drylake/runbooks/draft"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        error: {
          code: "internal_error",
          message: "Xupra AI is not configured: OPENAI_MODEL is missing.",
        },
      });
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
