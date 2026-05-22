import { z } from "zod";

import {
  badRequest,
  created,
  forbidden,
  fromZodError,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api/http";
import { requireCurrentAppContext } from "@/lib/services/current-user";
import { approveExtensionAuthRequest } from "@/lib/services/extension-auth-requests";

const payloadSchema = z.object({
  requestId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await requireCurrentAppContext();
    const approval = await approveExtensionAuthRequest({
      requestId: parsed.data.requestId,
      userId: context.user.id,
      organizationId: context.organization.id,
    });

    if (approval.kind === "not_found") {
      return notFound("The editor connection request no longer exists.");
    }

    if (approval.kind === "expired") {
      return badRequest("The editor connection request expired. Start again from the editor.");
    }

    if (approval.kind === "consumed") {
      return badRequest("This editor connection was already completed.");
    }

    if (approval.kind === "denied") {
      return badRequest("This editor connection was denied and cannot be approved.");
    }

    if (approval.kind === "forbidden") {
      return forbidden(approval.message);
    }

    return created({
      status: approval.kind,
      approvedAt: approval.approvedAt,
      editor: approval.editor,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized("Sign in to DryLake before approving the editor connection.");
    }

    console.error(error);
    return internalError("Failed to approve extension browser connect");
  }
}