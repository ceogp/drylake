import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireVersionAccess } from "@/lib/services/access";
import { requestExportPreview } from "@/lib/services/import-export";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const exportSchema = z.object({
  targetPlatform: z.enum(["codex", "claude_code", "claude_agents", "cursor"]),
});

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = await request.json();
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext } = await requireVersionAccess(versionId);

    const result = await requestExportPreview({
      versionId,
      targetPlatform: parsed.data.targetPlatform,
      createdByUserId: appContext.user.id,
    });

    return created({
      job: {
        id: result.job.id,
        status: result.job.status,
        targetPlatform: parsed.data.targetPlatform,
      },
      compatibility: "compatibility" in result ? result.compatibility : undefined,
      generatedFiles:
        "generatedFiles" in result
          ? result.generatedFiles.map((file) => ({
              logicalPath: file.logicalPath,
              preview: file.preview,
            }))
          : [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to build export preview");
  }
}
