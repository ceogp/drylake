import { z } from "zod";

import { created, forbidden, fromZodError, internalError, unauthorized } from "@/lib/api/http";
import { requireOrganizationRole } from "@/lib/services/access";
import { createCheckoutSession } from "@/lib/services/billing";

const checkoutSchema = z.object({
  organizationId: z.string().min(1).optional(),
  plan: z.enum(["pro", "security_pro", "team_security", "enterprise"]),
  billingContext: z.enum(["user", "team"]).default("user"),
  teamId: z.string().min(1).optional(),
  returnPath: z.string().optional(),
  returnTo: z.string().optional(),
  extensionReturnUri: z.string().optional(),
});

function getSafeReturnPath(value: string | undefined) {
  const rawPath = value?.trim();

  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(rawPath, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function withQueryValue(path: string, key: string, value: string) {
  const parsed = new URL(path, "http://xupra.local");
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const requestedOrganizationId = parsed.data.teamId ?? parsed.data.organizationId;
    const context = await requireOrganizationRole(["owner", "admin"], requestedOrganizationId);
    const returnPath = getSafeReturnPath(parsed.data.returnTo ?? parsed.data.returnPath);
    const session = await createCheckoutSession({
      organizationId: context.organization.id,
      userId: context.user.id,
      userEmail: context.user.email,
      priceLookup: parsed.data.plan,
      billingContext: parsed.data.billingContext,
      returnTo: returnPath,
      extensionReturnUri: parsed.data.extensionReturnUri,
      successUrl: returnPath
        ? `${new URL(request.url).origin}${withQueryValue(returnPath, "billing", "success")}`
        : undefined,
      cancelUrl: returnPath
        ? `${new URL(request.url).origin}${withQueryValue(returnPath, "billing", "canceled")}`
        : undefined,
    });

    return created(session);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return forbidden("You do not have permission to manage billing for that organization.");
    }

    console.error(error);
    return internalError("Failed to create checkout session");
  }
}
