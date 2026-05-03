export type V1Skill = {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType: string;
  installUrl: string | null;
  url: string;
  isDuplicate?: boolean;
};

export type SkillFile = {
  path: string;
  contents: string;
};

export type SkillDetail = {
  id: string;
  source: string;
  slug: string;
  installs: number;
  hash: string | null;
  files: SkillFile[] | null;
};

export type AuditEntry = {
  provider: string;
  slug: string;
  status: "pass" | "warn" | "fail";
  summary: string;
  auditedAt: string;
  riskLevel?: string;
};

export type SkillsListResponse = {
  data: V1Skill[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
};

export type SkillsSearchResponse = {
  data: V1Skill[];
  query: string;
  searchType: string;
  count: number;
  durationMs: number;
};

export type CuratedOwner = {
  owner: string;
  totalInstalls: number;
  featuredRepo: string;
  featuredSkill: string;
  skills: V1Skill[];
};

export type CuratedSkillsResponse = {
  data: CuratedOwner[];
  totalOwners: number;
  totalSkills: number;
  generatedAt: string;
};

export type SkillDetailResponse = {
  skill: SkillDetail;
};

export type SkillAuditsResponse = {
  audits: AuditEntry[];
};

class MarketplaceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class MarketplaceClient {
  private readonly baseUrl = "https://skills.sh";

  private async request<T>(url: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Network request failed for ${url}. ${message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const suffix = body ? `: ${body}` : "";
      throw new MarketplaceRequestError(`skills.sh request failed (${response.status}) for ${url}${suffix}`, response.status);
    }

    return (await response.json()) as T;
  }

  listSkills(view: "all-time" | "trending" | "hot" = "trending", page = 0) {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("page", String(page));

    return this.request<SkillsListResponse>(`${this.baseUrl}/api/v1/skills?${params.toString()}`);
  }

  searchSkills(q: string, limit = 50) {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("limit", String(limit));

    return this.request<SkillsSearchResponse>(`${this.baseUrl}/api/v1/skills/search?${params.toString()}`);
  }

  getCuratedSkills() {
    return this.request<CuratedSkillsResponse>(`${this.baseUrl}/api/v1/skills/curated`);
  }

  getSkillDetail(id: string) {
    return this.request<SkillDetailResponse>(`${this.baseUrl}/api/v1/skills/${id}`);
  }

  async getSkillAudits(id: string) {
    try {
      return await this.request<SkillAuditsResponse>(`${this.baseUrl}/api/v1/skills/audit/${id}`);
    } catch (error) {
      if (error instanceof MarketplaceRequestError && error.status === 404) {
        return { audits: [] };
      }

      throw error;
    }
  }
}
