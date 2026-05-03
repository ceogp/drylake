import { internalError, ok } from "@/lib/api/http";
import { getAdminAuditData } from "@/lib/services/admin-data";
import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";

export async function GET(request: Request) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const audit = await getAdminAuditData();
    return ok({ audit });
  } catch (error) {
    console.error(error);
    return internalError("Failed to load admin audit");
  }
}
