import { NextResponse } from "next/server";

import { proxySkillsMarketplace } from "@/app/api/v1/skills-marketplace/_lib";

type Context = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  const { skillId } = await context.params;
  const response = await proxySkillsMarketplace(`/api/v1/skills/audit/${encodeURIComponent(skillId)}`);

  if (response.status === 404) {
    return NextResponse.json({ audits: [] });
  }

  return response;
}
