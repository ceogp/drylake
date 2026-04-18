import { z } from "zod";

import { created, forbidden, fromZodError, internalError } from "@/lib/api/http";
import { ensureDevSession } from "@/lib/services/dev-session";
import { getAuthSetup } from "@/lib/services/auth";

const payloadSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const authSetup = getAuthSetup();

    if (process.env.NODE_ENV === "production" || authSetup.mode !== "dev") {
      return forbidden("Development session bootstrap is only available in local dev mode.");
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const session = await ensureDevSession(parsed.data);

    return created({
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
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to create development session");
  }
}
