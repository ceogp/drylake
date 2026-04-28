import { z } from "zod";

import { created, fromZodError, internalError } from "@/lib/api/http";
import { createBillingPortalSession } from "@/lib/services/billing";

const portalSchema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = portalSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const session = await createBillingPortalSession({
      organizationId: parsed.data.organizationId,
    });

    return created(session);
  } catch (error) {
    console.error(error);
    return internalError("Failed to create billing portal session");
  }
}
