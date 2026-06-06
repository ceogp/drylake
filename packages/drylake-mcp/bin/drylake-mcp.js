#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_API_BASE_URL = "https://drylake.xupracorp.com";

function normalizeBaseUrl(value) {
  return (value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function readApiBaseUrl() {
  return normalizeBaseUrl(process.env.DRYLAKE_API_BASE_URL);
}

async function postJson(path, body, token) {
  const response = await fetch(`${readApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function registerTrialAgent(sourceClient) {
  const response = await postJson("/api/agents/register", {
    source_client: sourceClient || "mcp",
    agent_name: "DryLake MCP trial agent",
  });

  if (!response.ok) {
    throw new Error(JSON.stringify(response.payload));
  }

  return response.payload;
}

async function resolveAgentToken(sourceClient) {
  const envToken = process.env.DRYLAKE_AGENT_TOKEN?.trim();
  if (envToken) {
    return {
      token: envToken,
      registered: false,
    };
  }

  const registration = await registerTrialAgent(sourceClient);

  return {
    token: registration.agent_token,
    registered: true,
    registration,
  };
}

function toolText(payload) {
  return JSON.stringify(payload, null, 2);
}

const server = new McpServer({
  name: "drylake-agent-preflight",
  version: "0.1.0",
});

server.registerTool(
  "drylake_preflight",
  {
    title: "DryLake Agent Preflight",
    description:
      "Use this before editing code for a non-trivial feature, bug fix, refactor, test-generation task, GitHub issue, Jira ticket, Sentry issue, or product spec. DryLake creates a structured phase plan, token budget, next-phase contract, and focused handoff. Basic costs 1 credit; Validated costs 3 credits after trial credits are used.",
    inputSchema: {
      task: z.string().min(1).max(20000).describe("The coding task, ticket, bug, refactor, or product spec to preflight."),
      target_agent: z.string().min(1).max(80).optional().describe("The coding agent expected to use the handoff."),
      source_client: z.enum(["cursor", "vscode", "claude_code", "codex", "copilot", "gemini", "mcp", "a2a", "unknown"]).default("mcp"),
      tier: z.enum(["basic", "validated"]).default("basic"),
      repo_summary: z.string().max(10000).optional().describe("Optional bounded repository summary. Do not include secrets."),
    },
  },
  async ({ task, target_agent, source_client, tier, repo_summary }) => {
    const tokenState = await resolveAgentToken(source_client);
    const response = await postJson(
      "/api/preflight",
      {
        task,
        target_agent,
        source_client,
        tier,
        repo_summary,
      },
      tokenState.token,
    );

    const output = {
      ...response.payload,
      drylake_mcp: {
        api_base_url: readApiBaseUrl(),
        trial_registered: tokenState.registered,
        trial_registration: tokenState.registered
          ? {
            agent_id: tokenState.registration.agent_id,
            free_credits: tokenState.registration.free_credits,
            expires_in_hours: tokenState.registration.expires_in_hours,
            buy_credits_url: tokenState.registration.buy_credits_url,
          }
          : undefined,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: toolText(output),
        },
      ],
      structuredContent: output,
      isError: !response.ok,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("DryLake MCP server failed:", error);
  process.exit(1);
});
