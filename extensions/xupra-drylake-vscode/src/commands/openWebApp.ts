import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";

export async function openWebAppCommand(apiClient: ApiClient) {
  await vscode.env.openExternal(apiClient.openWebUrl("/workspace"));
}
