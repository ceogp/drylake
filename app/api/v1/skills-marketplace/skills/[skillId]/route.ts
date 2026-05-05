import { proxySkillsMarketplace } from "@/app/api/v1/skills-marketplace/_lib";

type Context = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  const { skillId } = await context.params;
  return proxySkillsMarketplace(`/api/v1/skills/${encodeURIComponent(skillId)}`);
}
