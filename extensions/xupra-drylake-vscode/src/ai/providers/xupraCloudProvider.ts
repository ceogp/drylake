import * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import type {
  ClarifyIntentInput,
  ClarifyIntentResult,
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
} from "../DryLakeAiProvider";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "../../services/apiClient";
import type { ConnectionState } from "../../types/package";

type Endpoint =
  | "/api/v1/drylake/runbooks/draft"
  | "/api/v1/drylake/runbooks/refine-purpose"
  | "/api/v1/drylake/runbooks/refine-architecture"
  | "/api/v1/drylake/runbooks/generate-phases";

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
    const hasXupraProAi = Boolean(connection.entitlements?.xupra_pro_ai);

    if (!connection.userEmail || !hasXupraProAi) {
      return { available: false, reason: "Connect a Xupra account with Xupra AI access to use this provider." };
    }

    return { available: true };
  }

  private async post(endpoint: Endpoint, input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
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
        | { runbook?: unknown; xu?: unknown; content?: string; yaml?: string; error?: { message?: string } }
        | undefined;

      try {
        payload = JSON.parse(text) as {
          runbook?: unknown;
          xu?: unknown;
          content?: string;
          yaml?: string;
          error?: { message?: string };
        };
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        return {
          message:
            typeof payload?.error?.message === "string"
              ? payload.error.message
              : `Xupra AI request failed (${response.status}).`,
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

      return { runbook: parsed.runbook };
    } catch (error) {
      return {
        message: error instanceof Error
          ? `Xupra AI request failed: ${error.message}`
          : "Xupra AI request failed.",
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

  async clarifyIntent(input: ClarifyIntentInput): Promise<ClarifyIntentResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();

    try {
      const response = await fetch(`${baseUrl}/api/v1/drylake/runbooks/clarify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-xupra-extension-token": token } : {}),
        },
        body: JSON.stringify(input),
      });

      const text = await response.text();
      let payload: { questions?: unknown; error?: { message?: string } } | undefined;
      try {
        payload = JSON.parse(text) as { questions?: unknown; error?: { message?: string } };
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

      return { questions };
    } catch (error) {
      return {
        message: error instanceof Error
          ? `Xupra AI clarify request failed: ${error.message}`
          : "Xupra AI clarify request failed.",
      };
    }
  }
}

