import type { ApiClient } from "./apiClient";

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

export class MarketplaceClient {
  constructor(private readonly apiClient: ApiClient) {}

  private request<T>(pathname: string): Promise<T> {
    return this.apiClient.getSkillsMarketplace<T>(pathname);
  }

  listSkills(view: "all-time" | "trending" | "hot" = "trending", page = 0) {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("page", String(page));

    return this.request<SkillsListResponse>(`/skills?${params.toString()}`);
  }

  searchSkills(q: string, limit = 50) {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("limit", String(limit));

    return this.request<SkillsSearchResponse>(`/skills/search?${params.toString()}`);
  }

  getCuratedSkills() {
    return this.request<CuratedSkillsResponse>("/skills/curated");
  }

  getSkillDetail(id: string) {
    return this.request<SkillDetailResponse>(`/skills/${encodeURIComponent(id)}`);
  }

  getSkillAudits(id: string) {
    return this.request<SkillAuditsResponse>(`/skills/audit/${encodeURIComponent(id)}`);
  }
}
