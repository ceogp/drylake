import * as vscode from "vscode";

import type { ProjectDetail, ProjectSummary } from "../types/api";
import type {
  ConnectionState,
  DetectedWorkspaceFile,
  LastImportSummary,
  SelectedContext,
} from "../types/package";

export type ProjectTreeItem =
  | { kind: "section"; id: "next_actions" | "workspace" | "last_import" | "files" | "projects" | "targets"; label: string; description?: string }
  | { kind: "status"; label: string; description?: string }
  | { kind: "action"; label: string; description?: string; command: string }
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
  lastImport: LastImportSummary | null;
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
    lastImport: null,
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

    if (element.kind === "action") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.command = {
        command: element.command,
        title: element.label,
      };
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
          id: "next_actions",
          label: "Next Actions",
          description: !this.state.connection.userEmail
            ? "Connect first"
            : this.state.selection.versionId
              ? "Ready to import and export"
              : "Select a version for import",
        },
        {
          kind: "section",
          id: "workspace",
          label: "Workspace",
          description: this.state.workspaceName
        },
        {
          kind: "section",
          id: "last_import",
          label: "Last Import",
          description: this.state.lastImport ? this.state.lastImport.status : "none",
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

    if (element.kind === "section" && element.id === "last_import") {
      const summary = this.state.lastImport;

      if (!summary) {
        return [
          {
            kind: "status",
            label: "No import has run in this workspace yet",
            description: "Run Import Workspace after selecting a version",
          },
        ] satisfies ProjectTreeItem[];
      }

      return [
        {
          kind: "status",
          label: `Job: ${summary.jobId}`,
          description: `${summary.status} at ${new Date(summary.completedAt).toLocaleString()}`,
        },
        {
          kind: "status",
          label: `Imported: ${summary.imported?.rawFiles ?? summary.uploadedPaths.length} files`,
          description: `${summary.imported?.skills ?? 0} skills, ${summary.imported?.subagents ?? 0} agents, ${summary.imported?.rules ?? 0} rules`,
        },
        {
          kind: "status",
          label: `Version: ${summary.versionId}`,
          description: summary.imported?.updatedInstructions ? "instructions updated" : "instructions unchanged",
        },
        {
          kind: "status",
          label:
            summary.uploadedPaths.length > 0
              ? `Files: ${summary.uploadedPaths.slice(0, 3).join(", ")}${summary.uploadedPaths.length > 3 ? ", ..." : ""}`
              : "Files: none uploaded",
          description: summary.warnings.length > 0 ? `Warning: ${summary.warnings[0]}` : "No warnings",
        },
      ] satisfies ProjectTreeItem[];
    }

    if (element.kind === "section" && element.id === "next_actions") {
      if (!this.state.connection.userEmail) {
        return [
          {
            kind: "action",
            label: "Connect Xupra",
            description: "Sign in and link this VS Code workspace",
            command: "xupra.connect",
          },
          {
            kind: "action",
            label: "Open Connect Page",
            description: "Open browser connect flow manually",
            command: "xupra.openConnectPage",
          },
          {
            kind: "action",
            label: "Open Web Workspace",
            description: "Open website workspace view",
            command: "xupra.openWebApp",
          },
        ] satisfies ProjectTreeItem[];
      }

      if (!this.state.detectedFiles.length) {
        return [
          {
            kind: "action",
            label: "Scan Workspace",
            description: "Look for AGENTS, CLAUDE, skills, rules, and subagents",
            command: "xupra.scanWorkspace",
          },
          {
            kind: "action",
            label: "Open Extension Settings",
            description: "Add custom scan patterns if your files live in non-standard paths",
            command: "xupra.openSettings",
          },
          {
            kind: "action",
            label: "Open Xupra App",
            description: "Manage projects, packages, billing, and credentials",
            command: "xupra.openWebApp",
          },
        ] satisfies ProjectTreeItem[];
      }

      if (!this.state.selection.versionId) {
        return [
          {
            kind: "action",
            label: "Import Workspace",
            description: "Upload detected files and choose a Xupra package version",
            command: "xupra.importWorkspace",
          },
          {
            kind: "action",
            label: "Select Version",
            description: "Choose the package version this repo should map into",
            command: "xupra.selectVersion",
          },
          {
            kind: "action",
            label: "Open Xupra App",
            description: "Create or inspect projects and package versions",
            command: "xupra.openWebApp",
          },
        ] satisfies ProjectTreeItem[];
      }

      return [
        {
          kind: "action",
          label: "Import Workspace",
          description: "Upload detected files into the selected package version",
          command: "xupra.importWorkspace",
        },
        {
          kind: "action",
          label: "Check Compatibility",
          description: "See how this package fits Codex, Claude Code, Cursor, or Claude Agents",
          command: "xupra.checkCompatibility",
        },
        {
          kind: "action",
          label: "Export Preview",
          description: "Generate target-native output files before deployment",
          command: "xupra.exportPreview",
        },
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
          label: `Auth mode: ${this.state.connection.authMode ?? "unknown"}`,
          description: this.state.connection.userEmail ? "Session active" : "Session missing",
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
      if (!this.state.connection.userEmail) {
        return [
          {
            kind: "status",
            label: "Connect first to scan and import",
            description: "Use Connect Xupra in Next Actions",
          },
        ] satisfies ProjectTreeItem[];
      }

      return this.state.detectedFiles.length > 0
        ? this.state.detectedFiles.map((file) => ({ kind: "detected_file", file }) satisfies ProjectTreeItem)
        : ([
            {
              kind: "status",
              label: "No supported files detected yet",
              description: "Use Scan Workspace or add custom scan patterns"
            }
          ] satisfies ProjectTreeItem[]);
    }

    if (element.kind === "section" && element.id === "projects") {
      if (!this.state.connection.userEmail) {
        return [
          {
            kind: "status",
            label: "No projects loaded",
            description: "Connect to load workspace projects",
          },
        ] satisfies ProjectTreeItem[];
      }

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
