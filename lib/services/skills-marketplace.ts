import { env } from "@/lib/env";

export class SkillsMarketplaceConfigError extends Error {}

export class SkillsMarketplaceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchSkillsMarketplaceJson<T>(pathname: string) {
  if (!env.SKILLS_SH_API_KEY) {
    throw new SkillsMarketplaceConfigError("skills.sh API key is not configured.");
  }

  const url = new URL(pathname, "https://skills.sh");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${env.SKILLS_SH_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SkillsMarketplaceRequestError(body || response.statusText, response.status);
  }

  return (await response.json()) as T;
}
