import type * as vscode from "vscode";

import { ClipboardProvider } from "./providers/clipboardProvider";
import { VscodeLmProvider } from "./providers/vscodeLmProvider";
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
  const configured = String(params.configuration.get("aiProvider", "auto")) as DryLakeProviderId | "auto";
  const providers: Record<DryLakeProviderId, DryLakeAiProvider> = {
    "xupra-pro-ai": new XupraCloudProvider(
      params.configuration,
      params.readConnection,
      params.readAccessToken,
      params.backendConfiguration,
    ),
    "user-ide-ai": new VscodeLmProvider(),
    "external-ai-prompt": new ClipboardProvider(),
  };

  if (configured !== "auto") {
    return { provider: providers[configured] ?? providers["external-ai-prompt"] };
  }

  const fallbackReasons: string[] = [];
  for (const candidate of [providers["xupra-pro-ai"], providers["user-ide-ai"]]) {
    const availability = await candidate.isAvailable();
    if (availability.available) {
      return {
        provider: candidate,
        reason: fallbackReasons.length > 0 ? fallbackReasons.join(" ") : undefined,
      };
    }

    if (availability.reason) {
      fallbackReasons.push(`${candidate.label}: ${availability.reason}`);
    } else {
      fallbackReasons.push(`${candidate.label} unavailable.`);
    }
  }

  return {
    provider: providers["external-ai-prompt"],
    reason: fallbackReasons.length > 0 ? fallbackReasons.join(" ") : undefined,
  };
}

