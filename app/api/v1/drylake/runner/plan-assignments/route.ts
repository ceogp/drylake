import { fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import {
  planRunnerAssignments,
  runnerAssignmentPlanningInputSchema,
} from "@/lib/services/runner-assignment-planning";
import { resolveRunbookPlanningAccess } from "@/lib/services/runbook-planning-access";
import {
  getRequestOrganizationId,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = runnerAssignmentPlanningInputSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const organizationId = await getRequestOrganizationId(request);
    const access = await resolveRunbookPlanningAccess(organizationId);
    const result = await planRunnerAssignments(parsed.data, { model: access.model });

    return ok({ ...result, modelTier: access.tier });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to plan DryLake runner assignments");
  }
}
