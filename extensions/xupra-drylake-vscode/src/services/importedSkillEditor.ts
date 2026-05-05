import * as path from "node:path";
import * as vscode from "vscode";

import type { ImportedWorkspaceSkillRule } from "../types/package";
import type { ApiClient } from "./apiClient";

type ManagedSkillDocument = {
  versionId: string;
  logicalPath: string;
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
    case "codex":
      return `.codex/skills/${slug}/SKILL.md`;
    case "cursor":
      return `.cursor/skills/${slug}/SKILL.md`;
    case "claude_agents":
    case "claude_code":
    default:
      return `.claude/skills/${slug}/SKILL.md`;
  }
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
    const logicalPath = normalizeLogicalPath(skill.sourcePath || fallbackSkillPath(skill));
    const workspaceFile = await this.findWorkspaceFile(logicalPath);

    if (workspaceFile) {
      const document = await vscode.workspace.openTextDocument(workspaceFile);
      await vscode.window.showTextDocument(document, { preview: false });
      void vscode.window.showInformationMessage(`Opened workspace skill ${logicalPath}. Re-import to sync local edits back to Xupra.`);
      return;
    }

    const managedFile = await this.writeManagedFile(versionId, logicalPath, skill.sourceContent);
    this.managedDocuments.set(managedFile.toString(), {
      versionId,
      logicalPath,
    });

    const document = await vscode.workspace.openTextDocument(managedFile);
    await vscode.window.showTextDocument(document, { preview: false });
    void vscode.window.showInformationMessage(`Opened Xupra-managed skill ${logicalPath}. Save to sync changes back to Xupra.`);
  }

  private async findWorkspaceFile(logicalPath: string) {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;

    if (!rootUri) {
      return null;
    }

    const target = vscode.Uri.joinPath(rootUri, ...safeLogicalPathSegments(logicalPath));

    try {
      const stat = await vscode.workspace.fs.stat(target);
      return stat.type === vscode.FileType.File ? target : null;
    } catch {
      return null;
    }
  }

  private async writeManagedFile(versionId: string, logicalPath: string, content: string) {
    const root = vscode.Uri.joinPath(this.context.globalStorageUri, "editable-imports", versionId);
    const segments = safeLogicalPathSegments(logicalPath);
    const fileUri = vscode.Uri.joinPath(root, ...segments);
    const directory = segments.length > 1 ? vscode.Uri.joinPath(root, ...segments.slice(0, -1)) : root;

    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));

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
        error instanceof Error ? error.message : "Failed to sync skill changes back to Xupra.",
      );
    }
  }
}