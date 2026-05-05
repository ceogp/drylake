import * as vscode from "vscode";

import type {
  ExtensionConnection,
  GeneratedAgent,
  GeneratedSkill,
  GeneratedExportFile,
  JobResult,
  PackageVersionDetail,
  ProjectDetail,
  ProjectSummary,
  TransformJobDetail
} from "../types/api";

type JsonValue = Record<string, unknown>;

const LEGACY_HOSTS = new Set(["52.196.86.96"]);
const DEFAULT_BASE_URL = "https://drylake.xupracorp.com";

function normalizeBaseUrl(rawValue: string) {
  const trimmed = rawValue.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }

  try {
    const parsed = new URL(trimmed);

    if (LEGACY_HOSTS.has(parsed.hostname)) {
      return DEFAULT_BASE_URL;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

export class ApiClient {
  private accessToken?: string;

  constructor(private readonly configuration: vscode.WorkspaceConfiguration) {}

  get baseUrl() {
    return normalizeBaseUrl(String(this.configuration.get("baseUrl", DEFAULT_BASE_URL)));
  }

  openWebUrl(pathname = "/app") {
    return vscode.Uri.parse(`${this.baseUrl}${pathname}`);
  }

  setAccessToken(token?: string) {
    this.accessToken = token;
  }

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);

    if (this.accessToken) {
      headers.set("x-xupra-extension-token", this.accessToken);
    }

    const requestUrl = `${this.baseUrl}${pathname}`;
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        ...init,
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Network request failed for ${pathname}. Check xupra.baseUrl (currently ${this.baseUrl}). ${message}`,
      );
    }

    const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } } & T;

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error?.message ?? `Request failed for ${pathname}`);
    }

    return payload;
  }

  async connect(email?: string, displayName?: string, accessToken?: string) {
    return this.request<ExtensionConnection>(
      "/api/v1/extension/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(email ? { email } : {}),
          ...(displayName ? { displayName } : {}),
          ...(accessToken ? { accessToken } : {}),
          editor: "vscode"
        })
      }
    );
  }

  async exchangeBrowserConnectCode(code: string) {
    return this.request<{
      token: {
        token: string;
        expiresAt: string;
      };
      user: {
        id: string;
        email: string;
        imageUrl?: string | null;
      };
      organization: {
        id: string;
        name: string;
        slug: string;
        tier: string;
      };
      entitlements?: Record<string, boolean>;
      subscription?: {
        status: string;
      };
      editor: "vscode" | "cursor";
    }>("/api/v1/extension/connect/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  async getAuthSession() {
    return this.request<{ auth: ExtensionConnection["auth"] }>("/api/v1/auth/session");
  }

  async listProjects() {
    return this.request<{ projects: ProjectSummary[] }>("/api/v1/projects");
  }

  async getProject(projectId: string) {
    return this.request<{ project: ProjectDetail }>(`/api/v1/projects/${projectId}`);
  }

  async getVersion(versionId: string) {
    return this.request<{ version: PackageVersionDetail }>(`/api/v1/versions/${versionId}`);
  }

  async uploadFiles(versionId: string, files: Array<{ logicalPath: string; content: string }>) {
    const formData = new FormData();

    for (const file of files) {
      formData.append("paths", file.logicalPath);
      formData.append("files", new Blob([file.content], { type: "text/plain" }), file.logicalPath);
    }

    return this.request<{ files: Array<{ logicalPath: string }> }>(`/api/v1/versions/${versionId}/files`, {
      method: "POST",
      body: formData
    });
  }

  async importVersion(versionId: string) {
    return this.request<{ job: JobResult; imported?: JsonValue; warnings?: string[] }>(
      `/api/v1/versions/${versionId}/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" })
      }
    );
  }

  async checkCompatibility(versionId: string, targetPlatform: string) {
    return this.request<{ job: JobResult; result: JsonValue }>(
      `/api/v1/versions/${versionId}/compatibility`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlatform })
      }
    );
  }

  async exportPreview(versionId: string, targetPlatform: string) {
    return this.request<{ job: JobResult; generatedFiles?: Array<{ logicalPath: string; preview: string }> }>(
      `/api/v1/versions/${versionId}/export-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlatform })
      }
    );
  }

  async listGeneratedExports(versionId: string, targetPlatform: string, ensureGenerated = false) {
    const params = new URLSearchParams();
    params.set("targetPlatform", targetPlatform);

    if (ensureGenerated) {
      params.set("ensureGenerated", "true");
    }

    const payload = await this.request<{
      generatedFiles?: GeneratedExportFile[];
    }>(`/api/v1/versions/${versionId}/exports?${params.toString()}`);

    return {
      generatedFiles: payload.generatedFiles ?? []
    };
  }

  async listDeploymentTargets(projectId: string) {
    return this.request<{ deploymentTargets: Array<{ id: string; name: string; platform: string; deliveryMode: string }> }>(
      `/api/v1/projects/${projectId}/deployment-targets`
    );
  }

  async deploy(versionId: string, deploymentTargetId: string) {
    return this.request<{ job: JobResult }>(`/api/v1/versions/${versionId}/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deploymentTargetId, triggerSource: "ui" })
    });
  }

  async getDeploymentJob(jobId: string) {
    return this.request<{ deploymentJob: { id: string; status: string; outputJson?: JsonValue } }>(
      `/api/v1/deployment-jobs/${jobId}`
    );
  }

  async getTransformJob(jobId: string) {
    return this.request<{ transformJob: TransformJobDetail }>(`/api/v1/transform-jobs/${jobId}`);
  }

  async getSkillsMarketplace<T>(pathname: string) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return this.request<T>(`/api/v1/skills-marketplace${normalizedPath}`);
  }

  async generateSkill(params: {
    name: string;
    description: string;
    targetPlatform: string;
    context?: string;
  }) {
    return this.request<{ skill: GeneratedSkill; job?: JobResult }>("/api/v1/skills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async generateAgent(params: {
    name: string;
    description: string;
    targetPlatform: string;
    context?: string;
  }) {
    return this.request<{ agent: GeneratedAgent; job?: JobResult }>("/api/v1/agents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

}
