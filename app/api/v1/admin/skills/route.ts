import { internalError, ok } from "@/lib/api/http";
import { getAdminSkillsData } from "@/lib/services/admin-data";
import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";

export async function GET(request: Request) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const skills = await getAdminSkillsData();
    return ok({ skills });
  } catch (error) {
    console.error(error);
    return internalError("Failed to load admin skills");
  }
}
