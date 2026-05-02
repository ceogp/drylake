import { forbidden, internalError, ok, unauthorized } from "@/lib/api/http";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { requireVersionAccess } from "@/lib/services/access";
import { getCanonicalizationResult } from "@/lib/services/canonicalize";
import { hasEntitlement } from "@/lib/services/entitlements";

type Context = {
  params: Promise<{
    versionId: string;
  }>;
};

function readErrorMessage(value: unknown) {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { message?: unknown }).message === "string"
    ? (value as { message: string }).message
    : null;
}

export async function GET(_: Request, context: Context) {
  try {
    const { versionId } = await context.params;
    const access = await requireVersionAccess(versionId);
    const [isPro, sourceFileCount, canonicalItemCounts, canonicalization] = await Promise.all([
      hasEntitlement(access.context.organization.id, "manual_export"),
      prisma.packageFile.count({
        where: {
          packageVersionId: versionId,
          kind: "raw_source",
        },
      }),
      Promise.all([
        prisma.subagent.count({ where: { packageVersionId: versionId } }),
        prisma.skillRule.count({ where: { packageVersionId: versionId } }),
      ]),
      getCanonicalizationResult(versionId),
    ]);
    const hasSucceededCanonicalization = Boolean(canonicalization.lastSucceededJob);
    const canonicalizationStatus =
      hasSucceededCanonicalization
        ? "succeeded"
        : canonicalization.lastFailedJob
          ? "failed"
          : "none";

    return ok({
      versionId,
      organizationId: access.context.organization.id,
      billingProvider: env.BILLING_PROVIDER,
      isPro,
      hasSourceFiles: sourceFileCount > 0,
      sourceFileCount,
      canonicalItemCount: canonicalItemCounts[0] + canonicalItemCounts[1],
      canonicalizationStatus,
      canonicalizationResult: canonicalization.result
        ? {
            confidence: canonicalization.result.confidence,
            warnings: canonicalization.result.warnings,
            summary: canonicalization.result.summary,
            itemCount: canonicalization.result.itemCount,
            agentCount: canonicalization.result.agentCount,
            skillCount: canonicalization.result.skillCount,
          }
        : null,
      canonicalizationError: readErrorMessage(canonicalization.lastFailedJob?.errorJson),
      extensionConnected: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have access to that package version.");
    }

    console.error(error);
    return internalError("Failed to load install status");
  }
}
