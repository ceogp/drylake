import * as path from "node:path";
import os from "node:os";
import * as vscode from "vscode";

import type { ImportedWorkspaceSkillRule, ImportedWorkspaceSubagent } from "../types/package";
import type { ApiClient } from "./apiClient";

type ManagedSkillDocument = {
  versionId: string;
  logicalPath: string;
  label: string;
};

function normalizeLogicalPath(rawValue: string) {
  return rawValue.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function safeLogicalPathSegments(rawValue: string) {
  const normalized = normalizeLogicalPath(rawValue);
  const segments = normalized.split("/").filter(Boolean);

  if (!normalized || path.posix.isAbsolute(normalized) || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid Xupra skill path: ${rawValue}`);
  }

  return segments;
}

function slugForName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "skill";
}

function fallbackSkillPath(skill: ImportedWorkspaceSkillRule) {
  const slug = slugForName(skill.name);

    switch (skill.sourcePlatform) {
    case "blackbox":
      return `.blackbox/skills/${slug}/SKILL.md`;
    case "codex":
      return `.codex/skills/${slug}/SKILL.md`;
    case "cursor":
      return `.cursor/skills/${slug}/SKILL.md`;
    case "windsurf":
      return `.windsurf/rules/skills/${slug}.md`;
    case "cline":
      return `.clinerules/skills/${slug}.md`;
    case "roo":
      return `.roo/rules/skills/${slug}.md`;
    case "copilot":
      return `.github/instructions/${slug}.instructions.md`;
    case "gemini":
      return `GEMINI-${slug}.md`;
    case "junie":
      return `.junie/${slug}.md`;
    case "warp":
      return `WARP-${slug}.md`;
    case "claude_agents":
    case "claude_code":
    default:
      return `.claude/skills/${slug}/SKILL.md`;
  }
}

function fallbackAgentPath(agent: ImportedWorkspaceSubagent) {
  switch (agent.sourcePlatform) {
    case "codex":
      return `.codex/agents/${agent.slug}.toml`;
    case "cursor":
      return `.cursor/rules/${agent.slug}.mdc`;
    case "windsurf":
      return `.windsurf/rules/${agent.slug}.md`;
    case "cline":
      return `.clinerules/${agent.slug}.md`;
    case "roo":
      return `.roo/rules/${agent.slug}.md`;
    case "copilot":
      return ".github/copilot-instructions.md";
    case "gemini":
      return "GEMINI.md";
    case "junie":
      return ".junie/guidelines.md";
    case "warp":
      return "WARP.md";
    case "generic":
      return ".rules";
    case "claude_agents":
    case "claude_code":
    default:
      return `.claude/agents/${agent.slug}.md`;
  }
}

function defaultRuntimeLogicalPath(rawValue: string) {
  const logicalPath = normalizeLogicalPath(rawValue);

  if (logicalPath === "AGENTS.md") {
    return ".codex/AGENTS.md";
  }

  if (logicalPath === "CLAUDE.md") {
    return ".claude/CLAUDE.md";
  }

  if (logicalPath.startsWith(".agents/skills/")) {
    return `.codex/skills/${logicalPath.slice(".agents/skills/".length)}`;
  }

  if (
    logicalPath.startsWith(".codex/") ||
    logicalPath.startsWith(".blackbox/") ||
    logicalPath.startsWith(".claude/") ||
    logicalPath.startsWith(".cursor/") ||
    logicalPath.startsWith(".windsurf/") ||
    logicalPath.startsWith(".clinerules/") ||
    logicalPath.startsWith(".roo/") ||
    logicalPath.startsWith(".github/") ||
    logicalPath.startsWith(".junie/")
  ) {
    return logicalPath;
  }

  if ([".clinerules", ".roorules", ".rules", "GEMINI.md", "WARP.md"].includes(logicalPath)) {
    return logicalPath;
  }

  return null;
}

export class ImportedSkillEditorManager implements vscode.Disposable {
  private readonly managedDocuments = new Map<string, ManagedSkillDocument>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: ApiClient,
    private readonly onSynced?: (versionId: string) => Promise<void> | void,
  ) {
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        void this.syncManagedDocument(document);
      }),
    );
  }

  dispose() {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  async openImportedSkill(versionId: string, skill: ImportedWorkspaceSkillRule) {
    await this.openImportedItem({
      versionId,
      logicalPath: normalizeLogicalPath(skill.sourcePath || fallbackSkillPath(skill)),
      content: skill.sourceContent,
      label: "skill",
    });
  }

  async openImportedAgent(versionId: string, agent: ImportedWorkspaceSubagent) {
    await this.openImportedItem({
      versionId,
      logicalPath: normalizeLogicalPath(agent.sourcePath || fallbackAgentPath(agent)),
      content: agent.sourceContent,
      label: "agent",
    });
  }

  async uninstallImportedSkill(skill: ImportedWorkspaceSkillRule) {
    const logicalPath = normalizeLogicalPath(skill.sourcePath || fallbackSkillPath(skill));
    await this.uninstallImportedItem(logicalPath, "skill", skill.name || logicalPath);
  }

  async uninstallImportedAgent(agent: ImportedWorkspaceSubagent) {
    const logicalPath = normalizeLogicalPath(agent.sourcePath || fallbackAgentPath(agent));
    await this.uninstallImportedItem(logicalPath, "agent", agent.name || agent.slug || logicalPath);
  }

  private async uninstallImportedItem(logicalPath: string, label: string, displayName: string) {
    const targets: vscode.Uri[] = [];

    const workspaceFile = await this.findWorkspaceFile(logicalPath);
    if (workspaceFile) {
      targets.push(workspaceFile);
    }

    const runtimeFile = this.resolveDefaultRuntimeFile(logicalPath);
    if (runtimeFile) {
      const existing = await this.findFile(runtimeFile);
      if (existing) {
        targets.push(existing);
      }
    }

    if (targets.length === 0) {
      void vscode.window.showInformationMessage(
        `${displayName}: no installed runtime file found for ${logicalPath}. Nothing to uninstall.`,
      );
      return;
    }

    const targetList = targets.map((uri) => uri.fsPath).join("\n");
    const choice = await vscode.window.showWarningMessage(
      `Uninstall ${label} "${displayName}"? This deletes the runtime file from disk:\n\n${targetList}\n\nThe imported record in Xupra is preserved as audit history. You can reinstall by clicking the row.`,
      { modal: true },
      "Delete",
    );

    if (choice !== "Delete") {
      return;
    }

    const failures: string[] = [];
    for (const target of targets) {
      try {
        await vscode.workspace.fs.delete(target, { useTrash: false });
        this.managedDocuments.delete(target.toString());
      } catch (error) {
        failures.push(
          `${target.fsPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (failures.length > 0) {
      void vscode.window.showErrorMessage(`Failed to uninstall ${label}: ${failures.join("; ")}`);
      return;
    }

    void vscode.window.showInformationMessage(
      `Uninstalled ${label} "${displayName}". Deleted ${targets.length} file(s).`,
    );
  }

  private async openImportedItem(params: {
    versionId: string;
    logicalPath: string;
    content: string;
    label: string;
  }) {
    const { versionId, logicalPath, content, label } = params;
    const workspaceFile = await this.findWorkspaceFile(logicalPath);

    if (workspaceFile) {
      const document = await vscode.workspace.openTextDocument(workspaceFile);
      await vscode.window.showTextDocument(document, { preview: false });
      void vscode.window.showInformationMessage(`Opened workspace ${label} ${logicalPath}. Re-import to sync local edits back to Xupra.`);
      return;
    }

    const runtimeFile = this.resolveDefaultRuntimeFile(logicalPath);

    if (runtimeFile) {
      const existingRuntimeFile = await this.findFile(runtimeFile);

      if (!existingRuntimeFile) {
        await this.writeFile(runtimeFile, content);
      }

      this.managedDocuments.set(runtimeFile.toString(), {
        versionId,
        logicalPath,
        label,
      });

      const document = await vscode.workspace.openTextDocument(runtimeFile);
      await vscode.window.showTextDocument(document, { preview: false });
      void vscode.window.showInformationMessage(
        `Opened default runtime ${label} ${logicalPath}. Save to sync changes back to Xupra.`,
      );
      return;
    }

    const managedFile = await this.writeManagedFile(versionId, logicalPath, content);
    this.managedDocuments.set(managedFile.toString(), {
      versionId,
      logicalPath,
      label,
    });

    const document = await vscode.workspace.openTextDocument(managedFile);
    await vscode.window.showTextDocument(document, { preview: false });
    void vscode.window.showInformationMessage(`Opened Xupra-managed ${label} ${logicalPath}. Save to sync changes back to Xupra.`);
  }

  private async findWorkspaceFile(logicalPath: string) {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;

    if (!rootUri) {
      return null;
    }

    const target = vscode.Uri.joinPath(rootUri, ...safeLogicalPathSegments(logicalPath));

    return this.findFile(target);
  }

  private resolveDefaultRuntimeFile(logicalPath: string) {
    const runtimeLogicalPath = defaultRuntimeLogicalPath(logicalPath);

    if (!runtimeLogicalPath) {
      return null;
    }

    return vscode.Uri.joinPath(vscode.Uri.file(os.homedir()), ...safeLogicalPathSegments(runtimeLogicalPath));
  }

  private async findFile(target: vscode.Uri) {
    try {
      const stat = await vscode.workspace.fs.stat(target);
      return stat.type === vscode.FileType.File ? target : null;
    } catch {
      return null;
    }
  }

  private async writeFile(fileUri: vscode.Uri, content: string) {
    const directory = vscode.Uri.file(path.dirname(fileUri.fsPath));

    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
  }

  private async writeManagedFile(versionId: string, logicalPath: string, content: string) {
    const root = vscode.Uri.joinPath(this.context.globalStorageUri, "editable-imports", versionId);
    const segments = safeLogicalPathSegments(logicalPath);
    const fileUri = vscode.Uri.joinPath(root, ...segments);

    await this.writeFile(fileUri, content);

    return fileUri;
  }

  private async syncManagedDocument(document: vscode.TextDocument) {
    const managed = this.managedDocuments.get(document.uri.toString());

    if (!managed) {
      return;
    }

    try {
      await this.apiClient.uploadFiles(managed.versionId, [
        {
          logicalPath: managed.logicalPath,
          content: document.getText(),
        },
      ]);
      await this.apiClient.importVersion(managed.versionId);

      if (this.onSynced) {
        await this.onSynced(managed.versionId);
      }

      void vscode.window.showInformationMessage(`Synced ${managed.logicalPath} to Xupra.`);
    } catch (error) {
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : `Failed to sync ${managed.label} changes back to Xupra.`,
      );
    }
  }
}
