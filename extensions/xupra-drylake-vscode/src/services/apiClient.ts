import * as vscode from "vscode";

import type {
  ExtensionConnection,
  GeneratedExportFile,
  JobResult,
  PackageVersionDetail,
  ProjectDetail,
  ProjectSummary
} from "../types/api";

type JsonValue = Record<string, unknown>;

export class ApiClient {
  constructor(private readonly configuration: vscode.WorkspaceConfiguration) {}

  get baseUrl() {
    return String(this.configuration.get("baseUrl", "http://localhost:3002")).replace(/\/+$/, "");
  }

  openWebUrl(pathname = "/app") {
    return vscode.Uri.parse(`${this.baseUrl}${pathname}`);
  }

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${pathname}`, init);
    const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } } & T;

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error?.message ?? `Request failed for ${pathname}`);
    }

    return payload;
  }

  async connect(email?: string, displayName?: string) {
    return this.request<ExtensionConnection>(
      "/api/v1/extension/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(email ? { email } : {}),
          ...(displayName ? { displayName } : {}),
          editor: "vscode"
        })
      }
    );
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
    return this.request<{ job: JobResult; imported: JsonValue; warnings: string[] }>(
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
    const url = new URL(`${this.baseUrl}/api/v1/versions/${versionId}/exports`);
    url.searchParams.set("targetPlatform", targetPlatform);

    if (ensureGenerated) {
      url.searchParams.set("ensureGenerated", "true");
    }

    const response = await fetch(url);
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: { message?: string };
      generatedFiles?: GeneratedExportFile[];
    };

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error?.message ?? `Request failed for ${url.pathname}`);
    }

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
}
