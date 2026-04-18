import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireVersionAccess } from "@/lib/services/access";
import { requestImportForVersion } from "@/lib/services/import-export";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const importSchema = z.object({
  mode: z.enum(["auto"]).default("auto"),
  sourcePlatform: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const { context: appContext } = await requireVersionAccess(versionId);

    const result = await requestImportForVersion({
      versionId,
      sourcePlatform: parsed.data.sourcePlatform,
      createdByUserId: appContext.user.id,
    });

    return created({
      job: {
        id: result.job.id,
        status: result.job.status,
      },
      imported: "imported" in result ? result.imported : undefined,
      warnings: "warnings" in result ? result.warnings : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to import files into package version");
  }
}
