import {
  forbidden,
  internalError,
  ok,
  unauthorized,
  unprocessableEntity,
} from "@/lib/api/http";
import { requireVersionAccess } from "@/lib/services/access";
import {
  CanonicalizationForbiddenError,
  CanonicalizationNoSourceFilesError,
  canonicalizeVersion,
} from "@/lib/services/canonicalize";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { force?: unknown };
    const access = await requireVersionAccess(versionId);
    const result = await canonicalizeVersion({
      versionId,
      createdByUserId: access.context.user.id,
      force: body.force === true,
    });

    return ok({
      job: {
        id: result.job.id,
        status: result.job.status,
      },
      confidence: result.result.confidence,
      warnings: result.result.warnings,
      summary: result.result.summary,
      itemCount: result.result.itemCount,
      agentCount: result.result.agentCount,
      skillCount: result.result.skillCount,
      alreadyDone: result.alreadyDone,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    if (error instanceof CanonicalizationForbiddenError) {
      return forbidden(error.message);
    }

    if (error instanceof CanonicalizationNoSourceFilesError) {
      return unprocessableEntity(error.message);
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to canonicalize source files");
  }
}
