import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getAdminRequestAuthResult } from "@/lib/admin-auth";

export async function requireAdminPageAccess() {
  const requestHeaders = await headers();
  const authResult = getAdminRequestAuthResult(requestHeaders);

  if (!authResult.ok) {
    notFound();
  }
}
