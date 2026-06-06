import { NextResponse } from "next/server";

import { created, fromZodError, internalError } from "@/lib/api/http";
import {
  AgentPreflightError,
  agentRegistrationInputSchema,
  getRequestIp,
  registerTrialAgent,
} from "@/lib/services/agent-preflight";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = agentRegistrationInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const registration = await registerTrialAgent(parsed.data, getRequestIp(request));

    return created(registration);
  } catch (error) {
    if (error instanceof AgentPreflightError && error.code === "rate_limited") {
      return NextResponse.json(
        {
          ok: false,
          status: "rate_limited",
          error: {
            code: "rate_limited",
            message: error.message,
          },
        },
        { status: 429 },
      );
    }

    console.error(error);
    return internalError("Failed to register DryLake trial agent");
  }
}
