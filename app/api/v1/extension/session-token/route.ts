import { created, internalError, unauthorized } from "@/lib/api/http";
import { recordAuthEvent } from "@/lib/services/app-session";
import { requireCurrentAppContext } from "@/lib/services/current-user";
import { createExtensionAccessToken } from "@/lib/services/extension-tokens";

export async function POST() {
  try {
    const context = await requireCurrentAppContext();
    const token = await createExtensionAccessToken({
      userId: context.user.id,
      email: context.user.email,
      organizationId: context.organization.id,
    });
    await recordAuthEvent({
      eventName: "auth.extension.session_token_created",
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      authProvider: context.user.authProvider,
      authSubject: context.user.authSubject,
      email: context.user.email,
    });

    return created({
      token,
      organization: {
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug,
      },
      user: {
        id: context.user.id,
        email: context.user.email,
        imageUrl: context.user.profile?.avatarUrl ?? null,
        displayName: context.user.profile?.displayName ?? context.user.email,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized("Sign in to DryLake before generating an extension token.");
    }

    console.error(error);
    return internalError("Failed to create extension session token");
  }
}
