import { env } from "@/lib/env";

export class SkillsMarketplaceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchSkillsMarketplaceJson<T>(pathname: string) {
  const url = new URL(pathname, "https://skills.sh");
  const headers = new Headers({
    Accept: "application/json",
  });

  if (env.SKILLS_SH_API_KEY) {
    headers.set("Authorization", `Bearer ${env.SKILLS_SH_API_KEY}`);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SkillsMarketplaceRequestError(body || response.statusText, response.status);
  }

  return (await response.json()) as T;
}
