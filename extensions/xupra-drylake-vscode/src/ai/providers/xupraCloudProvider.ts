import * as vscode from "vscode";

import { parseAiRunbookResponse } from "../parseAiRunbookResponse";
import type {
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
} from "../DryLakeAiProvider";
import type { ConnectionState } from "../../types/package";

const PRODUCTION_HOSTS = new Set(["drylake.xupracorp.com", "xupracorp.com", "www.xupracorp.com"]);

type Endpoint =
  | "/v1/drylake/runbooks/draft"
  | "/v1/drylake/runbooks/refine-purpose"
  | "/v1/drylake/runbooks/refine-architecture"
  | "/v1/drylake/runbooks/generate-phases";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isProductionHost(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return PRODUCTION_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export class XupraCloudProvider implements DryLakeAiProvider {
  readonly id = "xupra-pro-ai";
  readonly label = "Xupra Pro AI";

  constructor(
    private readonly configuration: vscode.WorkspaceConfiguration,
    private readonly readConnection: () => ConnectionState,
    private readonly readAccessToken: () => Promise<string | undefined>,
  ) {}

  async isAvailable() {
    const environment = String(this.configuration.get("environment", "development"));
    const baseUrl = normalizeBaseUrl(String(this.configuration.get("apiBaseUrl", "")));
    const connection = this.readConnection();
    const tier = connection.organizationTier?.toLowerCase();

    if (environment !== "development") {
      return { available: false, reason: "Xupra Pro AI is enabled only for development in this build." };
    }

    if (!baseUrl) {
      return { available: false, reason: "Set drylake.apiBaseUrl to use Xupra Pro AI on development." };
    }

    if (isProductionHost(baseUrl)) {
      return { available: false, reason: "Xupra Pro AI refused a production host." };
    }

    if (!connection.userEmail || (tier !== "pro" && tier !== "enterprise")) {
      return { available: false, reason: "Connect a Pro Xupra account to use Xupra Pro AI." };
    }

    return { available: true };
  }

  private async post(endpoint: Endpoint, input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }

    const baseUrl = normalizeBaseUrl(String(this.configuration.get("apiBaseUrl", "")));
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

      if (!response.ok) {
        return { message: `Xupra Pro AI is not available on this development server (${response.status}).` };
      }

      const text = await response.text();
      let content = text;

      try {
        const payload = JSON.parse(text) as { runbook?: unknown; xu?: unknown; content?: string; yaml?: string };
        content =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.yaml === "string"
              ? payload.yaml
              : JSON.stringify(payload.runbook ?? payload);
      } catch {
        // Plain YAML responses are supported.
      }

      const parsed = parseAiRunbookResponse(content);
      if (!parsed.runbook || !parsed.validation.ok) {
        return {
          message: `Xupra Pro AI returned invalid .xu: ${parsed.validation.diagnostics
            .map((item) => item.message)
            .join("; ")}`,
        };
      }

      return { runbook: parsed.runbook };
    } catch (error) {
      return {
        message: error instanceof Error
          ? `Xupra Pro AI is not available on this development server: ${error.message}`
          : "Xupra Pro AI is not available on this development server.",
      };
    }
  }

  generateDraftRunbook(input: GenerateDraftRunbookInput) {
    return this.post("/v1/drylake/runbooks/draft", input);
  }

  refinePurpose(input: GenerateDraftRunbookInput) {
    return this.post("/v1/drylake/runbooks/refine-purpose", input);
  }

  refineArchitecture(input: GenerateDraftRunbookInput) {
    return this.post("/v1/drylake/runbooks/refine-architecture", input);
  }

  generatePhasePlan(input: GenerateDraftRunbookInput) {
    return this.post("/v1/drylake/runbooks/generate-phases", input);
  }
}

