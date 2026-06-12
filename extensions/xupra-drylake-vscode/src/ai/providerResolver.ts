import type * as vscode from "vscode";

import { XupraCloudProvider } from "./providers/xupraCloudProvider";
import { HermesCliProvider } from "./providers/hermesCliProvider";
import { ClaudeApiProvider, DatabricksApiProvider, OpenAiApiProvider } from "./providers/directApiProviders";
import type { DryLakeAiProvider, DryLakeProviderId } from "./DryLakeAiProvider";
import type { ConnectionState } from "../types/package";

export type DryLakeProviderResolution = {
  provider: DryLakeAiProvider;
  reason?: string;
};

export async function resolveDryLakeAiProvider(params: {
  configuration: vscode.WorkspaceConfiguration;
  backendConfiguration?: vscode.WorkspaceConfiguration;
  readConnection: () => ConnectionState;
  readAccessToken: () => Promise<string | undefined>;
  readPlanningSecret?: (providerId: DryLakeProviderId) => Promise<string | undefined>;
}): Promise<DryLakeProviderResolution> {
  const configured = String(params.configuration.get("aiProvider", "xupra-pro-ai")) as DryLakeProviderId | "auto";
  if (configured === "databricks-api") {
    return {
      provider: new DatabricksApiProvider(params.configuration, params.readPlanningSecret),
      reason: "Planning uses your Databricks Model Serving endpoint. DryLake stores the token in VS Code SecretStorage or reads the configured environment variable.",
    };
  }

  if (configured === "claude-api") {
    return {
      provider: new ClaudeApiProvider(params.configuration, params.readPlanningSecret),
      reason: "Planning uses your Anthropic Claude API key from VS Code SecretStorage or the configured environment variable.",
    };
  }

  if (configured === "openai-api") {
    return {
      provider: new OpenAiApiProvider(params.configuration, params.readPlanningSecret),
      reason: "Planning uses your OpenAI API key from VS Code SecretStorage or the configured environment variable.",
    };
  }

  if (configured === "hermes-agent") {
    return {
      provider: new HermesCliProvider(params.configuration),
      reason: "Planning uses the local Hermes Agent CLI and its configured model/provider. DryLake does not read Hermes secrets.",
    };
  }

  const provider: DryLakeAiProvider = new XupraCloudProvider(
    params.configuration,
    params.readConnection,
    params.readAccessToken,
    params.backendConfiguration,
  );

  return {
    provider,
    reason: configured !== "xupra-pro-ai" && configured !== "auto"
      ? "DryLake planning uses Xupra AI. Free users are routed to Claude Haiku."
      : undefined,
  };
}

