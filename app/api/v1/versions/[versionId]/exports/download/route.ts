import { z } from "zod";

import { forbidden, fromZodError, internalError, notFound, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";
import { assertEntitlement } from "@/lib/services/entitlements";
import { EXPORT_TARGETS, requestExportPreview, type SupportedTarget } from "@/lib/services/import-export";
import { readArtifactText } from "@/lib/storage/artifacts";
import { createZipArchive } from "@/lib/utils/zip";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const querySchema = z.object({
  targetPlatform: z.enum(["all", ...EXPORT_TARGETS] as unknown as [string, ...string[]]),
  ensureGenerated: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const allTargetPlatforms = EXPORT_TARGETS;

export async function GET(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      targetPlatform: url.searchParams.get("targetPlatform"),
      ensureGenerated: url.searchParams.get("ensureGenerated") ?? undefined,
    });

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const access = await requireVersionAccess(versionId);
    await assertEntitlement(access.context.organization.id, "xupra_pro_ai");

    const targetPlatforms =
      parsed.data.targetPlatform === "all" ? allTargetPlatforms : [parsed.data.targetPlatform];

    if (parsed.data.ensureGenerated) {
      await Promise.all(
        targetPlatforms.map((targetPlatform) =>
          requestExportPreview({
            versionId,
            targetPlatform: targetPlatform as SupportedTarget,
            createdByUserId: access.context.user.id,
          }),
        ),
      );
    }

    const files = (
      await prisma.packageFile.findMany({
        where: {
          packageVersionId: versionId,
          kind: "generated_export",
        },
        orderBy: { logicalPath: "asc" },
      })
    ).filter((file) =>
      targetPlatforms.some((targetPlatform) => file.logicalPath.startsWith(`${targetPlatform}/`)),
    );

    if (files.length === 0) {
      return notFound("No generated files are available for that target.");
    }

    const archive = createZipArchive(
      await Promise.all(
        files.map(async (file) => ({
          path:
            parsed.data.targetPlatform === "all"
              ? file.logicalPath
              : file.logicalPath.slice(`${parsed.data.targetPlatform}/`.length),
          content: await readArtifactText(file.storageKey),
        })),
      ),
    );
    const filename =
      parsed.data.targetPlatform === "all"
        ? "xupra-all-supported-files.zip"
        : `xupra-${parsed.data.targetPlatform}-files.zip`;

    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    if (error instanceof Error && error.message === "Organization is not entitled to use xupra_pro_ai") {
      return forbidden("This feature requires a Pro plan.");
    }

    console.error(error);
    return internalError("Failed to download generated files");
  }
}
