import type * as vscode from "vscode";

import { ClipboardProvider } from "./providers/clipboardProvider";
import { VscodeLmProvider } from "./providers/vscodeLmProvider";
import { XupraCloudProvider } from "./providers/xupraCloudProvider";
import type { DryLakeAiProvider, DryLakeProviderId } from "./DryLakeAiProvider";
import type { ConnectionState } from "../types/package";

export async function resolveDryLakeAiProvider(params: {
  configuration: vscode.WorkspaceConfiguration;
  readConnection: () => ConnectionState;
  readAccessToken: () => Promise<string | undefined>;
}): Promise<DryLakeAiProvider> {
  const configured = String(params.configuration.get("aiProvider", "auto")) as DryLakeProviderId | "auto";
  const providers: Record<DryLakeProviderId, DryLakeAiProvider> = {
    "xupra-pro-ai": new XupraCloudProvider(params.configuration, params.readConnection, params.readAccessToken),
    "user-ide-ai": new VscodeLmProvider(),
    "external-ai-prompt": new ClipboardProvider(),
  };

  if (configured !== "auto") {
    return providers[configured] ?? providers["external-ai-prompt"];
  }

  for (const provider of [providers["xupra-pro-ai"], providers["user-ide-ai"]]) {
    const availability = await provider.isAvailable();
    if (availability.available) {
      return provider;
    }
  }

  return providers["external-ai-prompt"];
}

