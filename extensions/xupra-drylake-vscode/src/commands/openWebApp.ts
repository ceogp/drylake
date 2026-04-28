import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";

export async function openWebAppCommand(apiClient: ApiClient, versionId?: string) {
  await vscode.env.openExternal(apiClient.openWebUrl(versionId ? `/versions/${versionId}` : "/workspace"));
}
