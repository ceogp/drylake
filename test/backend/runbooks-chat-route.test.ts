import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generatePlanningChatReply: vi.fn(),
  getRequestOrganizationId: vi.fn(),
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
  generatePlanningChatReply: mocks.generatePlanningChatReply,
  runbookPlanningChatInputSchema: {
    safeParse: mocks.safeParse,
  },
}));

import { POST } from "@/app/api/v1/drylake/runbooks/chat/route";

function chatRequest() {
  return new Request("http://localhost/api/v1/drylake/runbooks/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Build checkout",
      mode: "build-app",
      workspaceSummary: "Workspace: test",
      chatTranscript: "User: hello",
    }),
  });
}

async function json(response: Response) {
  return response.json() as Promise<{
    ok: boolean;
    reply?: string;
    modelTier?: "nano" | "foundation";
    proposedRunbook?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

beforeEach(() => {
  mocks.generatePlanningChatReply.mockReset();
  mocks.getRequestOrganizationId.mockReset();
  mocks.resolveRunbookPlanningAccess.mockReset();
  mocks.safeParse.mockReset();
  mocks.resolveRunbookPlanningAccess.mockResolvedValue({ tier: "foundation", model: "gpt-5.4" });
  mocks.safeParse.mockImplementation((body: unknown) => ({ success: true, data: body }));
});

describe("POST /api/v1/drylake/runbooks/chat", () => {
  it("returns unauthorized for unauthenticated requests", async () => {
    mocks.getRequestOrganizationId.mockRejectedValueOnce(new Error("Authentication required"));

    const response = await POST(chatRequest());
    const body = await json(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Authentication required",
      },
    });
    expect(mocks.resolveRunbookPlanningAccess).not.toHaveBeenCalled();
    expect(mocks.generatePlanningChatReply).not.toHaveBeenCalled();
  });

  it("routes strict-mode free organizations to the nano planning model", async () => {
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-free");
    mocks.resolveRunbookPlanningAccess.mockResolvedValueOnce({ tier: "nano", model: "gpt-5.4-nano" });
    mocks.generatePlanningChatReply.mockResolvedValueOnce({ reply: "Use a queue for retries." });

    const response = await POST(chatRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reply: "Use a queue for retries.",
      modelTier: "nano",
    });
    expect(mocks.generatePlanningChatReply).toHaveBeenCalledWith(
      expect.anything(),
      { model: "gpt-5.4-nano" },
    );
  });

  it("returns successful entitled chat replies", async () => {
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-pro");
    mocks.generatePlanningChatReply.mockResolvedValueOnce({ reply: "Use a queue for retries." });

    const response = await POST(chatRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reply: "Use a queue for retries.",
      modelTier: "foundation",
    });
    expect(mocks.resolveRunbookPlanningAccess).toHaveBeenCalledWith("org-pro");
    expect(mocks.generatePlanningChatReply).toHaveBeenCalledWith(
      expect.anything(),
      { model: "gpt-5.4" },
    );
  });

  it("returns proposed runbook updates when planning chat produces one", async () => {
    const proposedRunbook = {
      xu: 1,
      kind: "ApplicationBuildRunbook",
      phases: [{ id: "phase-01", title: "Implement", status: "pending" }],
    };
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-pro");
    mocks.generatePlanningChatReply.mockResolvedValueOnce({
      reply: "I drafted an updated plan for approval.",
      proposedRunbook,
    });

    const response = await POST(chatRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reply: "I drafted an updated plan for approval.",
      proposedRunbook,
      modelTier: "foundation",
    });
  });

  it("preserves sanitized backend AI error messages in the API payload", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-pro");
    mocks.generatePlanningChatReply.mockRejectedValueOnce(
      new Error("Xupra AI is not configured: OPENAI_MODEL is missing."),
    );

    try {
      const response = await POST(chatRequest());
      const body = await json(response);

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
