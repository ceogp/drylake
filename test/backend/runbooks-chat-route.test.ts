import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertEntitlement: vi.fn(),
  generatePlanningChatReply: vi.fn(),
  getRequestOrganizationId: vi.fn(),
  safeParse: vi.fn(),
}));

vi.mock("@/lib/services/entitlements", () => ({
  assertEntitlement: mocks.assertEntitlement,
}));

vi.mock("@/lib/services/request-organization", () => ({
  INVALID_EXTENSION_TOKEN_ERROR: "Invalid extension token",
  REQUEST_AUTHENTICATION_REQUIRED_ERROR: "Authentication required",
  getRequestOrganizationId: mocks.getRequestOrganizationId,
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
    error?: {
      code: string;
      message: string;
    };
  }>;
}

beforeEach(() => {
  mocks.assertEntitlement.mockReset();
  mocks.generatePlanningChatReply.mockReset();
  mocks.getRequestOrganizationId.mockReset();
  mocks.safeParse.mockReset();
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
    expect(mocks.assertEntitlement).not.toHaveBeenCalled();
    expect(mocks.generatePlanningChatReply).not.toHaveBeenCalled();
  });

  it("returns forbidden for strict-mode organizations without Xupra AI entitlement", async () => {
    mocks.getRequestOrganizationId.mockResolvedValueOnce("org-free");
    mocks.assertEntitlement.mockRejectedValueOnce(
      new Error("Organization is not entitled to use xupra_pro_ai"),
    );

    const response = await POST(chatRequest());
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "Xupra AI requires a Pro plan.",
      },
    });
    expect(mocks.generatePlanningChatReply).not.toHaveBeenCalled();
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
    });
    expect(mocks.assertEntitlement).toHaveBeenCalledWith("org-pro", "xupra_pro_ai");
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
