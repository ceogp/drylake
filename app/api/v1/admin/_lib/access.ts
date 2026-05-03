import { NextResponse } from "next/server";

import { getAdminRequestAuthResult } from "@/lib/admin-auth";

export function requireAdminApiRequest(request: Request) {
  const authResult = getAdminRequestAuthResult(request.headers);

  if (authResult.ok) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code:
          authResult.status === 401
            ? "unauthorized"
            : authResult.status === 503
              ? "admin_not_configured"
              : "not_found",
        message: authResult.message,
      },
    },
    {
      status: authResult.status,
      headers: authResult.headers,
    },
  );
}
