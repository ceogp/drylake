import { NextResponse } from "next/server";

import { forbidden, internalError, unauthorized } from "@/lib/api/http";
import { requireCurrentAppContext } from "@/lib/services/current-user";
import {
  fetchSkillsMarketplaceJson,
  SkillsMarketplaceRequestError,
} from "@/lib/services/skills-marketplace";

export async function proxySkillsMarketplace<T>(pathname: string) {
  try {
    await requireCurrentAppContext();
    const payload = await fetchSkillsMarketplaceJson<T>(pathname);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden();
    }

    if (error instanceof SkillsMarketplaceRequestError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "skills_marketplace_request_failed",
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    console.error(error);
    return internalError("Failed to load skills marketplace data.");
  }
}
