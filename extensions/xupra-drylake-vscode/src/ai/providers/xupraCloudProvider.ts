import * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import type {
  ClarifyIntentInput,
  ClarifyIntentResult,
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
  PlanningChatInput,
  PlanningChatResult,
  RunbookModelTier,
} from "../DryLakeAiProvider";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "../../services/apiClient";
import type { ConnectionState } from "../../types/package";

type Endpoint =
  | "/api/v1/drylake/runbooks/draft"
  | "/api/v1/drylake/runbooks/refine-purpose"
  | "/api/v1/drylake/runbooks/refine-architecture"
  | "/api/v1/drylake/runbooks/generate-phases";

type ChatEndpoint = "/api/v1/drylake/runbooks/chat";

const CLOUD_REQUEST_TIMEOUT_MS = 120_000;

function modelTierFrom(value: unknown): RunbookModelTier | undefined {
  return value === "nano" || value === "foundation" ? value : undefined;
}

function runbookFrom(value: unknown) {
  if (!value) {
    return undefined;
  }

  const content = typeof value === "string" ? value : JSON.stringify(value);
  const parsed = parseAiRunbookResponse(content);
  return parsed.runbook && parsed.validation.ok ? parsed.runbook : undefined;
}

function resolveBaseUrl(
  configuration: vscode.WorkspaceConfiguration,
  backendConfiguration: vscode.WorkspaceConfiguration,
) {
  const override = String(configuration.get("apiBaseUrl", "")).trim();

  if (override) {
    return normalizeBaseUrl(override);
  }

  return normalizeBaseUrl(String(backendConfiguration.get("baseUrl", DEFAULT_BASE_URL)));
}

export class XupraCloudProvider implements DryLakeAiProvider {
  readonly id = "xupra-pro-ai";
  readonly label = "Xupra AI";

  constructor(
    private readonly configuration: vscode.WorkspaceConfiguration,
    private readonly readConnection: () => ConnectionState,
    private readonly readAccessToken: () => Promise<string | undefined>,
    private readonly backendConfiguration: vscode.WorkspaceConfiguration = configuration,
  ) {}

  async isAvailable() {
    const connection = this.readConnection();

    if (!connection.userEmail) {
      return { available: false, reason: "Connect a Xupra account to use DryLake planning." };
    }

    return { available: true };
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private timeoutSeconds() {
    return CLOUD_REQUEST_TIMEOUT_MS / 1000;
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
  }

  private async post(endpoint: Endpoint, input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();

    try {
      const response = await this.fetchWithTimeout(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-xupra-extension-token": token } : {}),
        },
        body: JSON.stringify(input),
      });

      const text = await response.text();
      let content = text;
      let payload:
        | { runbook?: unknown; xu?: unknown; content?: string; yaml?: string; error?: { message?: string }; modelTier?: unknown }
        | undefined;

      try {
        payload = JSON.parse(text) as {
          runbook?: unknown;
          xu?: unknown;
          content?: string;
          yaml?: string;
          error?: { message?: string };
          modelTier?: unknown;
        };
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        const message = typeof payload?.error?.message === "string"
          ? payload.error.message
          : `Xupra AI request failed (${response.status}).`;
        return {
          message: message.includes(`(${response.status})`) ? message : `${message} (${response.status}).`,
        };
      }

      if (payload) {
        content =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.yaml === "string"
              ? payload.yaml
              : JSON.stringify(payload.runbook ?? payload);
      }

      const parsed = parseAiRunbookResponse(content);
      if (!parsed.runbook || !parsed.validation.ok) {
        return {
          message: `Xupra AI returned invalid .xu: ${parsed.validation.diagnostics
            .map((item) => item.message)
            .join("; ")}`,
        };
      }

      const modelTier = modelTierFrom(payload?.modelTier);
      return { runbook: parsed.runbook, ...(modelTier ? { modelTier } : {}) };
    } catch (error) {
      if (this.isAbortError(error)) {
        return {
          message: `Xupra AI request timed out after ${this.timeoutSeconds()} seconds.`,
        };
      }

      return {
        message: error instanceof Error
          ? `Xupra AI request failed: ${error.message}`
          : "Xupra AI request failed.",
      };
    }
  }

  private async postChat(endpoint: ChatEndpoint, input: PlanningChatInput): Promise<PlanningChatResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { error: availability.reason };
    }

    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();

    try {
      const response = await this.fetchWithTimeout(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-xupra-extension-token": token } : {}),
        },
        body: JSON.stringify(input),
      });

      const text = await response.text();
      let payload:
        | { reply?: unknown; proposedRunbook?: unknown; runbook?: unknown; error?: { message?: string }; modelTier?: unknown }
        | undefined;

      try {
        payload = JSON.parse(text) as {
          reply?: unknown;
          proposedRunbook?: unknown;
          runbook?: unknown;
          error?: { message?: string };
          modelTier?: unknown;
        };
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        const message = typeof payload?.error?.message === "string"
          ? payload.error.message
          : `Xupra AI chat request failed (${response.status}).`;
        return { error: message.includes(`(${response.status})`) ? message : `${message} (${response.status}).` };
      }

      if (typeof payload?.reply !== "string" || !payload.reply.trim()) {
        return { error: "Xupra AI chat returned an empty response." };
      }

      const modelTier = modelTierFrom(payload.modelTier);
      const runbook = runbookFrom(payload.proposedRunbook ?? payload.runbook);
      return { reply: payload.reply, ...(runbook ? { runbook } : {}), ...(modelTier ? { modelTier } : {}) };
    } catch (error) {
      if (this.isAbortError(error)) {
        return {
          error: `Xupra AI chat request timed out after ${this.timeoutSeconds()} seconds.`,
        };
      }

      return {
        error: error instanceof Error
          ? `Xupra AI chat request failed: ${error.message}`
          : "Xupra AI chat request failed.",
      };
    }
  }

  generateDraftRunbook(input: GenerateDraftRunbookInput) {
    return this.post("/api/v1/drylake/runbooks/draft", input);
  }

  refinePurpose(input: GenerateDraftRunbookInput) {
    return this.post("/api/v1/drylake/runbooks/refine-purpose", input);
  }

  refineArchitecture(input: GenerateDraftRunbookInput) {
    return this.post("/api/v1/drylake/runbooks/refine-architecture", input);
  }

  generatePhasePlan(input: GenerateDraftRunbookInput) {
    return this.post("/api/v1/drylake/runbooks/generate-phases", input);
  }

  planningChat(input: PlanningChatInput) {
    return this.postChat("/api/v1/drylake/runbooks/chat", input);
  }

  async clarifyIntent(input: ClarifyIntentInput): Promise<ClarifyIntentResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();

    try {
      const response = await this.fetchWithTimeout(`${baseUrl}/api/v1/drylake/runbooks/clarify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-xupra-extension-token": token } : {}),
        },
        body: JSON.stringify(input),
      });

      const text = await response.text();
      let payload: { questions?: unknown; modelTier?: unknown; error?: { message?: string } } | undefined;
      try {
        payload = JSON.parse(text) as { questions?: unknown; modelTier?: unknown; error?: { message?: string } };
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        return {
          message:
            typeof payload?.error?.message === "string"
              ? payload.error.message
              : `Xupra AI clarify request failed (${response.status}).`,
        };
      }

      const questions = Array.isArray(payload?.questions)
        ? payload.questions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

      const modelTier = modelTierFrom(payload?.modelTier);
      return { questions, ...(modelTier ? { modelTier } : {}) };
    } catch (error) {
      if (this.isAbortError(error)) {
        return {
          message: `Xupra AI clarify request timed out after ${this.timeoutSeconds()} seconds.`,
        };
      }

      return {
        message: error instanceof Error
          ? `Xupra AI clarify request failed: ${error.message}`
          : "Xupra AI clarify request failed.",
      };
    }
  }
}

