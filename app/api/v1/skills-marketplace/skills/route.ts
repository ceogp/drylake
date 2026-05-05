import { z } from "zod";

import { badRequest } from "@/lib/api/http";
import { proxySkillsMarketplace } from "@/app/api/v1/skills-marketplace/_lib";

const querySchema = z.object({
  view: z.enum(["all-time", "trending", "hot"]).default("trending"),
  page: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    view: url.searchParams.get("view") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Invalid skills marketplace query", parsed.error.flatten());
  }

  const params = new URLSearchParams({
    view: parsed.data.view,
    page: String(parsed.data.page),
  });

  return proxySkillsMarketplace(`/api/v1/skills?${params.toString()}`);
}
