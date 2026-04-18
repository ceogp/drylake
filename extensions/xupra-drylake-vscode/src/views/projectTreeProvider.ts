import * as vscode from "vscode";

import type { ProjectDetail, ProjectSummary } from "../types/api";
import type { ConnectionState, DetectedWorkspaceFile, SelectedContext } from "../types/package";

export type ProjectTreeItem =
  | { kind: "section"; id: "workspace" | "files" | "projects" | "targets"; label: string; description?: string }
  | { kind: "status"; label: string; description?: string }
  | { kind: "detected_file"; file: DetectedWorkspaceFile }
  | { kind: "project"; project: ProjectSummary | ProjectDetail }
  | { kind: "package"; projectId: string; packageId: string; name: string; selected?: boolean }
  | { kind: "version"; projectId: string; packageId: string; versionId: string; label: string; selected?: boolean }
  | { kind: "target"; label: string; description: string };

type TreeState = {
  projects: ProjectSummary[];
  detectedFiles: DetectedWorkspaceFile[];
  selection: SelectedContext;
  connection: ConnectionState;
  workspaceName: string;
  defaultTargetPlatform: string;
};

const TARGET_LABELS: Record<string, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  claude_agents: "Claude Agents",
  cursor: "Cursor"
};

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly emitter = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private state: TreeState = {
    projects: [],
    detectedFiles: [],
    selection: {},
    connection: {},
    workspaceName: "No workspace",
    defaultTargetPlatform: "claude_code"
  };

  setState(next: Partial<TreeState>) {
    this.state = {
      ...this.state,
      ...next
    };
    this.refresh();
  }

  refresh() {
    this.emitter.fire();
  }

  getTreeItem(element: ProjectTreeItem) {
    if (element.kind === "section") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = element.description;
      return item;
    }

    if (element.kind === "status") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      return item;
    }

    if (element.kind === "detected_file") {
      const item = new vscode.TreeItem(element.file.logicalPath, vscode.TreeItemCollapsibleState.None);
      item.description = element.file.category.replace("_", " ");
      return item;
    }

    if (element.kind === "project") {
      const item = new vscode.TreeItem(element.project.name, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = "xupra.project";
      item.description = `${element.project.packages.length} packages`;
      item.command = {
        command: "xupra.selectProject",
        title: "Select Project",
        arguments: [element]
      };
      return item;
    }

    if (element.kind === "package") {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = "xupra.package";
      item.description = element.selected ? "selected" : "package";
      item.command = {
        command: "xupra.selectPackage",
        title: "Select Package",
        arguments: [element]
      };
      return item;
    }

    if (element.kind === "version") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.contextValue = "xupra.version";
      item.description = element.selected ? "selected" : "version";
      item.command = {
        command: "xupra.selectVersion",
        title: "Select Version",
        arguments: [element]
      };
      return item;
    }

    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    return item;
  }

  getChildren(element?: ProjectTreeItem) {
    if (!element) {
      return [
        {
          kind: "section",
          id: "workspace",
          label: "Workspace",
          description: this.state.workspaceName
        },
        {
          kind: "section",
          id: "files",
          label: "Detected Files",
          description: `${this.state.detectedFiles.length}`
        },
        {
          kind: "section",
          id: "projects",
          label: "Projects",
          description: `${this.state.projects.length}`
        },
        {
          kind: "section",
          id: "targets",
          label: "Targets",
          description: TARGET_LABELS[this.state.defaultTargetPlatform] ?? this.state.defaultTargetPlatform
        }
      ] satisfies ProjectTreeItem[];
    }

    if (element.kind === "section" && element.id === "workspace") {
      const selectedProject = this.state.projects.find((project) => project.id === this.state.selection.projectId);
      const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === this.state.selection.packageId);
      const selectedVersion = selectedPackage?.versions.find((version) => version.id === this.state.selection.versionId);

      return [
        {
          kind: "status",
          label: this.state.connection.userEmail ? `Connected: ${this.state.connection.userEmail}` : "Not connected",
          description: this.state.connection.organizationSlug ?? "Connect to Xupra"
        },
        {
          kind: "status",
          label: `Repo: ${this.state.workspaceName}`,
          description: selectedProject ? `${selectedProject.name}${selectedPackage ? ` / ${selectedPackage.name}` : ""}` : "No project selected"
        },
        {
          kind: "status",
          label: selectedVersion ? `Version: ${selectedVersion.versionNumber}` : "Version: none selected",
          description: selectedVersion?.status ?? "Use Select Version"
        }
      ] satisfies ProjectTreeItem[];
    }

    if (element.kind === "section" && element.id === "files") {
      return this.state.detectedFiles.length > 0
        ? this.state.detectedFiles.map((file) => ({ kind: "detected_file", file }) satisfies ProjectTreeItem)
        : ([
            {
              kind: "status",
              label: "No supported files detected",
              description: "Run Import Workspace or Scan Workspace"
            }
          ] satisfies ProjectTreeItem[]);
    }

    if (element.kind === "section" && element.id === "projects") {
      return this.state.projects.map((project) => ({ kind: "project", project }) satisfies ProjectTreeItem);
    }

    if (element.kind === "section" && element.id === "targets") {
      return Object.entries(TARGET_LABELS).map(
        ([platform, label]) =>
          ({
            kind: "target",
            label,
            description: platform === this.state.defaultTargetPlatform ? "default target" : "supported"
          }) satisfies ProjectTreeItem
      );
    }

    if (element.kind === "project") {
      return element.project.packages.map(
        (agentPackage) =>
          ({
            kind: "package",
            projectId: element.project.id,
            packageId: agentPackage.id,
            name: agentPackage.name,
            selected: this.state.selection.packageId === agentPackage.id
          }) satisfies ProjectTreeItem
      );
    }

    if (element.kind === "package") {
      const project = this.state.projects.find((item) => item.id === element.projectId);
      const agentPackage = project?.packages.find((item) => item.id === element.packageId);

      return (
        agentPackage?.versions.map(
          (version) =>
            ({
              kind: "version",
              projectId: element.projectId,
              packageId: element.packageId,
              versionId: version.id,
              label: `v${version.versionNumber} · ${version.status}`,
              selected: this.state.selection.versionId === version.id
            }) satisfies ProjectTreeItem
        ) ?? []
      );
    }

    return [];
  }
}
