import * as vscode from "vscode";

import type { ConnectionState, DetectedWorkspaceFile, SelectedContext } from "../types/package";

const KEY = "xupra.selectedContext";
const CONNECTION_KEY = "xupra.connection";
const DETECTED_FILES_KEY = "xupra.detectedFiles";
const ACCESS_TOKEN_KEY = "xupra.extensionAccessToken";

export class StateStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getSelection(): SelectedContext {
    return this.context.workspaceState.get<SelectedContext>(KEY, {});
  }

  async setSelection(next: SelectedContext) {
    const current = this.getSelection();
    await this.context.workspaceState.update(KEY, {
      ...current,
      ...next
    });
  }

  async clear() {
    await this.context.workspaceState.update(KEY, {});
  }

  getConnection(): ConnectionState {
    return this.context.workspaceState.get<ConnectionState>(CONNECTION_KEY, {});
  }

  async setConnection(next: ConnectionState) {
    const current = this.getConnection();
    await this.context.workspaceState.update(CONNECTION_KEY, {
      ...current,
      ...next
    });
  }

  getDetectedFiles(): DetectedWorkspaceFile[] {
    return this.context.workspaceState.get<DetectedWorkspaceFile[]>(DETECTED_FILES_KEY, []);
  }

  async setDetectedFiles(files: DetectedWorkspaceFile[]) {
    await this.context.workspaceState.update(DETECTED_FILES_KEY, files);
  }

  async getAccessToken() {
    return this.context.secrets.get(ACCESS_TOKEN_KEY);
  }

  async setAccessToken(token: string) {
    await this.context.secrets.store(ACCESS_TOKEN_KEY, token);
  }

  async clearAccessToken() {
    await this.context.secrets.delete(ACCESS_TOKEN_KEY);
  }
}
