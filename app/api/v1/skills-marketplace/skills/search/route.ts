import { z } from "zod";

import { badRequest } from "@/lib/api/http";
import { proxySkillsMarketplace } from "@/app/api/v1/skills-marketplace/_lib";

const querySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Invalid skills search query", parsed.error.flatten());
  }

  const params = new URLSearchParams({
    q: parsed.data.q,
    limit: String(parsed.data.limit),
  });

  return proxySkillsMarketplace(`/api/v1/skills/search?${params.toString()}`);
}
