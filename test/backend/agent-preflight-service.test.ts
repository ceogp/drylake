import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateAiText: vi.fn(),
  prisma: {
    agentToken: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    agentPreflightRun: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "http://localhost:3000",
    APP_ENCRYPTION_KEY: "test-encryption-key-0000000000000000",
    OPENAI_FREE_MODEL: "gpt-test",
  },
}));

vi.mock("@/lib/services/ai-text", () => ({
  generateAiText: mocks.generateAiText,
}));

import {
  registerTrialAgent,
  runAgentPreflight,
} from "@/lib/services/agent-preflight";

const aiPreflightResponse = {
  title: "Add password reset flow",
  summary: "Plan the password reset flow before implementation.",
  phases: [
    {
      id: "phase-1",
      title: "Inspect auth flow",
      objective: "Understand current login and user account paths.",
      steps: ["Read auth routes.", "Identify token storage.", "Document reset requirements."],
      acceptance: ["Existing auth flow is summarized."],
      risks: ["Missing current auth context."],
    },
    {
      id: "phase-2",
      title: "Implement reset token path",
      objective: "Add safe reset token request and validation.",
      steps: ["Add request endpoint.", "Add validation endpoint."],
      acceptance: ["Reset token API exists."],
      risks: ["Token expiry must be enforced."],
    },
  ],
  token_budget: {
    estimated_original_tokens: 1200,
    estimated_handoff_tokens: 450,
    compression_ratio: 0.37,
  },
  next_phase_contract: {
    phase_id: "phase-1",
    objective: "Understand current login and user account paths.",
    allowed_scope: ["Read-only auth inspection."],
    exit_criteria: ["Auth flow summary is complete."],
  },
  handoff: {
    target_agent: "cursor",
    prompt: "Inspect the auth flow and summarize the current login/reset assumptions.",
  },
  assurance: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.agentToken.count.mockResolvedValue(0);
  mocks.prisma.agentToken.create.mockImplementation(async ({ data }) => ({
    id: "agent-token-db-id",
    externalId: data.externalId,
    plan: data.plan,
  }));
  mocks.prisma.agentToken.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.agentToken.update.mockResolvedValue({});
  mocks.prisma.agentPreflightRun.create.mockResolvedValue({
    id: "preflight-123",
  });
  mocks.generateAiText.mockResolvedValue(JSON.stringify(aiPreflightResponse));
});

describe("agent preflight service", () => {
  it("registers a trial agent and stores only a token hash", async () => {
    const result = await registerTrialAgent({
      source_client: "cursor",
      agent_name: "Cursor MacBook",
    }, "203.0.113.10");

    expect(result.status).toBe("registered");
    expect(result.agent_id).toMatch(/^ag_/);
    expect(result.agent_token).toMatch(/^dlk_trial_/);
    expect(result.free_credits).toBe(3);
    expect(mocks.prisma.agentToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalId: result.agent_id,
        name: "Cursor MacBook",
        sourceClient: "cursor",
        tokenHash: expect.any(String),
        tokenPrefix: result.agent_token.slice(0, 18),
        balanceCredits: 3,
      }),
    });
    expect(mocks.prisma.agentToken.create.mock.calls[0][0].data.tokenHash).not.toBe(result.agent_token);
  });

  it("debits one trial credit and records a basic preflight run", async () => {
    mocks.prisma.agentToken.findUnique.mockResolvedValue({
      id: "agent-token-db-id",
      externalId: "ag_test",
      organizationId: null,
      status: "trial",
      balanceCredits: 3,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    const result = await runAgentPreflight("dlk_trial_secret", {
      task: "Add password reset to login flow",
      target_agent: "cursor",
      source_client: "cursor",
      tier: "basic",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected successful preflight result");
    }
    expect(result.remaining_credits).toBe(2);
    expect(result.credits_debited).toBe(1);
    expect(mocks.prisma.agentToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        balanceCredits: { decrement: 1 },
        freeCreditsUsed: { increment: 1 },
      }),
    }));
    expect(mocks.prisma.agentPreflightRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentTokenId: "agent-token-db-id",
        tier: "basic",
        targetAgent: "cursor",
        title: "Add password reset flow",
        creditsDebited: 1,
        taskHash: expect.any(String),
        taskPreview: "Add password reset to login flow",
      }),
    });
  });

  it("returns payment_required when credits are exhausted", async () => {
    mocks.prisma.agentToken.findUnique.mockResolvedValue({
      id: "agent-token-db-id",
      externalId: "ag_empty",
      organizationId: null,
      status: "trial",
      balanceCredits: 0,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    const result = await runAgentPreflight("dlk_trial_empty", {
      task: "Build checkout",
      source_client: "mcp",
      tier: "basic",
    });

    expect(result.status).toBe("payment_required");
    if (result.status !== "payment_required") {
      throw new Error("Expected payment_required preflight result");
    }
    expect(result.buy_credits_url).toContain("/agent-billing/ag_empty");
    expect(mocks.generateAiText).not.toHaveBeenCalled();
    expect(mocks.prisma.agentPreflightRun.create).not.toHaveBeenCalled();
  });
});
