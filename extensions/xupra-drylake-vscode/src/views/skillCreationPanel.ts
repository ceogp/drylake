import * as vscode from "vscode";

import type { ApiClient } from "../services/apiClient";
import { requireManualExportEntitlement } from "../services/featureGates";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import { chooseTargetPlatform, ensureVersionSelection } from "../services/selection";
import type { StateStore } from "../services/stateStore";

type InboundMessage =
  | {
      type: "generate";
      requestId: string;
      name: string;
      description: string;
      targetPlatform: string;
      context?: string;
    }
  | {
      type: "export";
      requestId: string;
      content: string;
      targetPlatform: string;
      skillName: string;
    }
  | {
      type: "saveToXupra";
      requestId: string;
      content: string;
      skillName: string;
      targetPlatform: string;
    };

type OutboundMessage =
  | {
      type: "result";
      requestId: string;
      content?: string;
    }
  | {
      type: "error";
      requestId: string;
      message: string;
    }
  | {
      type: "stateUpdate";
      isLoading: boolean;
    };

const LOGICAL_PATH_BY_PLATFORM: Record<string, (slug: string) => string> = {
  claude_code: (slug) => `.claude/agents/${slug}.md`,
  claude_agents: (slug) => `.claude/agents/${slug}.md`,
  codex: (slug) => `.codex/agents/${slug}.md`,
  cursor: (slug) => `.cursor/rules/${slug}.mdc`,
};

function slugForSkillName(skillName: string) {
  return skillName.trim().toLowerCase().replace(/\s+/g, "-") || "skill";
}

function logicalPathForPlatform(targetPlatform: string, skillName: string) {
  const slug = slugForSkillName(skillName);
  return (LOGICAL_PATH_BY_PLATFORM[targetPlatform] ?? ((value: string) => `skills/${value}.md`))(slug);
}

export class SkillCreationPanel {
  private static _current: SkillCreationPanel | undefined;

  private readonly _disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly _panel: vscode.WebviewPanel,
    private readonly _context: vscode.ExtensionContext,
    private readonly _apiClient: ApiClient,
    private readonly _stateStore: StateStore,
    private readonly _configuration: vscode.WorkspaceConfiguration,
  ) {
    this._panel.onDidDispose(
      () => {
        SkillCreationPanel._current = undefined;
        this.dispose();
      },
      null,
      this._disposables,
    );

    this._panel.webview.html = this._getHtml();
    this._registerMessageHandler();
  }

  static createOrShow(
    context: vscode.ExtensionContext,
    apiClient: ApiClient,
    stateStore: StateStore,
    configuration: vscode.WorkspaceConfiguration,
  ) {
    if (SkillCreationPanel._current) {
      SkillCreationPanel._current._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "xupra.skillCreation",
      "Create Skill — Xupra DryLake",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    SkillCreationPanel._current = new SkillCreationPanel(
      panel,
      context,
      apiClient,
      stateStore,
      configuration,
    );
  }

  dispose() {
    while (this._disposables.length > 0) {
      this._disposables.pop()?.dispose();
    }
  }

  private _registerMessageHandler() {
    this._panel.webview.onDidReceiveMessage(
      async (message: InboundMessage) => {
        try {
          switch (message.type) {
            case "generate":
              await this._handleGenerate(message);
              break;
            case "export":
              await this._handleExport(message);
              break;
            case "saveToXupra":
              await this._handleSaveToXupra(message);
              break;
          }
        } catch (error) {
          await this._postMessage({
            type: "error",
            requestId: (message as { requestId?: string }).requestId ?? "unknown",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
      null,
      this._disposables,
    );
  }

  private async _handleGenerate(message: Extract<InboundMessage, { type: "generate" }>) {
    await this._postMessage({ type: "stateUpdate", isLoading: true });

    try {
      const hasEntitlement = await requireManualExportEntitlement(
        this._apiClient,
        this._stateStore,
        "AI skill creation",
      );

      if (!hasEntitlement) {
        await this._postMessage({
          type: "error",
          requestId: message.requestId,
          message: "upgrade_required",
        });
        await this._postMessage({ type: "stateUpdate", isLoading: false });
        return;
      }

      const skill = await this._apiClient.generateSkill({
        name: message.name,
        description: message.description,
        targetPlatform: message.targetPlatform,
        context: message.context,
      });

      await this._postMessage({
        type: "result",
        requestId: message.requestId,
        content: skill.skill.content,
      });
      await this._postMessage({ type: "stateUpdate", isLoading: false });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
      await this._postMessage({ type: "stateUpdate", isLoading: false });
    }
  }

  private async _handleExport(message: Extract<InboundMessage, { type: "export" }>) {
    let targetPlatform = message.targetPlatform;

    if (!targetPlatform || !LOGICAL_PATH_BY_PLATFORM[targetPlatform]) {
      const picked = await chooseTargetPlatform(this._configuration, "Choose export target");

      if (!picked) {
        await this._postMessage({
          type: "error",
          requestId: message.requestId,
          message: "cancelled",
        });
        return;
      }

      targetPlatform = picked.value;
    }

    const logicalPath = logicalPathForPlatform(targetPlatform, message.skillName);
    try {
      await writeGeneratedFilesToWorkspace([{ logicalPath, preview: message.content }]);
      void vscode.window.showInformationMessage(`Skill written to ${logicalPath}.`);
      await this._postMessage({ type: "result", requestId: message.requestId });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async _handleSaveToXupra(message: Extract<InboundMessage, { type: "saveToXupra" }>) {
    const selection = await ensureVersionSelection(this._apiClient, this._stateStore);

    if (!selection?.versionId) {
      await this._postMessage({
        type: "error",
        requestId: message.requestId,
        message: "cancelled",
      });
      return;
    }

    const logicalPath = logicalPathForPlatform(message.targetPlatform, message.skillName);
    try {
      await this._apiClient.uploadFiles(selection.versionId, [{ logicalPath, content: message.content }]);
      await this._apiClient.importVersion(selection.versionId);
      void vscode.commands.executeCommand("xupra.refreshProjects");
      void vscode.window.showInformationMessage("Skill saved to your Xupra version.");
      await this._postMessage({ type: "result", requestId: message.requestId });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private _postMessage(message: OutboundMessage) {
    return this._panel.webview.postMessage(message);
  }

  private _getHtml() {
    const extensionPath = this._context.extensionUri.toString();

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
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 760px;
      padding: 20px;
    }

    h2 {
      margin: 0 0 4px;
      font-size: 1.35em;
      font-weight: 650;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      color: var(--vscode-foreground);
      font-weight: 600;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-height: 32px;
      padding: 7px 9px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    textarea {
      min-height: 104px;
      resize: vertical;
      line-height: 1.45;
    }

    #skill-output {
      min-height: 280px;
      font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
    }

    button {
      align-self: flex-start;
      padding: 7px 12px;
      border: 1px solid var(--vscode-button-background);
      border-radius: 4px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }

    button:disabled {
      cursor: default;
      opacity: 0.6;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .status,
    .error {
      color: var(--vscode-descriptionForeground);
    }

    .error {
      padding: 8px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }

    #output-area {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
    }
  </style>
</head>
<body data-extension-path="${extensionPath}">
  <main class="panel">
    <h2>Create New Skill</h2>

    <div class="field">
      <label for="skill-name">Skill name</label>
      <input type="text" id="skill-name">
    </div>

    <div class="field">
      <label for="skill-description">Description</label>
      <input type="text" id="skill-description">
    </div>

    <div class="field">
      <label for="target-platform">Target platform</label>
      <select id="target-platform">
        <option value="claude_code">Claude Code</option>
        <option value="codex">Codex</option>
        <option value="cursor">Cursor</option>
        <option value="claude_agents">Claude Agents</option>
      </select>
    </div>

    <div class="field">
      <label for="skill-context">Context</label>
      <textarea id="skill-context"></textarea>
    </div>

    <button id="generate-btn">Generate with AI</button>
    <div id="loading" class="status" style="display:none">Generating skill…</div>
    <div id="error-message" class="error" style="display:none"></div>

    <div id="output-area" style="display:none">
      <textarea id="skill-output"></textarea>
      <div class="actions">
        <button id="export-btn">Export to Workspace</button>
        <button id="save-btn">Save to Xupra</button>
      </div>
    </div>
  </main>

  <script>
    const vscode = acquireVsCodeApi();

    function uuid() {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const skillName = document.getElementById("skill-name");
    const skillDescription = document.getElementById("skill-description");
    const targetPlatform = document.getElementById("target-platform");
    const skillContext = document.getElementById("skill-context");
    const generateBtn = document.getElementById("generate-btn");
    const loading = document.getElementById("loading");
    const outputArea = document.getElementById("output-area");
    const skillOutput = document.getElementById("skill-output");
    const exportBtn = document.getElementById("export-btn");
    const saveBtn = document.getElementById("save-btn");
    const errorMessage = document.getElementById("error-message");

    function showError(message) {
      errorMessage.innerHTML = escapeHtml(message);
      errorMessage.style.display = "block";
    }

    function clearError() {
      errorMessage.textContent = "";
      errorMessage.style.display = "none";
    }

    generateBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "generate",
        requestId: uuid(),
        name: skillName.value,
        description: skillDescription.value,
        targetPlatform: targetPlatform.value,
        context: skillContext.value
      });
    });

    exportBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "export",
        requestId: uuid(),
        content: skillOutput.value,
        targetPlatform: targetPlatform.value,
        skillName: skillName.value
      });
    });

    saveBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "saveToXupra",
        requestId: uuid(),
        content: skillOutput.value,
        skillName: skillName.value,
        targetPlatform: targetPlatform.value
      });
    });

    window.addEventListener("message", function(event) {
      const message = event.data;

      if (message.type === "stateUpdate") {
        loading.style.display = message.isLoading ? "block" : "none";
        generateBtn.disabled = Boolean(message.isLoading);
      }

      if (message.type === "result" && message.content) {
        skillOutput.value = message.content;
        outputArea.style.display = "flex";
        clearError();
      }

      if (message.type === "error") {
        loading.style.display = "none";
        generateBtn.disabled = false;

        if (message.message === "upgrade_required") {
          return;
        }

        showError(message.message || "Something went wrong.");
      }
    });
  </script>
</body>
</html>`;
  }
}
