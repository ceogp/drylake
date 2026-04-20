import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";
import { assertEntitlement } from "@/lib/services/entitlements";
import { requestExportPreview } from "@/lib/services/import-export";
import { readArtifactText } from "@/lib/storage/artifacts";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

const querySchema = z.object({
  targetPlatform: z.enum(["codex", "claude_code", "claude_agents", "cursor"]),
  ensureGenerated: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

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
    await assertEntitlement(access.context.organization.id, "manual_export");

    if (parsed.data.ensureGenerated) {
      await requestExportPreview({
        versionId,
        targetPlatform: parsed.data.targetPlatform,
        createdByUserId: access.context.user.id,
      });
    }

    const prefix = `${parsed.data.targetPlatform}/`;
    const files = (
      await prisma.packageFile.findMany({
        where: {
          packageVersionId: versionId,
          kind: "generated_export",
        },
        orderBy: { logicalPath: "asc" },
      })
    ).filter((file) => file.logicalPath.startsWith(prefix));

    const generatedFiles = await Promise.all(
      files.map(async (file) => ({
        id: file.id,
        logicalPath: file.logicalPath.slice(prefix.length),
        targetPlatform: parsed.data.targetPlatform,
        storedLogicalPath: file.logicalPath,
        preview: await readArtifactText(file.storageKey),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
      })),
    );

    return ok({
      targetPlatform: parsed.data.targetPlatform,
      generatedFiles,
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
    return internalError("Failed to list generated export files");
  }
}
