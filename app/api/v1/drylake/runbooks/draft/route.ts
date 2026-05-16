import { NextResponse } from "next/server";

import { forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { assertEntitlement } from "@/lib/services/entitlements";
import {
  buildRunbookDraftPrompt,
  generateRunbookContent,
  runbookGenerationInputSchema,
} from "@/lib/services/runbook-generation";
import {
  getRequestOrganizationId,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = runbookGenerationInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const organizationId = await getRequestOrganizationId(request);

    try {
      await assertEntitlement(organizationId, "xupra_pro_ai");
    } catch (error) {
      if (error instanceof Error && error.message === "Organization is not entitled to use xupra_pro_ai") {
        return forbidden("Xupra Pro AI requires a Pro plan.");
      }

      throw error;
    }

    const result = await generateRunbookContent({
      input: parsed.data,
      taskLabel: "runbook draft",
      buildPrompt: buildRunbookDraftPrompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to generate DryLake runbook draft");
  }
}