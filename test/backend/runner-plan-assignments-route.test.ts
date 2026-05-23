import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestOrganizationId: vi.fn(),
  planRunnerAssignments: vi.fn(),
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

vi.mock("@/lib/services/runner-assignment-planning", () => ({
  planRunnerAssignments: mocks.planRunnerAssignments,
  runnerAssignmentPlanningInputSchema: {
    safeParse: mocks.safeParse,
  },
}));

import { POST } from "@/app/api/v1/drylake/runner/plan-assignments/route";

function assignmentRequest() {
  return new Request("http://localhost/api/v1/drylake/runner/plan-assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskPrompt: "Build checkout",
      agents: [
        { agentId: "codex", label: "OpenAI Codex" },
        { agentId: "gemini", label: "Gemini CLI" },
      ],
    }),
  });
}

async function json(response: Response) {
  return response.json() as Promise<{
    ok: boolean;
    assignments?: Array<{
      agentId: string;
      subtaskSummary: string;
      scopeBoundary: string;
    }>;
    modelTier?: "nano" | "foundation";
    error?: {
      code: string;
      message: string;
    };
  }>;
}

beforeEach(() => {
  mocks.getRequestOrganizationId.mockReset();
  mocks.planRunnerAssignments.mockReset();
  mocks.resolveRunbookPlanningAccess.mockReset();
  mocks.safeParse.mockReset();
  mocks.resolveRunbookPlanningAccess.mockResolvedValue({ tier: "foundation", model: "gpt-5.4" });
  mocks.safeParse.mockImplementation((body: unknown) => ({ success: true, data: body }));
});

describe("POST /api/v1/drylake/runner/plan-assignments", () => {
  it("returns unauthorized for unauthenticated requests", async () => {
    mocks.getRequestOrganizationId.mockRejectedValueOnce(new Error("Authentication required"));

    const response = await POST(assignmentRequest());
    const body = await json(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Authentication required",
      },
    });
    expect(mocks.planRunnerAssignments).not.toHaveBeenCalled();
  });

  it("routes free organizations to the nano model and returns modelTier", async () => {
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-free");
    mocks.resolveRunbookPlanningAccess.mockResolvedValueOnce({ tier: "nano", model: "gpt-5.4-nano" });
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          scopeBoundary: "app/api/checkout/**",
        },
        {
          agentId: "gemini",
          subtaskSummary: "Add checkout UI state.",
          scopeBoundary: "components/checkout/**",
        },
      ],
    });

    const response = await POST(assignmentRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          scopeBoundary: "app/api/checkout/**",
        },
        {
          agentId: "gemini",
          subtaskSummary: "Add checkout UI state.",
          scopeBoundary: "components/checkout/**",
        },
      ],
      modelTier: "nano",
    });
    expect(mocks.planRunnerAssignments).toHaveBeenCalledWith(expect.anything(), { model: "gpt-5.4-nano" });
  });

  it("returns successful foundation assignment plans", async () => {
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-pro");
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          scopeBoundary: "app/api/checkout/**",
        },
      ],
    });

    const response = await POST(assignmentRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.modelTier).toBe("foundation");
    expect(body.assignments).toHaveLength(1);
    expect(mocks.resolveRunbookPlanningAccess).toHaveBeenCalledWith("org-pro");
    expect(mocks.planRunnerAssignments).toHaveBeenCalledWith(expect.anything(), { model: "gpt-5.4" });
  });
});
