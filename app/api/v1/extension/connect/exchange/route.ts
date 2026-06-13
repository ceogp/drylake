import { z } from "zod";

import { created, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { recordAuthEvent } from "@/lib/services/app-session";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { exchangeExtensionAuthRequest } from "@/lib/services/extension-auth-requests";

const payloadSchema = z.object({
  code: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const session = await exchangeExtensionAuthRequest(parsed.data.code);

    if (!session) {
      return unauthorized("The browser callback code is invalid, expired, or already used.");
    }

    const { subscription, entitlements } = await getEntitlementsForOrganization(session.organization.id);
    await recordAuthEvent({
      eventName: "auth.extension.browser_code_exchanged",
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      authProvider: session.user.authProvider,
      authSubject: session.user.authSubject,
      email: session.user.email,
      metadataJson: {
        editor: session.editor,
      },
    });

    return created({
      token: session.token,
      user: {
        id: session.user.id,
        email: session.user.email,
        imageUrl: session.user.profile?.avatarUrl ?? null,
      },
      organization: {
        id: session.organization.id,
        name: session.organization.name,
        slug: session.organization.slug,
        tier: session.organization.tier,
      },
      entitlements,
      subscription: {
        status: subscription?.status ?? "none",
      },
      editor: session.editor,
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to exchange browser connect code");
  }
}
