import * as vscode from "vscode";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

import type { ApiClient } from "../services/apiClient";
import type { StateStore } from "../services/stateStore";
import type {
  DetectedWorkspaceFile,
  EntitlementMap,
  ImportedWorkspaceSnapshot,
  SelectedContext,
} from "../types/package";

export type SidebarState = {
  connected: boolean;
  userEmail?: string;
  userAvatarUrl?: string | null;
  orgName?: string;
  orgTier?: string;
  entitlements?: EntitlementMap;
  detectedFiles: DetectedWorkspaceFile[];
  importedWorkspace: ImportedWorkspaceSnapshot | null;
  selection: SelectedContext;
  isLoading: boolean;
};

type InboundAction =
  | "connect"
  | "importWorkspace"
  | "importDefaultLocations"
  | "importFolder"
  | "openBilling"
  | "openDashboard"
  | "openSettings"
  | "signOut"
  | "refreshPlan"
  | "createAgent"
  | "exportPreview"
  | "installToRuntime"
  ;

type BasicInboundMessage = {
  [Action in InboundAction]: {
    type: Action;
    requestId: string;
  };
}[InboundAction];

type InboundMessage =
  | BasicInboundMessage
  | {
      type: "openImportedAgent";
      requestId: string;
      subagentId: string;
    }
  | {
      type: "openImportedSkill";
      requestId: string;
      skillRuleId: string;
    }
  | {
      type: "uninstallImportedAgent";
      requestId: string;
      subagentId: string;
    }
  | {
      type: "uninstallImportedSkill";
      requestId: string;
      skillRuleId: string;
    }
  | {
      type: "clearImportCache";
      requestId: string;
    }
  | {
      type: "optimizeFile";
      requestId: string;
      logicalPath: string;
    }
  | {
      type: "openRawFile";
      requestId: string;
      logicalPath: string;
    };

type OutboundMessage =
  | {
      type: "stateUpdate";
      state: SidebarState;
    }
  | {
      type: "result";
      requestId: string;
      result?: unknown;
    }
  | {
      type: "error";
      requestId: string;
      message: string;
    };

function loadXupraMarkDataUri(): string {
  // Bundled extension lives at <ext>/dist/extension.js, media/ is a sibling of dist/.
  const candidates = [
    path.join(__dirname, "..", "media", "xupra-mark.webp"),
    path.join(__dirname, "media", "xupra-mark.webp"),
  ];
  for (const candidate of candidates) {
    try {
      const buffer = fs.readFileSync(candidate);
      return "data:image/webp;base64," + buffer.toString("base64");
    } catch {
      // try next
    }
  }
  return "";
}

const XUPRA_MARK_DATA_URI = loadXupraMarkDataUri();

export class WorkspaceSidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly stateStore: StateStore,
    private readonly apiClient: ApiClient,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    this._view = webviewView;
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (message: InboundMessage) => {
      try {
        switch (message.type) {
          case "connect":
            await vscode.commands.executeCommand("xupra.connect");
            break;
          case "importWorkspace":
            await vscode.commands.executeCommand("xupra.importWorkspace");
            break;
          case "importDefaultLocations":
            await vscode.commands.executeCommand("xupra.importDefaultLocations");
            break;
          case "importFolder":
            await vscode.commands.executeCommand("xupra.importFolder");
            break;
          case "openBilling":
            await vscode.commands.executeCommand("xupra.openBilling");
            break;
          case "openDashboard":
            await vscode.commands.executeCommand("xupra.openWebApp");
            break;
          case "openSettings":
            await vscode.commands.executeCommand("xupra.openSettings");
            break;
          case "signOut":
            await vscode.commands.executeCommand("xupra.signOut");
            break;
          case "refreshPlan":
            await vscode.commands.executeCommand("xupra.refreshPlan");
            break;
          case "createAgent":
            await vscode.commands.executeCommand("xupra.createAgent");
            break;
          case "exportPreview":
            await vscode.commands.executeCommand("xupra.exportPreview");
            break;
          case "installToRuntime":
            await vscode.commands.executeCommand("xupra.installToRuntime");
            break;
          case "openImportedSkill":
            await vscode.commands.executeCommand("xupra.openImportedSkill", message.skillRuleId);
            break;
          case "openImportedAgent":
            await vscode.commands.executeCommand("xupra.openImportedAgent", message.subagentId);
            break;
          case "uninstallImportedAgent":
            await vscode.commands.executeCommand("xupra.uninstallImportedAgent", message.subagentId);
            break;
          case "uninstallImportedSkill":
            await vscode.commands.executeCommand("xupra.uninstallImportedSkill", message.skillRuleId);
            break;
          case "clearImportCache":
            await vscode.commands.executeCommand("xupra.clearImportCache");
            break;
          case "optimizeFile": {
            const uri = await this.resolveLogicalPathUri(message.logicalPath);
            if (!uri) {
              void vscode.window.showWarningMessage(
                `Could not locate ${message.logicalPath} in the workspace or runtime directories.`,
              );
              break;
            }
            await vscode.commands.executeCommand("xupra.optimizeFile", uri);
            break;
          }
          case "openRawFile": {
            const uri = await this.resolveLogicalPathUri(message.logicalPath);
            if (!uri) {
              void vscode.window.showWarningMessage(
                `Could not locate ${message.logicalPath}. The file may have been deleted.`,
              );
              break;
            }
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, { preview: false });
            break;
          }
        }
        await webviewView.webview.postMessage({
          type: "result",
          requestId: message.requestId,
        } satisfies OutboundMessage);
      } catch (error) {
        const outbound: OutboundMessage = {
          type: "error",
          requestId: message.requestId,
          message: error instanceof Error ? error.message : String(error),
        };
        await webviewView.webview.postMessage(outbound);
      }
    });

    this.postState(this._buildState());
  }

  postState(state: SidebarState) {
    if (!this._view) {
      return;
    }

    const message: OutboundMessage = { type: "stateUpdate", state };
    void this._view.webview.postMessage(message);
  }

  private async resolveLogicalPathUri(logicalPath: string): Promise<vscode.Uri | null> {
    const normalized = logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) {
      return null;
    }

    const segments = normalized.split("/").filter(Boolean);

    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (root) {
      const candidate = vscode.Uri.joinPath(root, ...segments);
      try {
        await vscode.workspace.fs.stat(candidate);
        return candidate;
      } catch {
        // fall through to runtime locations
      }
    }

    const homeUri = vscode.Uri.file(os.homedir());
    const runtimeCandidates: string[][] = [];
    if (segments[0] === ".codex" || segments[0] === ".claude" || segments[0] === ".cursor") {
      runtimeCandidates.push(segments);
    } else if (normalized === "AGENTS.md") {
      runtimeCandidates.push([".codex", "AGENTS.md"]);
    } else if (normalized === "CLAUDE.md") {
      runtimeCandidates.push([".claude", "CLAUDE.md"]);
    }

    for (const candidateSegments of runtimeCandidates) {
      const candidate = vscode.Uri.joinPath(homeUri, ...candidateSegments);
      try {
        await vscode.workspace.fs.stat(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }

    // Final fallback: server-backed read-only virtual document.
    const versionId = this.stateStore.getSelection().versionId;
    if (versionId) {
      return vscode.Uri.from({
        scheme: "xupra-imported",
        authority: versionId,
        path: "/" + normalized,
      });
    }

    return null;
  }

  private _buildState(): SidebarState {
    const connection = this.stateStore.getConnection();
    const detectedFiles = this.stateStore.getDetectedFiles();
    const selection = this.stateStore.getSelection();

    return {
      connected: Boolean(connection.userEmail),
      userEmail: connection.userEmail,
      userAvatarUrl: connection.userAvatarUrl,
      orgName: connection.organizationName,
      orgTier: connection.organizationTier,
      entitlements: connection.entitlements,
      detectedFiles,
      importedWorkspace: null,
      selection,
      isLoading: false,
    };
  }

  private _getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    button {
      font: inherit;
      color: var(--vscode-foreground);
    }

    button:disabled {
      cursor: default;
      opacity: 0.65;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 12px;
    }

    .account-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      border-radius: 50%;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font-weight: 700;
      text-transform: uppercase;
      overflow: hidden;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      grid-area: 1 / 1;
    }

    .avatar-initial {
      grid-area: 1 / 1;
    }

    .account-info {
      min-width: 0;
      flex: 1;
    }

    .account-email {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .account-org {
      margin-top: 2px;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.92em;
    }

    .plan-badge {
      flex: 0 0 auto;
      padding: 2px 7px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-size: 0.85em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .plan-badge.pro {
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      border-color: var(--vscode-badge-background);
    }

    .upgrade-btn {
      width: 100%;
      margin-top: 8px;
      padding: 6px 9px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 4px;
      cursor: pointer;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 2px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 22px;
    }

    .section-label {
      font-weight: 650;
    }

    .section-count {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      background: var(--vscode-editor-background);
    }

    .file-button {
      width: 100%;
      text-align: left;
      cursor: pointer;
      color: var(--vscode-foreground);
      font: inherit;
    }

    .item-trash {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      padding: 0;
      margin-left: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
    }

    .item-trash:hover {
      color: var(--vscode-errorForeground, var(--vscode-foreground));
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
      border-color: var(--vscode-panel-border);
    }

    .item-optimize {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #ffffff;
      background: #E85420;
      border: 1px solid #C24315;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      padding: 5px 9px;
      white-space: nowrap;
      cursor: pointer;
      align-self: flex-start;
      margin: 4px 8px 8px 8px;
    }

    .item-optimize:hover {
      background: #FF6A36;
      border-color: #E85420;
      color: #ffffff;
    }

    .item-optimize .optimize-mark {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      object-fit: cover;
      display: inline-block;
    }

    .file-path {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-tag {
      flex: 0 0 auto;
      padding: 1px 5px;
      border-radius: 999px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 0.8em;
    }

    .file-group {
      margin-bottom: 6px;
    }

    .file-group-header {
      color: var(--vscode-descriptionForeground);
      font-size: 0.82em;
      letter-spacing: 0.04em;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    .item-stack {
      display: flex;
      min-width: 0;
      flex: 1;
      flex-direction: column;
      gap: 2px;
    }

    .item-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
    }

    .item-meta {
      min-width: 0;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.82em;
    }

    .selection-hint {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .action-row {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      color: var(--vscode-foreground);
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      cursor: pointer;
    }

    .action-btn.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
    }

    .group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      background: var(--vscode-editor-background);
    }

    .group-label {
      font-weight: 500;
    }

    .platform-tags {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .group-count {
      color: var(--vscode-descriptionForeground);
    }

    .actions-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .big-action {
      width: 100%;
      min-height: 34px;
      padding: 8px 10px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      cursor: pointer;
      text-align: left;
    }

    .big-action.locked {
      color: var(--vscode-descriptionForeground);
    }

    .lock-icon {
      float: right;
      color: var(--vscode-descriptionForeground);
    }

    .connect-cta {
      display: flex;
      min-height: 180px;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      padding: 18px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
      text-align: center;
    }

    .connect-title {
      font-weight: 700;
      font-size: 1.08em;
    }

    .connect-subtitle {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .empty-state {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .more-line {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const vscode = acquireVsCodeApi();
    const XUPRA_MARK_DATA_URI = ${JSON.stringify(XUPRA_MARK_DATA_URI)};

    function uuid() {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }

    const categoryTags = {
      instruction: "Instructions",
      skill: "Skills",
      subagent: "Agents",
      rule: "Rules",
      agent_config: "Config",
      source: "Source"
    };
    let latestState = { connected: false, detectedFiles: [], importedWorkspace: null, selection: {}, isLoading: true };
    let pendingAction = null;

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function accountInitial(email) {
      return escapeHtml((email || "X").slice(0, 1));
    }

    function renderAvatar(state) {
      const imageUrl = state.userAvatarUrl ? String(state.userAvatarUrl) : "";
      if (!imageUrl) {
        return '<div class="avatar"><span class="avatar-initial">' + accountInitial(state.userEmail) + '</span></div>';
      }

      return '<div class="avatar"><span class="avatar-initial">' + accountInitial(state.userEmail) + '</span><img src="' + escapeHtml(imageUrl) + '" alt="" onerror="this.remove()"></div>';
    }

    function planClass(tier) {
      const normalized = String(tier || "free").toLowerCase();
      return normalized === "pro" || normalized === "enterprise" ? "plan-badge pro" : "plan-badge";
    }

    function renderDetectedFiles(state) {
      const files = Array.isArray(state.detectedFiles) ? state.detectedFiles : [];
      const count = files.length;
      let html = '<div class="section"><div class="section-header"><span class="section-label">Detected files</span><span class="section-count">' + count + '</span></div>';

      if (count === 0) {
        html += '<div class="empty-state">No supported files detected yet.</div>';
        const isDefaultSyncing = pendingAction === "importDefaultLocations";
        html += '<div class="action-row"><button class="action-btn primary" data-action="importDefaultLocations"' + (isDefaultSyncing ? " disabled" : "") + '>' + (isDefaultSyncing ? "Syncing..." : "Sync Default Locations") + '</button></div>';
        return html + '</div>';
      }

      const categoryOrder = ["instruction", "skill", "subagent", "rule", "agent_config", "source"];
      const groupedFiles = files.reduce(function(groups, file) {
        const category = file.category;
        if (!groups[category]) {
          groups[category] = [];
        }

        groups[category].push(file);
        return groups;
      }, {});

      categoryOrder.forEach(function(category) {
        const groupFiles = groupedFiles[category] || [];
        if (groupFiles.length === 0) {
          return;
        }

        const label = categoryTags[category] || "Files";
        html += '<div class="file-group">';
        html += '<div class="file-group-header">&#9472;&#9472; ' + escapeHtml(label) + ' (' + groupFiles.length + ') &#9472;&#9472;</div>';
        html += groupFiles.map(function(file) {
          return '<div class="file-item"><span class="file-path" title="' + escapeHtml(file.logicalPath) + '">' + escapeHtml(file.logicalPath) + '</span></div>';
        }).join("");
        html += '</div>';
      });

      const isSyncing = pendingAction === "importWorkspace";
      const isFolderSyncing = pendingAction === "importFolder";
      html += '<div class="action-row"><button class="action-btn primary" data-action="importWorkspace"' + (isSyncing ? " disabled" : "") + '>' + (isSyncing ? "Syncing..." : "Sync to Xupra") + '</button><button class="action-btn" data-action="importFolder"' + (isFolderSyncing ? " disabled" : "") + '>' + (isFolderSyncing ? "Syncing..." : "From Folder") + '</button></div>';
      return html + '</div>';
    }

    function formatPlatform(slug) {
      const labels = {
        claude_code: "Claude Code",
        claude_agents: "Claude Agents",
        codex: "Codex",
        cursor: "Cursor",
        generic: "Generic"
      };
      const normalized = String(slug || "");
      return labels[normalized] || (normalized ? normalized.slice(0, 1).toUpperCase() + normalized.slice(1) : "");
    }

    function renderPlatformTags(platforms) {
      const visiblePlatforms = (Array.isArray(platforms) ? platforms : []).filter(function(platform) {
        return platform && String(platform).toLowerCase() !== "generic";
      });

      if (visiblePlatforms.length === 0) {
        return "";
      }

      return '<span class="platform-tags">' + visiblePlatforms.map(function(platform) {
        return '<span class="file-tag">' + escapeHtml(formatPlatform(platform)) + '</span>';
      }).join("") + '</span>';
    }

    function uniquePlatforms(items, readPlatform) {
      const seen = new Set();
      return items.reduce(function(platforms, item) {
        const platform = String(readPlatform(item) || "").toLowerCase();

        if (!platform || platform === "generic" || seen.has(platform)) {
          return platforms;
        }

        seen.add(platform);
        platforms.push(platform);
        return platforms;
      }, []);
    }

    function renderImportedEntries(entries, options) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return "";
      }

      const limit = options.limit || 5;
      const visibleEntries = entries.slice(0, limit);
      const platforms = uniquePlatforms(entries, options.readPlatform);
      let html = '<div class="file-group">';
      html += '<div class="section-header"><span class="section-label">' + escapeHtml(options.label) + '</span><span class="section-count">' + entries.length + '</span></div>';

      if (platforms.length > 0) {
        html += renderPlatformTags(platforms);
      }

      html += visibleEntries.map(function(entry) {
        const title = options.readTitle(entry);
        const meta = options.readMeta(entry);
        const tag = options.readTag(entry);
        const openId = options.readId ? options.readId(entry) : "";
        const optimizePath = options.readOptimizePath ? options.readOptimizePath(entry) : "";
        const itemHtml = '<div class="item-stack"><span class="item-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>' + (meta ? '<span class="item-meta" title="' + escapeHtml(meta) + '">' + escapeHtml(meta) + '</span>' : '') + '</div>' + (tag ? '<span class="file-tag">' + escapeHtml(tag) + '</span>' : '');
        const optimizeHtml = optimizePath
          ? '<button type="button" class="item-optimize" title="Optimize with Xupra AI (Pro)" data-optimize-path="' + escapeHtml(optimizePath) + '" aria-label="Improve with Xupra AI">' + (XUPRA_MARK_DATA_URI ? '<img class="optimize-mark" src="' + XUPRA_MARK_DATA_URI + '" alt="" />' : '') + '<span>improve w/ Xupra AI</span></button>'
          : '';

        if (options.actionType === 'openImportedSkill' && openId) {
          const trashHtml = '<button type="button" class="item-trash" title="Uninstall (delete runtime file)" data-uninstall-imported-skill-id="' + escapeHtml(openId) + '" aria-label="Uninstall imported skill">\u{1F5D1}</button>';
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><div style="display:flex;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-imported-skill-id="' + escapeHtml(openId) + '">' + itemHtml + '</button>' + trashHtml + '</div>' + optimizeHtml + '</div>';
        }

        if (options.actionType === 'openImportedAgent' && openId) {
          const trashHtml = '<button type="button" class="item-trash" title="Uninstall (delete runtime file)" data-uninstall-imported-agent-id="' + escapeHtml(openId) + '" aria-label="Uninstall imported agent">\u{1F5D1}</button>';
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><div style="display:flex;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-imported-agent-id="' + escapeHtml(openId) + '">' + itemHtml + '</button>' + trashHtml + '</div>' + optimizeHtml + '</div>';
        }

        if (options.actionType === 'openRawFile' && optimizePath) {
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-raw-path="' + escapeHtml(optimizePath) + '">' + itemHtml + '</button>' + optimizeHtml + '</div>';
        }

        return '<div class="file-item">' + itemHtml + '</div>';
      }).join("");

      if (entries.length > visibleEntries.length) {
        html += '<div class="more-line">+' + (entries.length - visibleEntries.length) + ' more</div>';
      }

      return html + '</div>';
    }

    function renderImportedWorkspace(state) {
      const workspace = state.importedWorkspace;
      let html = '<div class="section"><div class="section-header"><span class="section-label">Imported skills &amp; agents</span></div>';

      if (!workspace) {
        if (!state.selection || !state.selection.versionId) {
          html += '<div class="selection-hint">Choose a target version, then import a workspace to review imported agents, skills, rules, and source files.</div>';
        } else {
          html += '<div class="empty-state">No imported workspace is loaded for the selected version yet. Run an import or refresh after the import job completes.</div>';
        }
        return html + '</div>';
      }

      const skills = (workspace.skillRules || []).filter(function(rule) {
        return String(rule.kind || "").toLowerCase() === "skill";
      });
      const rules = (workspace.skillRules || []).filter(function(rule) {
        return String(rule.kind || "").toLowerCase() === "rule";
      });
      const promptFragments = (workspace.skillRules || []).filter(function(rule) {
        const kind = String(rule.kind || "").toLowerCase();
        return kind && kind !== "skill" && kind !== "rule";
      });

      if ((workspace.subagents || []).length === 0 && skills.length === 0 && rules.length === 0 && promptFragments.length === 0 && (workspace.files || []).length === 0) {
        html += '<div class="empty-state">The selected version has no imported agents, skills, rules, or raw files yet.</div>';
        return html + '</div>';
      }

      html += renderImportedEntries(workspace.subagents || [], {
        label: 'Agents',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || entry.slug || 'Imported agent'; },
        readMeta: function(entry) { return entry.sourcePath || entry.slug || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readId: function(entry) { return entry.id || ''; },
        readOptimizePath: function(entry) { return entry.sourcePath || ''; },
        actionType: 'openImportedAgent',
      });

      html += renderImportedEntries(skills, {
        label: 'Skills',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported skill'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readId: function(entry) { return entry.id || ''; },
        readOptimizePath: function(entry) { return entry.sourcePath || ''; },
        actionType: 'openImportedSkill',
      });

      html += renderImportedEntries(rules, {
        label: 'Rules',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported rule'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
      });

      html += renderImportedEntries(promptFragments, {
        label: 'Prompt Fragments',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported prompt'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
      });

      html += renderImportedEntries(workspace.files || [], {
        label: 'Raw Files',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.logicalPath || 'Raw file'; },
        readMeta: function(entry) { return entry.sourceFormat || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readOptimizePath: function(entry) { return entry.logicalPath || ''; },
        actionType: 'openRawFile',
      });

      return html + '</div>';
    }

    function renderActions(state) {
      const tier = String(state.orgTier || "").toLowerCase();
      const isPro = tier === "pro" || tier === "enterprise";
      const exportClass = isPro ? "big-action" : "big-action locked";
      const lockSuffix = '<span class="lock-icon">🔒 Pro</span>';

      return '<div class="section"><div class="section-header"><span class="section-label">Actions</span></div><div class="actions-section">'
        + '<button class="big-action" data-action="createAgent">Create Agent</button>'
        + '<button class="' + exportClass + '" data-action="exportPreview">Preview Generated Files' + (isPro ? "" : lockSuffix) + '</button>'
        + '<button class="' + exportClass + '" data-action="installToRuntime">Install to platforms' + (isPro ? "" : lockSuffix) + '</button>'
        + '</div></div>';
    }

    function renderConnected(state) {
      const tier = state.orgTier || "free";
      const org = state.orgName || "Xupra";
      let html = '<div class="panel">';
      html += '<div><div class="account-bar">' + renderAvatar(state) + '<div class="account-info"><div class="account-email">' + escapeHtml(state.userEmail || "") + '</div><div class="account-org">' + escapeHtml(org) + '</div></div><button class="' + planClass(tier) + '" data-action="refreshPlan">' + escapeHtml(tier) + '</button></div>';
      if (String(tier).toLowerCase() !== "pro" && String(tier).toLowerCase() !== "enterprise") {
        html += '<button class="upgrade-btn" data-action="openBilling">Upgrade</button>';
      }
      html += '</div>';
      html += renderDetectedFiles(state);
      html += renderImportedWorkspace(state);
      html += renderActions(state);
      html += '<div class="action-row"><button class="action-btn" data-action="openDashboard">Dashboard</button><button class="action-btn" data-action="openSettings">Settings</button><button class="action-btn" data-action="signOut">Sign Out</button></div>';
      html += '</div>';
      return html;
    }

    function renderDisconnected(state) {
      const loading = state && state.isLoading ? "Loading workspace..." : "Connect your Xupra account to import and move agent workspace files.";
      return '<div class="panel"><div class="connect-cta"><div class="connect-title">Xupra DryLake</div><div class="connect-subtitle">' + escapeHtml(loading) + '</div><button class="action-btn primary" data-action="connect">Connect Xupra</button></div></div>';
    }

    function render(state) {
      const root = document.getElementById("root");
      if (!root) {
        return;
      }

      latestState = state || latestState;
      root.innerHTML = state && state.connected ? renderConnected(state) : renderDisconnected(state || {});
    }

    window.addEventListener("message", function(event) {
      if (event.data.type === "stateUpdate") {
        render(event.data.state);
      }

      if (event.data.type === "result" || event.data.type === "error") {
        pendingAction = null;
        render(latestState);
      }
    });

    document.addEventListener("click", function(event) {
      const optimizeBtn = event.target.closest("[data-optimize-path]");
      if (optimizeBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "optimizeFile",
          requestId: uuid(),
          logicalPath: optimizeBtn.dataset.optimizePath,
        });
        return;
      }

      const uninstallAgentBtn = event.target.closest("[data-uninstall-imported-agent-id]");
      if (uninstallAgentBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "uninstallImportedAgent",
          requestId: uuid(),
          subagentId: uninstallAgentBtn.dataset.uninstallImportedAgentId,
        });
        return;
      }

      const uninstallSkillBtn = event.target.closest("[data-uninstall-imported-skill-id]");
      if (uninstallSkillBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "uninstallImportedSkill",
          requestId: uuid(),
          skillRuleId: uninstallSkillBtn.dataset.uninstallImportedSkillId,
        });
        return;
      }

      const rawFileBtn = event.target.closest("[data-open-raw-path]");
      if (rawFileBtn) {
        vscode.postMessage({
          type: "openRawFile",
          requestId: uuid(),
          logicalPath: rawFileBtn.dataset.openRawPath,
        });
        return;
      }

      const agentBtn = event.target.closest("[data-open-imported-agent-id]");
      if (agentBtn) {
        vscode.postMessage({
          type: "openImportedAgent",
          requestId: uuid(),
          subagentId: agentBtn.dataset.openImportedAgentId,
        });
        return;
      }

      const skillBtn = event.target.closest("[data-open-imported-skill-id]");
      if (skillBtn) {
        vscode.postMessage({
          type: "openImportedSkill",
          requestId: uuid(),
          skillRuleId: skillBtn.dataset.openImportedSkillId,
        });
        return;
      }

      const btn = event.target.closest("[data-action]");
      if (!btn || btn.disabled) {
        return;
      }

      pendingAction = btn.dataset.action;
      render(latestState);
      vscode.postMessage({ type: btn.dataset.action, requestId: uuid() });
    });

    render({ connected: false, detectedFiles: [], importedWorkspace: null, selection: {}, isLoading: true });
  </script>
</body>
</html>`;
  }
}
