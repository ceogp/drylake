import { NextResponse } from "next/server";

import { fromZodError, internalError, unauthorized } from "@/lib/api/http";
import {
  AgentPreflightError,
  extractBearerToken,
  getAgentRegisterUrl,
  preflightInputSchema,
  runAgentPreflight,
} from "@/lib/services/agent-preflight";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = preflightInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const token = extractBearerToken(request);
    if (!token) {
      return unauthorized("DryLake Agent Preflight requires a bearer agent token. Register a trial agent first.");
    }

    const result = await runAgentPreflight(token, parsed.data);

    if (result.status === "payment_required") {
      return NextResponse.json({ ok: false, ...result }, { status: 402 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AgentPreflightError) {
      if (error.code === "agent_token_expired") {
        return NextResponse.json(
          {
            ok: false,
            status: "agent_token_expired",
            message: error.message,
            register_url: getAgentRegisterUrl(),
          },
          { status: 401 },
        );
      }

      if (error.code === "agent_token_invalid" || error.code === "agent_token_missing") {
        return NextResponse.json(
          {
            ok: false,
            status: error.code,
            message: error.message,
            register_url: getAgentRegisterUrl(),
          },
          { status: 401 },
        );
      }
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to create DryLake Agent Preflight");
  }
}
