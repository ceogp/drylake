import { fromZodError, internalError, ok, unprocessableEntity } from "@/lib/api/http";
import {
  submitKyaSurveyInvite,
  submitKyaSurveyInviteSchema,
} from "@/KYAregistry/services/surveys";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = submitKyaSurveyInviteSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const result = await submitKyaSurveyInvite(parsed.data);

    return ok({
      result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("invalid") ||
        error.message.includes("already used") ||
        error.message.includes("expired"))
    ) {
      return unprocessableEntity(error.message);
    }

    console.error(error);
    return internalError(error instanceof Error ? error.message : "Failed to submit KYA survey");
  }
}
