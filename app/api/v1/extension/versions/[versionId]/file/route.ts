import { NextResponse } from "next/server";

import { internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { getCurrentAppContext } from "@/lib/services/current-user";
import {
  EXTENSION_TOKEN_HEADER,
  verifyExtensionAccessToken,
} from "@/lib/services/extension-tokens";
import { readArtifactText } from "@/lib/storage/artifacts";

export const runtime = "nodejs";

async function getRequestOrganizationId(request: Request): Promise<string | null> {
  const token = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (token) {
    const session = await verifyExtensionAccessToken(token);
    if (!session) return null;

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: session.userId, organizationId: session.organizationId },
      select: { organizationId: true },
    });

    return membership?.organizationId ?? null;
  }

  const appContext = await getCurrentAppContext();
  return appContext?.organization.id ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  try {
    const organizationId = await getRequestOrganizationId(request);
    if (!organizationId) {
      return unauthorized();
    }

    const { versionId } = await context.params;
    const url = new URL(request.url);
    const logicalPath = url.searchParams.get("logicalPath");

    if (!logicalPath) {
      return NextResponse.json(
        { ok: false, error: "logicalPath query param is required" },
        { status: 400 },
      );
    }

    const version = await prisma.packageVersion.findFirst({
      where: {
        id: versionId,
        agentPackage: { project: { organizationId } },
      },
      select: { id: true },
    });

    if (!version) {
      return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
    }

    const file = await prisma.packageFile.findFirst({
      where: {
        packageVersionId: version.id,
        logicalPath,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!file) {
      return NextResponse.json({ ok: false, error: "File not found in this version" }, { status: 404 });
    }

    let content = "";
    try {
      content = await readArtifactText(file.storageKey);
    } catch (error) {
      console.error("[extension/versions/file] failed to read artifact", {
        storageKey: file.storageKey,
        error,
      });
      return internalError("Failed to read file content");
    }

    return ok({
      logicalPath: file.logicalPath,
      kind: file.kind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      content,
    });
  } catch (error) {
    console.error("[extension/versions/file] GET failed", error);
    return internalError("Failed to fetch version file");
  }
}
