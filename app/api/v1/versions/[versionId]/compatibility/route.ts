import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireVersionAccess } from "@/lib/services/access";
import { EXPORT_TARGETS, requestCompatibilityCheck, type SupportedTarget } from "@/lib/services/import-export";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const compatibilitySchema = z.object({
  targetPlatform: z.enum([...EXPORT_TARGETS] as unknown as [string, ...string[]]),
});

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = await request.json();
    const parsed = compatibilitySchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext } = await requireVersionAccess(versionId);

    const result = await requestCompatibilityCheck({
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
      result: "result" in result ? result.result : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to run compatibility check");
  }
}
