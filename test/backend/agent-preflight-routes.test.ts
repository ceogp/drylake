import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerTrialAgent: vi.fn(),
  runAgentPreflight: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "http://localhost:3000",
    APP_ENCRYPTION_KEY: "test-encryption-key-0000000000000000",
    OPENAI_FREE_MODEL: "gpt-test",
  },
}));

vi.mock("@/lib/services/agent-preflight", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/agent-preflight")>(
    "@/lib/services/agent-preflight",
  );

  return {
    ...actual,
    registerTrialAgent: mocks.registerTrialAgent,
    runAgentPreflight: mocks.runAgentPreflight,
  };
});

import { GET as agentCard } from "@/app/.well-known/agent-card.json/route";
import { POST as registerAgent } from "@/app/api/agents/register/route";
import { POST as preflight } from "@/app/api/preflight/route";

function jsonRequest(path: string, body: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent preflight routes", () => {
  it("registers a trial agent", async () => {
    mocks.registerTrialAgent.mockResolvedValue({
      status: "registered",
      agent_id: "ag_123",
      agent_token: "dlk_trial_secret",
      plan: "agent_trial",
      free_credits: 3,
      expires_in_hours: 72,
      price_per_basic_preflight_usd: 1,
      buy_credits_url: "http://localhost:3000/agent-billing/ag_123",
    });

    const response = await registerAgent(jsonRequest("/api/agents/register", {
      source_client: "cursor",
      agent_name: "Cursor",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(expect.objectContaining({
      ok: true,
      status: "registered",
      agent_id: "ag_123",
      free_credits: 3,
    }));
  });

  it("returns payment_required from preflight when credits are exhausted", async () => {
    mocks.runAgentPreflight.mockResolvedValue({
      status: "payment_required",
      message: "DryLake Agent Preflight costs 1 credit.",
      buy_credits_url: "http://localhost:3000/agent-billing/ag_123",
      credit_packs: [{ price_usd: 10, credits: 10 }],
    });

    const response = await preflight(jsonRequest("/api/preflight", {
      task: "Build password reset",
      source_client: "cursor",
      tier: "basic",
    }, {
      Authorization: "Bearer dlk_trial_secret",
    }));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toEqual(expect.objectContaining({
      ok: false,
      status: "payment_required",
      buy_credits_url: "http://localhost:3000/agent-billing/ag_123",
    }));
  });

  it("publishes a discoverable A2A agent card", async () => {
    const response = await agentCard();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("DryLake Agent Preflight");
    expect(body.url).toContain("/api/preflight");
    expect(body.skills.map((skill: { id: string }) => skill.id)).toEqual(expect.arrayContaining([
      "agent_preflight",
      "validated_preflight",
      "create_handoff",
    ]));
  });
});
