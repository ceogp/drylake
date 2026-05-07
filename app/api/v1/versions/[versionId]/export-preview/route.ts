import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireVersionAccess } from "@/lib/services/access";
import { assertEntitlement } from "@/lib/services/entitlements";
import { EXPORT_TARGETS, requestExportPreview, type SupportedTarget } from "@/lib/services/import-export";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const exportSchema = z.object({
  targetPlatform: z.enum([...EXPORT_TARGETS] as unknown as [string, ...string[]]),
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
    await assertEntitlement(appContext.organization.id, "manual_export");

    const result = await requestExportPreview({
      versionId,
      targetPlatform: parsed.data.targetPlatform as SupportedTarget,
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

    if (error instanceof Error && error.message === "Organization is not entitled to use manual_export") {
      return forbidden("Manual export requires a paid plan.");
    }

    console.error(error);
    return internalError("Failed to build export preview");
  }
}
