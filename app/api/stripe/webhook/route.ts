import { NextResponse } from "next/server";

import { handleStripeWebhook } from "@/lib/services/billing";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ ok: false, error: "Missing stripe-signature header" }, { status: 400 });
    }

    const event = await handleStripeWebhook(body, signature);

    return NextResponse.json({ ok: true, received: true, type: event.type });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Webhook processing failed" }, { status: 400 });
  }
}
