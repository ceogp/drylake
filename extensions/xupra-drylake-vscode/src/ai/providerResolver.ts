import type * as vscode from "vscode";

import { XupraCloudProvider } from "./providers/xupraCloudProvider";
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
}): Promise<DryLakeProviderResolution> {
  const configured = String(params.configuration.get("aiProvider", "xupra-pro-ai")) as DryLakeProviderId | "auto";
  const provider: DryLakeAiProvider = new XupraCloudProvider(
    params.configuration,
    params.readConnection,
    params.readAccessToken,
    params.backendConfiguration,
  );

  return {
    provider,
    reason: configured !== "xupra-pro-ai" && configured !== "auto"
      ? "DryLake planning uses Xupra AI. Free users are routed to the nano planning model."
      : undefined,
  };
}

