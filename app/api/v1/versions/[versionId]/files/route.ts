import path from "node:path";

import { ok, created, badRequest, forbidden, internalError, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";
import { readArtifactText } from "@/lib/storage/artifacts";
import { saveArtifactBuffer } from "@/lib/storage/artifacts";
import { normalizeImportLogicalPath } from "@/lib/utils/import-paths";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

function parseLimit(rawValue: string | null) {
  const fallback = 25;

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

function normalizeLogicalPath(rawValue: string) {
  const normalized = normalizeImportLogicalPath(rawValue);
  return normalized || path.basename(rawValue);
}

function canReadTextPreview(file: { mimeType: string; logicalPath: string }) {
  if (file.mimeType.startsWith("text/")) {
    return true;
  }

  const lowerPath = file.logicalPath.toLowerCase();
  return (
    lowerPath.endsWith(".md") ||
    lowerPath.endsWith(".mdc") ||
    lowerPath.endsWith(".txt") ||
    lowerPath.endsWith(".json") ||
    lowerPath.endsWith(".json5") ||
    lowerPath.endsWith(".yaml") ||
    lowerPath.endsWith(".yml") ||
    lowerPath.endsWith(".toml") ||
    lowerPath.endsWith(".py")
  );
}

function toPreviewText(text: string) {
  const maxChars = 1600;
  const trimmed = text.slice(0, maxChars);

  return {
    text: trimmed,
    truncated: text.length > trimmed.length,
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    await requireVersionAccess(versionId);

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind")?.trim() || "raw_source";
    const includePreview = url.searchParams.get("preview") === "1";
    const limit = parseLimit(url.searchParams.get("limit"));

    const files = await prisma.packageFile.findMany({
      where: {
        packageVersionId: versionId,
        kind,
      },
      orderBy: [{ createdAt: "desc" }, { logicalPath: "asc" }],
      take: limit,
    });

    const records = await Promise.all(
      files.map(async (file) => {
        if (!includePreview || !canReadTextPreview(file)) {
          return {
            dbId: file.id,
            logicalPath: file.logicalPath,
            kind: file.kind,
            sourceFormat: file.sourceFormat,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            checksumSha256: file.checksumSha256,
            storageKey: file.storageKey,
            createdAt: file.createdAt.toISOString(),
            previewText: null,
            previewTruncated: false,
            previewError: null,
          };
        }

        try {
          const text = await readArtifactText(file.storageKey);
          const preview = toPreviewText(text);

          return {
            dbId: file.id,
            logicalPath: file.logicalPath,
            kind: file.kind,
            sourceFormat: file.sourceFormat,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            checksumSha256: file.checksumSha256,
            storageKey: file.storageKey,
            createdAt: file.createdAt.toISOString(),
            previewText: preview.text,
            previewTruncated: preview.truncated,
            previewError: null,
          };
        } catch (error) {
          return {
            dbId: file.id,
            logicalPath: file.logicalPath,
            kind: file.kind,
            sourceFormat: file.sourceFormat,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            checksumSha256: file.checksumSha256,
            storageKey: file.storageKey,
            createdAt: file.createdAt.toISOString(),
            previewText: null,
            previewTruncated: false,
            previewError: error instanceof Error ? error.message : "Preview unavailable",
          };
        }
      }),
    );

    return ok({
      source: "postgres_package_file",
      files: records,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to load package files");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const { context: appContext, version } = await requireVersionAccess(versionId);

    const formData = await request.formData();
    const requestedPaths = formData
      .getAll("paths")
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) {
      return badRequest("No files were uploaded");
    }

    const storedFiles = [];

    for (const [index, file] of files.entries()) {
      const logicalPath = normalizeLogicalPath(
        requestedPaths[index] || file.webkitRelativePath || file.name || path.basename(file.name),
      );
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
