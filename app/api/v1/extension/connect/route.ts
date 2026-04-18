import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { getAuthSessionSummary, getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { ensureDevSession } from "@/lib/services/dev-session";

const payloadSchema = z.object({
  email: z.email().optional(),
  displayName: z.string().trim().min(1).optional(),
  editor: z.enum(["vscode", "cursor"]).default("vscode"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const auth = await getAuthSessionSummary();
    const authSetup = getAuthSetup();

    if (auth.session.status === "active") {
      const appContext = await getCurrentAppContext();

      return created({
        editor: parsed.data.editor,
        auth,
        user: appContext
          ? {
              id: appContext.user.id,
              email: appContext.user.email,
            }
          : auth.session.user,
        organization: appContext
          ? {
              id: appContext.organization.id,
              name: appContext.organization.name,
              slug: appContext.organization.slug,
              tier: appContext.organization.tier,
            }
          : {
              id: auth.session.organizationId,
            },
      });
    }

    if (process.env.NODE_ENV === "production" && parsed.data.email) {
      return forbidden("Extension bootstrap credentials are disabled in production.");
    }

    const session =
      parsed.data.email &&
      parsed.data.displayName &&
      authSetup.mode === "dev" &&
      process.env.NODE_ENV !== "production"
        ? await ensureDevSession({
            email: parsed.data.email,
            displayName: parsed.data.displayName,
          })
        : null;

    if (!session) {
      return unauthorized(
        authSetup.mode === "dev"
          ? "Provide dev bootstrap credentials or sign in through the web app first."
          : "Sign in to Xupra DryLake in the web app before connecting the extension.",
      );
    }

    return created({
      editor: parsed.data.editor,
      auth,
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
    return internalError("Failed to connect extension session");
  }
}
