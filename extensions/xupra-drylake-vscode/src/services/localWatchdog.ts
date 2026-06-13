import * as vscode from "vscode";

import { connectionHasEntitlement } from "./connectionState";
import { StateStore } from "./stateStore";

const WATCH_PATTERNS = [
  { glob: "**/.vscode/mcp.json", category: "MCP config" },
  { glob: "**/.cursor/mcp.json", category: "MCP config" },
  { glob: "**/.mcp.json", category: "MCP config" },
  { glob: "**/mcp.json", category: "MCP config" },
  { glob: "**/CLAUDE.md", category: "agent rules" },
  { glob: "**/AGENTS.md", category: "agent rules" },
  { glob: "**/.cursor/rules/**", category: "agent rules" },
  { glob: "**/.cursorrules", category: "agent rules" },
  { glob: "**/package.json", category: "package scripts" },
  { glob: "**/package-lock.json", category: "lockfile" },
  { glob: "**/pnpm-lock.yaml", category: "lockfile" },
  { glob: "**/yarn.lock", category: "lockfile" },
  { glob: "**/.env", category: "secret hygiene" },
  { glob: "**/.env.*", category: "secret hygiene" },
  { glob: "**/.github/workflows/*.{yml,yaml}", category: "CI/CD" },
  { glob: "**/Dockerfile", category: "deployment surface" },
  { glob: "**/*.tf", category: "infrastructure" },
  { glob: "**/k8s/**/*.{yml,yaml}", category: "infrastructure" },
];

export class LocalWatchdog implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private enabled = false;
  private lastAlertByPath = new Map<string, number>();

  constructor(private readonly stateStore: StateStore) {}

  syncFromEntitlements() {
    const shouldEnable = connectionHasEntitlement(this.stateStore.getConnection(), "canUseLocalWatchdog");

    if (shouldEnable && !this.enabled) {
      this.start();
      return;
    }

    if (!shouldEnable && this.enabled) {
      this.stop();
    }
  }

  private start() {
    this.enabled = true;

    for (const pattern of WATCH_PATTERNS) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern.glob);
      const handler = (uri: vscode.Uri) => this.notify(pattern.category, uri);
      watcher.onDidCreate(handler, undefined, this.disposables);
      watcher.onDidChange(handler, undefined, this.disposables);
      watcher.onDidDelete(handler, undefined, this.disposables);
      this.disposables.push(watcher);
    }
  }

  private stop() {
    this.enabled = false;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
    this.lastAlertByPath.clear();
  }

  private notify(category: string, uri: vscode.Uri) {
    const relativePath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
    const now = Date.now();
    const lastAlert = this.lastAlertByPath.get(relativePath) ?? 0;

    if (now - lastAlert < 15_000) {
      return;
    }

    this.lastAlertByPath.set(relativePath, now);
    void vscode.window.showWarningMessage(
      `DryLake Watchdog noticed a ${category} change: ${relativePath}`,
      "Rerun Guard Scan",
    ).then((selected) => {
      if (selected === "Rerun Guard Scan") {
        void vscode.commands.executeCommand("drylake.scanAiCodingSetup");
      }
    });
  }

  dispose() {
    this.stop();
  }
}
