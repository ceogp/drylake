import { internalError, ok } from "@/lib/api/http";
import { getAdminUsersData } from "@/lib/services/admin-data";
import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";

export async function GET(request: Request) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const users = await getAdminUsersData();
    return ok(users);
  } catch (error) {
    console.error(error);
    return internalError("Failed to load admin users");
  }
}
