import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    name: "DryLake Agent Preflight",
    description:
      "Structured planning, token budgeting, phase contracts, focused handoffs, and assurance checklists for coding agents before they modify code.",
    version: "0.1.0",
    provider: {
      organization: "Xupra",
      url: "https://xupracorp.com",
    },
    url: `${env.APP_BASE_URL}/api/preflight`,
    documentationUrl: `${env.APP_BASE_URL}/drylake/mcp`,
    authentication: {
      schemes: ["Bearer"],
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "agent_preflight",
        name: "Agent Preflight",
        description:
          "Turn a feature, bug, issue, refactor, or product spec into a structured phase plan before a coding agent starts work.",
        tags: ["coding-agents", "planning", "token-budget", "handoff"],
      },
      {
        id: "validated_preflight",
        name: "Validated Preflight",
        description:
          "Add risk classification, test checklist, rollback plan, dependency impact review, and a validation phase to the planning handoff.",
        tags: ["assurance", "validation", "rollback", "security"],
      },
      {
        id: "create_handoff",
        name: "Create Agent Handoff",
        description:
          "Generate a focused handoff prompt for Claude Code, Codex, Cursor, Copilot, Gemini, Cline, or another coding agent.",
        tags: ["handoff", "cursor", "claude-code", "codex", "copilot"],
      },
    ],
    pricing: {
      trial: "3 free Basic Preflight credits per trial agent token.",
      basic_preflight_credits: 1,
      validated_preflight_credits: 3,
    },
  });
}
