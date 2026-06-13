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

export type ExtensionUsageEventPayload = {
  eventName: string;
  sessionId?: string;
  workspaceHash?: string;
  phaseId?: string;
  phaseTitle?: string;
  agentId?: string;
  skillLogicalPath?: string;
  actionType?: string;
  launchStatus?: string;
  reasonCode?: string;
  promptEstimatedTokens?: number;
  promptKind?: string;
  promptText?: string;
  metadata?: Record<string, unknown>;
};

export type GuardScanUploadArtifact = {
  kind: "mcp-config" | "skill" | "agent-rule" | "instruction" | "guard-report";
  logicalPath: string;
  content: string;
  mimeType?: string;
};

export type GuardScanUploadPayload = {
  workspaceHash?: string;
  sourceClient?: string;
  consentMode: "local" | "baseline_upload" | "active_guard";
  scan: {
    scannedAt: string;
    score: number;
    rank: string;
    summary: Record<string, unknown>;
    categoryScores: Record<string, unknown>;
    findings: Array<Record<string, unknown>>;
    connectionMap?: Record<string, unknown>;
    extensions?: Array<Record<string, unknown>>;
    mcpServers?: Array<Record<string, unknown>>;
    workspaceSurface?: Record<string, unknown>;
    packageManagers?: string[];
    packageScripts?: string[];
  };
  artifacts?: GuardScanUploadArtifact[];
};

export type GuardFixPlanAction = {
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  why: string;
  recommendation: string;
  files: string[];
  approvalRequired: boolean;
};

export type GuardFixPlan = {
  summary: string;
  actions: GuardFixPlanAction[];
  cautions: string[];
  nextSteps: string[];
};

export type GuardFixPlanPayload = {
  workspaceHash?: string;
  sourceClient?: string;
  scan: {
    scannedAt: string;
    score: number;
    rank: string;
    summary: Record<string, unknown>;
    categoryScores: Record<string, unknown>;
    findings: Array<Record<string, unknown>>;
    extensions: Array<Record<string, unknown>>;
    secrets: Array<Record<string, unknown>>;
    mcpServers: Array<Record<string, unknown>>;
    workspaceSurface: Record<string, unknown>;
    connectionMap: Record<string, unknown>;
  };
};

export type CloudAnalysisPayload = {
  guardScanId?: string;
  approvedPayload: {
    scanManifest?: Record<string, unknown>;
    redactedFindings?: Array<Record<string, unknown>>;
    dependencyMetadata?: Record<string, unknown>;
    mcpMetadata?: Record<string, unknown>;
    extensionMetadata?: Record<string, unknown>;
    filePathInventory?: string[];
    selectedPromptFiles?: Array<{ path: string; content: string }>;
  };
};

export type GuardScanComparisonResponse = {
  personalComparison?: Record<string, unknown> | null;
  baselineComparison?: Record<string, unknown> | null;
};

export type ContinuousWatchEventPayload = {
  action?: "record" | "evaluate";
  guardScanId?: string;
  workspaceHash?: string;
  eventType?: "scheduled_scan" | "extension_check_in" | "baseline_drift" | "policy_violation";
  severity?: "critical" | "high" | "medium" | "low" | "info";
  logicalPath?: string;
  metadata?: Record<string, unknown>;
};

type BrowserConnectSessionPayload = {
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
  entitlementVersion?: number;
  plan?: string;
  subscription?: {
    status: string;
    currentPeriodEnd?: string;
  };
  editor: "vscode" | "cursor";
};

const LEGACY_HOSTS = new Set(["52.196.86.96"]);
export const DEFAULT_BASE_URL = "https://drylake.xupracorp.com";

export function normalizeBaseUrl(rawValue: string) {
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
    return this.request<BrowserConnectSessionPayload>("/api/v1/extension/connect/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  async startBrowserConnect(editor: "vscode" | "cursor") {
    return this.request<{
      requestId: string;
      pollToken: string;
      expiresAt: string;
      editor: "vscode" | "cursor";
    }>("/api/v1/extension/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor }),
    });
  }

  async pollBrowserConnect(requestId: string, pollToken: string) {
    return this.request<
      | { status: "pending" | "denied" | "expired" | "consumed" }
      | ({ status: "approved" } & BrowserConnectSessionPayload)
    >(`/api/v1/extension/connect/poll?requestId=${encodeURIComponent(requestId)}`, {
      headers: {
        "x-xupra-connect-poll-token": pollToken,
      },
    });
  }

  async getAuthSession() {
    return this.request<{ auth: ExtensionConnection["auth"] }>("/api/v1/auth/session");
  }

  async getEntitlements() {
    return this.request<{
      plan: string;
      entitlementVersion: number;
      capabilities: Record<string, boolean>;
      billing: { status: string; currentPeriodEnd?: string };
    }>("/api/v1/entitlements");
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

  async fetchVersionFile(versionId: string, logicalPath: string) {
    const search = new URLSearchParams({ logicalPath });
    return this.request<{
      logicalPath: string;
      kind: string;
      mimeType: string;
      sizeBytes: number;
      content: string;
    }>(`/api/v1/extension/versions/${versionId}/file?${search.toString()}`);
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

  async optimizeAgent(params: {
    content: string;
    targetPlatform: string;
    fileName?: string;
    repoContext?: string;
  }) {
    return this.request<{ optimized: { content: string } }>("/api/v1/agents/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async planRunnerAssignments(params: {
    taskPrompt: string;
    agents: Array<{ agentId: string; label: string }>;
  }) {
    return this.request<{
      assignments: Array<{
        agentId: string;
        subtaskSummary: string;
        scopeBoundary: string;
      }>;
      modelTier: "nano" | "foundation";
    }>("/api/v1/drylake/runner/plan-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async recordUsageEvent(params: ExtensionUsageEventPayload) {
    return this.request<{ event: { id: string; createdAt: string } }>("/api/v1/extension/usage-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async recordGuardScan(params: GuardScanUploadPayload) {
    return this.request<{
      guardScan: { id: string; createdAt: string };
      artifacts: Array<{ id: string; kind: string; logicalPath: string; sizeBytes: number; redacted: boolean }>;
      uploadedArtifactCount: number;
    }>("/api/v1/guard/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async generateGuardFixPlan(params: GuardFixPlanPayload) {
    return this.request<{
      plan: GuardFixPlan;
      modelTier: "nano";
      model: string;
    }>("/api/v1/guard/fix-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async startCloudAnalysis(params: CloudAnalysisPayload) {
    return this.request<{
      job: {
        id: string;
        guardScanId?: string | null;
        status: string;
        resultJson?: Record<string, unknown>;
        createdAt: string;
      };
    }>("/api/v1/guard/cloud-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async listCloudAnalysisJobs() {
    return this.request<{
      jobs: Array<{
        id: string;
        guardScanId?: string | null;
        status: string;
        resultJson?: Record<string, unknown>;
        errorMessage?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/api/v1/guard/cloud-analysis");
  }

  async getCloudAnalysisJob(jobId: string) {
    return this.request<{
      job: {
        id: string;
        guardScanId?: string | null;
        status: string;
        result?: Record<string, unknown>;
        errorMessage?: string | null;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/api/v1/guard/cloud-analysis/${encodeURIComponent(jobId)}`);
  }

  async getGuardScanComparison(guardScanId: string) {
    return this.request<GuardScanComparisonResponse>(
      `/api/v1/guard/scans/${encodeURIComponent(guardScanId)}/comparison`,
    );
  }

  async markGuardScanBaseline(guardScanId: string) {
    return this.request<{
      baseline: {
        id: string;
        guardScanId: string;
        workspaceHash: string;
        createdAt: string;
      };
    }>("/api/v1/team/security/baseline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardScanId }),
    });
  }

  async recordContinuousWatchEvent(params: ContinuousWatchEventPayload) {
    return this.request<{
      evaluatedScanCount?: number;
      eventsCreated?: number;
      events?: Array<{
        id: string;
        eventType: string;
        severity: string;
        logicalPath: string;
        createdAt: string;
      }>;
      event?: {
        id: string;
        eventType: string;
        severity: string;
        logicalPath: string;
        createdAt: string;
      };
    }>("/api/v1/team/security/continuous-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async runContinuousWatchEvaluation(params: Omit<ContinuousWatchEventPayload, "action" | "eventType" | "severity" | "logicalPath"> = {}) {
    return this.recordContinuousWatchEvent({
      ...params,
      action: "evaluate",
    });
  }

}
