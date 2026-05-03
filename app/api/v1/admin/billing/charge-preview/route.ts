import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";
import { badRequest, internalError, notFound, ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(request: Request) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const stripeCustomerId = new URL(request.url).searchParams.get("stripeCustomerId")?.trim();

  if (!stripeCustomerId) {
    return badRequest("stripeCustomerId is required");
  }

  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "stripe_not_configured",
          message: "Stripe is not configured.",
        },
      },
      { status: 503 },
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  try {
    const charges = await stripe.charges.list({ customer: stripeCustomerId, limit: 1 });

    if (charges.data.length === 0) {
      return notFound("No charges found for this customer.");
    }

    const charge = charges.data[0];

    return ok({
      chargeId: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      invoiceDate: charge.created,
      status: charge.status,
    });
  } catch {
    return internalError("Failed to fetch charge from Stripe.");
  }
}
