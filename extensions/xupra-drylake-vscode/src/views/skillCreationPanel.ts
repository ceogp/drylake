import * as vscode from "vscode";

import type { ApiClient } from "../services/apiClient";
import { requireXupraProAiEntitlement } from "../services/featureGates";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import type { StateStore } from "../services/stateStore";

type InboundMessage =
  | {
      type: "startBlank";
      requestId: string;
      name: string;
      description: string;
      targetPlatform: string;
      context?: string;
    }
  | {
      type: "generate";
      requestId: string;
      name: string;
      description: string;
      targetPlatform: string;
      context?: string;
    }
  ;

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
  codex: (slug) => `.codex/agents/${slug}.toml`,
  cursor: (slug) => `.cursor/rules/${slug}.mdc`,
  windsurf: (slug) => `.windsurf/rules/${slug}.md`,
  cline: (slug) => `.clinerules/${slug}.md`,
  roo: (slug) => `.roo/rules/${slug}.md`,
  copilot: () => ".github/copilot-instructions.md",
  gemini: () => "GEMINI.md",
  junie: () => ".junie/guidelines.md",
  warp: () => "WARP.md",
  generic: () => ".rules",
};

function slugForAgentName(agentName: string) {
  return (
    agentName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

function logicalPathForPlatform(targetPlatform: string, agentName: string) {
  const slug = slugForAgentName(agentName);
  return (LOGICAL_PATH_BY_PLATFORM[targetPlatform] ?? ((value: string) => `.agents/agents/${value}.md`))(slug);
}

function escapeTomlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeYamlString(value: string) {
  return value.replace(/"/g, '\\"');
}

function buildMarkdownAgent(params: {
  name: string;
  description: string;
  targetPlatform: string;
  context?: string;
}) {
  const name = params.name.trim() || "New Agent";
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();

  return [
    "---",
    `name: "${escapeYamlString(name)}"`,
    `description: "${escapeYamlString(description)}"`,
    `targetPlatform: "${escapeYamlString(params.targetPlatform)}"`,
    "tools: []",
    "---",
    "",
    `# ${name}`,
    "",
    description,
    ...(context ? ["", "## Codebase Context", "", context] : []),
    "",
    "## Operating Guidance",
    "",
    "- Understand the user's goal before changing code.",
    "- Follow the conventions already present in the current repository.",
    "- Keep changes scoped to the requested work.",
    "- Validate meaningful behavior before finishing.",
    "",
    "## Output Standard",
    "",
    "- Explain what changed.",
    "- Mention validation performed.",
    "- Surface blockers or risks clearly.",
  ].join("\n");
}

function buildCodexAgent(params: {
  name: string;
  description: string;
  context?: string;
}) {
  const name = params.name.trim() || "New Agent";
  const slug = slugForAgentName(name);
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();
  const instructions = [
    `# ${name}`,
    "",
    description,
    ...(context ? ["", "## Codebase Context", "", context] : []),
    "",
    "## Operating Guidance",
    "",
    "- Understand the user's goal before changing code.",
    "- Follow the conventions already present in the current repository.",
    "- Keep changes scoped to the requested work.",
    "- Validate meaningful behavior before finishing.",
  ].join("\n");

  return [
    `name = "${escapeTomlString(slug)}"`,
    `description = "${escapeTomlString(description)}"`,
    'tools = []',
    'developer_instructions = """',
    instructions.replace(/"""/g, '\\"\\"\\"'),
    '"""',
  ].join("\n");
}

function buildCursorAgent(params: {
  name: string;
  description: string;
  context?: string;
}) {
  const name = params.name.trim() || "New Agent";
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();

  return [
    "---",
    `description: "${escapeYamlString(description)}"`,
    "alwaysApply: false",
    "---",
    "",
    `# ${name}`,
    "",
    description,
    ...(context ? ["", "## Codebase Context", "", context] : []),
    "",
    "## Operating Guidance",
    "",
    "- Use this rule when the current task matches the description.",
    "- Follow the current repository's conventions.",
    "- Keep edits scoped and validated.",
  ].join("\n");
}

function buildBlankAgentTemplate(params: {
  name: string;
  description: string;
  targetPlatform: string;
  context?: string;
}) {
  switch (params.targetPlatform) {
    case "codex":
      return buildCodexAgent(params);
    case "cursor":
      return buildCursorAgent(params);
    case "claude_agents":
    case "claude_code":
    default:
      return buildMarkdownAgent(params);
  }
}

function withPathSuffix(logicalPath: string, suffix: string) {
  const slashIndex = logicalPath.lastIndexOf("/");
  const directory = slashIndex >= 0 ? logicalPath.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? logicalPath.slice(slashIndex + 1) : logicalPath;
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${directory}${fileName}${suffix}`;
  }

  return `${directory}${fileName.slice(0, dotIndex)}${suffix}${fileName.slice(dotIndex)}`;
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
      "Create Agent — Xupra DryLake",
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
            case "startBlank":
              await this._handleStartBlank(message);
              break;
            case "generate":
              await this._handleGenerate(message);
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

  private async _handleStartBlank(message: Extract<InboundMessage, { type: "startBlank" }>) {
    const content = buildBlankAgentTemplate(message);
    await this._writeAndOpenAgent({
      requestId: message.requestId,
      name: message.name,
      targetPlatform: message.targetPlatform,
      content,
      label: "Blank agent draft",
    });
  }

  private async _handleGenerate(message: Extract<InboundMessage, { type: "generate" }>) {
    await this._postMessage({ type: "stateUpdate", isLoading: true });

    try {
      const hasEntitlement = await requireXupraProAiEntitlement(
        this._apiClient,
        this._stateStore,
        "Xupra AI agent generation",
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

      const agent = await this._apiClient.generateAgent({
        name: message.name,
        description: message.description,
        targetPlatform: message.targetPlatform,
        context: message.context,
      });

      await this._writeAndOpenAgent({
        requestId: message.requestId,
        name: message.name,
        targetPlatform: message.targetPlatform,
        content: agent.agent.content,
        label: "Xupra AI agent draft",
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

  private async _writeAndOpenAgent(params: {
    requestId: string;
    name: string;
    targetPlatform: string;
    content: string;
    label: string;
  }) {
    const requestedLogicalPath = logicalPathForPlatform(params.targetPlatform, params.name);
    try {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;

      if (!root) {
        await this._postMessage({
          type: "error",
          requestId: params.requestId,
          message:
            "Open a folder in VS Code first, then try Create Agent again. Xupra writes the new agent file into your workspace.",
        });
        const choice = await vscode.window.showWarningMessage(
          "Create Agent needs an open folder. Pick a folder to write the new agent into.",
          "Open Folder…",
        );
        if (choice === "Open Folder…") {
          await vscode.commands.executeCommand("vscode.openFolder");
        }
        return;
      }

      const logicalPath = await this._nextAvailableLogicalPath(root, requestedLogicalPath);
      await writeGeneratedFilesToWorkspace([{ logicalPath, preview: params.content }], {
        confirmBeforeWrite: false,
      });

      const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, ...logicalPath.split("/").filter(Boolean)));
      await vscode.window.showTextDocument(document, { preview: false });
      void vscode.window
        .showInformationMessage(
          `${params.label} opened at ${logicalPath}.`,
          "Sync to Xupra",
        )
        .then((choice) => {
          if (choice === "Sync to Xupra") {
            void vscode.commands.executeCommand("xupra.importWorkspace");
          }
        });
      await this._postMessage({ type: "result", requestId: params.requestId });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: params.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async _nextAvailableLogicalPath(root: vscode.Uri, logicalPath: string) {
    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? logicalPath : withPathSuffix(logicalPath, `-${index + 1}`);
      const target = vscode.Uri.joinPath(root, ...candidate.split("/").filter(Boolean));

      try {
        await vscode.workspace.fs.stat(target);
      } catch {
        return candidate;
      }
    }

    return withPathSuffix(logicalPath, `-${Date.now()}`);
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

    .intro {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }

    .error {
      padding: 8px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }

    .hint {
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
  </style>
</head>
<body data-extension-path="${extensionPath}">
  <main class="panel">
    <h2>Create DryLake Agent</h2>
    <p class="intro">Create a system-specific agent file manually for free, or generate a draft with Xupra AI on Pro.</p>

    <div class="field">
      <label for="agent-name">Agent name</label>
      <input type="text" id="agent-name">
    </div>

    <div class="field">
      <label for="agent-description">Purpose</label>
      <input type="text" id="agent-description">
    </div>

    <div class="field">
      <label for="target-platform">Target platform</label>
      <select id="target-platform">
        <option value="claude_code">Claude Code</option>
        <option value="codex">Codex</option>
        <option value="cursor">Cursor</option>
        <option value="claude_agents">Claude Agents</option>
        <option value="windsurf">Windsurf</option>
        <option value="cline">Cline</option>
        <option value="roo">Roo Code</option>
        <option value="copilot">GitHub Copilot</option>
        <option value="gemini">Gemini CLI</option>
        <option value="junie">JetBrains Junie</option>
        <option value="warp">Warp</option>
        <option value="generic">Generic .rules</option>
      </select>
    </div>

    <div class="field">
      <label for="agent-context">Company or codebase context</label>
      <textarea id="agent-context"></textarea>
    </div>

    <div class="actions">
      <button id="start-blank-btn">Start Blank Agent</button>
      <button id="generate-btn">Generate Agent with Xupra AI (Pro)</button>
    </div>
    <div class="hint">Drafts are written into the current workspace and opened in a normal VS Code editor tab.</div>
    <div id="loading" class="status" style="display:none">Generating agent…</div>
    <div id="error-message" class="error" style="display:none"></div>
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

    const agentName = document.getElementById("agent-name");
    const agentDescription = document.getElementById("agent-description");
    const targetPlatform = document.getElementById("target-platform");
    const agentContext = document.getElementById("agent-context");
    const startBlankBtn = document.getElementById("start-blank-btn");
    const generateBtn = document.getElementById("generate-btn");
    const loading = document.getElementById("loading");
    const errorMessage = document.getElementById("error-message");

    function showError(message) {
      errorMessage.innerHTML = escapeHtml(message);
      errorMessage.style.display = "block";
    }

    function clearError() {
      errorMessage.textContent = "";
      errorMessage.style.display = "none";
    }

    startBlankBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "startBlank",
        requestId: uuid(),
        name: agentName.value,
        description: agentDescription.value,
        targetPlatform: targetPlatform.value,
        context: agentContext.value
      });
    });

    generateBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "generate",
        requestId: uuid(),
        name: agentName.value,
        description: agentDescription.value,
        targetPlatform: targetPlatform.value,
        context: agentContext.value
      });
    });

    window.addEventListener("message", function(event) {
      const message = event.data;

      if (message.type === "stateUpdate") {
        loading.style.display = message.isLoading ? "block" : "none";
        startBlankBtn.disabled = Boolean(message.isLoading);
        generateBtn.disabled = Boolean(message.isLoading);
      }

      if (message.type === "result") {
        clearError();
      }

      if (message.type === "error") {
        loading.style.display = "none";
        startBlankBtn.disabled = false;
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
