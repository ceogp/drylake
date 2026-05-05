import { proxySkillsMarketplace } from "@/app/api/v1/skills-marketplace/_lib";

export async function GET() {
  return proxySkillsMarketplace("/api/v1/skills/curated");
}
