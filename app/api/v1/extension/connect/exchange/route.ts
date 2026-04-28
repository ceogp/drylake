import { z } from "zod";

import { created, fromZodError, internalError, unauthorized } from "@/lib/api/http";
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

    return created({
      token: session.token,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      organization: {
        id: session.organization.id,
        name: session.organization.name,
        slug: session.organization.slug,
        tier: session.organization.tier,
      },
      editor: session.editor,
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to exchange browser connect code");
  }
}
