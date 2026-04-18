import * as vscode from "vscode";

import type { ConnectionState, SelectedContext } from "../types/package";

const KEY = "xupra.selectedContext";
const CONNECTION_KEY = "xupra.connection";

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
}
