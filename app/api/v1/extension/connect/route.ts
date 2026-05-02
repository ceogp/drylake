import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { getAuthSessionSummary, getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { ensureDevSession } from "@/lib/services/dev-session";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { verifyExtensionAccessToken } from "@/lib/services/extension-tokens";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  email: z.email().optional(),
  displayName: z.string().trim().min(1).optional(),
  accessToken: z.string().trim().min(1).optional(),
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

    if (parsed.data.accessToken) {
      const extensionSession = await verifyExtensionAccessToken(parsed.data.accessToken);

      if (!extensionSession) {
        return unauthorized("The extension token is invalid or expired. Generate a new one from the website.");
      }

      const user = await prisma.user.findUnique({
        where: { id: extensionSession.userId },
        include: {
          memberships: {
            include: {
              organization: true,
            },
          },
        },
      });
      const membership = user?.memberships.find(
        (item) => item.organizationId === extensionSession.organizationId,
      );

      if (!user || !membership) {
        return unauthorized("The extension token no longer maps to an active workspace.");
      }

      const { subscription, entitlements } = await getEntitlementsForOrganization(membership.organizationId);

      return created({
        editor: parsed.data.editor,
        auth: {
          ...auth,
          session: {
            status: "active",
            user: {
              id: user.id,
              email: user.email,
            },
            organizationId: membership.organizationId,
          },
        },
        user: {
          id: user.id,
          email: user.email,
        },
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          tier: membership.organization.tier,
        },
        entitlements,
        subscription: {
          status: subscription?.status ?? "none",
        },
      });
    }

    if (auth.session.status === "active") {
      const appContext = await getCurrentAppContext();
      const organizationId = appContext?.organization.id ?? auth.session.organizationId;

      if (!organizationId) {
        return unauthorized("The active session is not associated with an organization.");
      }

      const { subscription, entitlements } = await getEntitlementsForOrganization(organizationId);

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
        entitlements,
        subscription: {
          status: subscription?.status ?? "none",
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

    const { subscription, entitlements } = await getEntitlementsForOrganization(session.organization.id);

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
      entitlements,
      subscription: {
        status: subscription?.status ?? "none",
      },
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to connect extension session");
  }
}
