import { headers } from "next/headers";

import {
  badRequest,
  internalError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/http";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { pollExtensionAuthRequest } from "@/lib/services/extension-auth-requests";

const POLL_TOKEN_HEADER = "x-xupra-connect-poll-token";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId")?.trim();
    const headerStore = await headers();
    const pollToken = headerStore.get(POLL_TOKEN_HEADER)?.trim();

    if (!requestId) {
      return badRequest("requestId is required.");
    }

    if (!pollToken) {
      return badRequest("The connect poll token is required.");
    }

    const pollResult = await pollExtensionAuthRequest({
      requestId,
      pollToken,
    });

    if (pollResult.kind === "not_found") {
      return notFound("The editor connection request no longer exists.");
    }

    if (pollResult.kind === "invalid_secret") {
      return unauthorized("The editor connection poll token is invalid.");
    }

    if (pollResult.kind !== "approved") {
      return ok({
        status: pollResult.kind,
      });
    }

    const { subscription, entitlements, resolved } = await getEntitlementsForOrganization(
      pollResult.organization.id,
    );

    return ok({
      status: pollResult.kind,
      token: pollResult.token,
      user: {
        id: pollResult.user.id,
        email: pollResult.user.email,
        imageUrl: pollResult.user.profile?.avatarUrl ?? null,
      },
      organization: {
        id: pollResult.organization.id,
        name: pollResult.organization.name,
        slug: pollResult.organization.slug,
        tier: pollResult.organization.tier,
      },
      entitlements,
      entitlementVersion: resolved.entitlementVersion,
      plan: resolved.plan,
      subscription: {
        status: subscription?.status ?? "none",
        currentPeriodEnd: resolved.currentPeriodEnd,
      },
      editor: pollResult.editor,
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to poll extension browser connect");
  }
}
