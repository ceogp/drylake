import { internalError, ok } from "@/lib/api/http";
import { getAuthSessionSummary } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthSessionSummary();
    return ok({ auth });
  } catch (error) {
    console.error(error);
    return internalError("Failed to load auth session");
  }
}
