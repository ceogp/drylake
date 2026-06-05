import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestOrganizationContext: vi.fn(),
  recordExtensionUsageEvent: vi.fn(),
}));

vi.mock("@/lib/services/request-organization", () => ({
  INVALID_EXTENSION_TOKEN_ERROR: "Invalid extension token",
  REQUEST_AUTHENTICATION_REQUIRED_ERROR: "Authentication required",
  getRequestOrganizationContext: mocks.getRequestOrganizationContext,
}));

vi.mock("@/lib/services/extension-usage-events", async () => {
  const { z } = await import("zod");
  const optionalText = (maxLength: number) => z.string().trim().min(1).max(maxLength).optional();
  return {
    extensionUsageEventInputSchema: z.object({
      eventName: z.string().trim().min(1).max(80),
      sessionId: optionalText(128),
      workspaceHash: optionalText(128),
      phaseId: optionalText(120),
      phaseTitle: optionalText(240),
      agentId: optionalText(80),
      skillLogicalPath: optionalText(500),
      actionType: optionalText(80),
      launchStatus: optionalText(80),
      reasonCode: optionalText(120),
      promptEstimatedTokens: z.number().int().min(0).max(100_000_000).optional(),
      promptKind: optionalText(80),
      promptText: z.string().trim().min(1).max(500_000).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict(),
    recordExtensionUsageEvent: mocks.recordExtensionUsageEvent,
  };
});

import { POST } from "@/app/api/v1/extension/usage-events/route";

function usageEventRequest(body: unknown) {
  return new Request("http://localhost/api/v1/extension/usage-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.getRequestOrganizationContext.mockReset();
  mocks.recordExtensionUsageEvent.mockReset();
  mocks.getRequestOrganizationContext.mockResolvedValue({
    organizationId: "org-123",
    userId: "user-123",
  });
  mocks.recordExtensionUsageEvent.mockResolvedValue({
    id: "event-123",
    createdAt: new Date("2026-06-03T00:00:00.000Z"),
  });
});

describe("POST /api/v1/extension/usage-events", () => {
  it("records bounded extension usage metadata for an authenticated user", async () => {
    const response = await POST(usageEventRequest({
      eventName: "phase_handoff_launched",
      sessionId: "session-1",
      workspaceHash: "workspace-hash",
      phaseId: "P-01",
      phaseTitle: "Discovery",
      agentId: "codex",
      skillLogicalPath: ".codex/skills/token-reduction/SKILL.md",
      actionType: "run",
      launchStatus: "launched",
      promptEstimatedTokens: 1280,
      promptKind: "phase_handoff",
      promptText: "Implement the checkout route with a fake secret sk-test-secret.",
      metadata: {
        completionMode: "handoff_launch",
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      ok: true,
      event: {
        id: "event-123",
        createdAt: "2026-06-03T00:00:00.000Z",
      },
    });
    expect(mocks.recordExtensionUsageEvent).toHaveBeenCalledWith({
      organizationId: "org-123",
      actorUserId: "user-123",
      event: expect.objectContaining({
        eventName: "phase_handoff_launched",
        agentId: "codex",
        skillLogicalPath: ".codex/skills/token-reduction/SKILL.md",
        promptEstimatedTokens: 1280,
        promptKind: "phase_handoff",
        promptText: "Implement the checkout route with a fake secret sk-test-secret.",
      }),
    });
  });

  it("rejects invalid usage event payloads", async () => {
    const response = await POST(usageEventRequest({
      eventName: "",
      promptEstimatedTokens: -1,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("bad_request");
    expect(mocks.recordExtensionUsageEvent).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the extension session is invalid", async () => {
    mocks.getRequestOrganizationContext.mockRejectedValueOnce(new Error("Invalid extension token"));

    const response = await POST(usageEventRequest({
      eventName: "phase_handoff_launched",
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "The extension token is invalid or expired. Connect the extension again.",
      },
    });
    expect(mocks.recordExtensionUsageEvent).not.toHaveBeenCalled();
  });
});
