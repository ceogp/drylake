import path from "node:path";

import { created, badRequest, forbidden, internalError, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";
import { saveArtifactBuffer } from "@/lib/storage/artifacts";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const { context: appContext, version } = await requireVersionAccess(versionId);

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) {
      return badRequest("No files were uploaded");
    }

    const storedFiles = [];

    for (const file of files) {
      const logicalPath = file.webkitRelativePath || file.name || path.basename(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const artifact = await saveArtifactBuffer({
        versionId,
        kind: "raw_source",
        logicalPath,
        buffer,
        mimeType: file.type || undefined,
      });

      const packageFile = await prisma.packageFile.upsert({
        where: {
          packageVersionId_kind_logicalPath: {
            packageVersionId: versionId,
            kind: "raw_source",
            logicalPath,
          },
        },
        update: {
          storageKey: artifact.storageKey,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          checksumSha256: artifact.checksumSha256,
          sourceFormat: path.extname(logicalPath).replace(".", "") || "text",
        },
        create: {
          packageVersionId: versionId,
          kind: "raw_source",
          logicalPath,
          storageKey: artifact.storageKey,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          checksumSha256: artifact.checksumSha256,
          sourceFormat: path.extname(logicalPath).replace(".", "") || "text",
        },
      });

      storedFiles.push(packageFile);
    }

    const manifest = (version.manifestJson as Record<string, unknown>) ?? {};

    await prisma.packageVersion.update({
      where: { id: versionId },
      data: {
        rawSnapshotPrefix: `versions/${versionId}/raw_source`,
        manifestJson: {
          ...manifest,
          lastUploadedAt: new Date().toISOString(),
          uploadedBy: appContext.user.email,
        },
      },
    });

    return created({ files: storedFiles });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to upload files");
  }
}
