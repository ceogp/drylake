import { internalError, notFound, ok } from "@/lib/api/http";
import { getAdminUserDetailData } from "@/lib/services/admin-data";
import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/admin/users/[userId]">,
) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { userId } = await context.params;
    const user = await getAdminUserDetailData(userId);

    if (!user) {
      return notFound("User not found");
    }

    return ok({ user });
  } catch (error) {
    console.error(error);
    return internalError("Failed to load admin user");
  }
}
