import { internalError, notFound, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function GET(_request: Request, context: RouteContext<"/api/v1/guard/cloud-analysis/[id]">) {
  try {
    const [{ id }, authContext] = await Promise.all([
      context.params,
      getRequestOrganizationContext(_request),
    ]);
    const job = await prisma.cloudAnalysisJob.findFirst({
      where: {
        id,
        organizationId: authContext.organizationId,
      },
    });

    if (!job) {
      return notFound("Cloud analysis job not found.");
    }

    return ok({
      job: {
        id: job.id,
        guardScanId: job.guardScanId,
        status: job.status,
        result: job.resultJson,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to load cloud analysis job");
  }
}
