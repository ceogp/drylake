import * as vscode from "vscode";

import type { ProjectDetail, ProjectSummary } from "../types/api";
import type {
  ConnectionState,
  DetectedWorkspaceFile,
  ImportedWorkspaceSnapshot,
  LastImportSummary,
  SelectedContext,
} from "../types/package";

export type ProjectTreeItem =
  | { kind: "section"; id: "next_actions" | "workspace" | "last_import" | "imported_workspace" | "files" | "projects" | "targets"; label: string; description?: string }
  | { kind: "status"; label: string; description?: string }
  | { kind: "action"; label: string; description?: string; command: string }
  | { kind: "detected_file"; file: DetectedWorkspaceFile }
  | { kind: "project"; project: ProjectSummary | ProjectDetail }
  | { kind: "package"; projectId: string; packageId: string; name: string; selected?: boolean }
  | { kind: "version"; projectId: string; packageId: string; versionId: string; label: string; selected?: boolean }
  | { kind: "import_group"; groupId: "raw_files" | "subagents" | "skills_rules" | "systems"; label: string; description?: string }
  | { kind: "import_source"; sourcePlatform: string; label: string; description?: string }
  | { kind: "import_file"; logicalPath: string; kindLabel: string; sourceFormat: string; sourcePlatform: string }
  | { kind: "import_subagent"; name: string; slug: string; sourcePlatform: string; sourcePath?: string }
  | { kind: "import_skill_rule"; name: string; ruleKind: string; sourcePlatform: string; sourcePath?: string }
  | { kind: "target"; label: string; description: string };

type TreeState = {
  projects: ProjectSummary[];
  detectedFiles: DetectedWorkspaceFile[];
  selection: SelectedContext;
  connection: ConnectionState;
  lastImport: LastImportSummary | null;
  importedWorkspace: ImportedWorkspaceSnapshot | null;
  importedWorkspaceError: string | null;
  workspaceName: string;
  defaultTargetPlatform: string;
};

const TARGET_LABELS: Record<string, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  claude_agents: "Claude Agents",
  cursor: "Cursor"
};

const SOURCE_LABELS: Record<string, string> = {
  ai_normalization: "AI Normalization",
  claude: "Claude Code",
  claude_agents: "Claude Agents",
  claude_code: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  generic: "Generic",
};

const MAX_VISIBLE_IMPORT_ITEMS = 80;

function getSourceLabel(sourcePlatform: string) {
  return SOURCE_LABELS[sourcePlatform] ?? sourcePlatform;
}

function withLimit<T>(items: T[]) {
  const limited = items.slice(0, MAX_VISIBLE_IMPORT_ITEMS);

  return {
    items: limited,
    remaining: Math.max(0, items.length - limited.length),
  };
}

function normalizeRuleKind(kind: string) {
  return kind.replace(/_/g, " ");
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly emitter = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private state: TreeState = {
    projects: [],
    detectedFiles: [],
    selection: {},
    connection: {},
    lastImport: null,
    importedWorkspace: null,
    importedWorkspaceError: null,
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

    if (element.kind === "import_group") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = element.description;
      return item;
    }

    if (element.kind === "import_source") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = element.description;
      return item;
    }

    if (element.kind === "import_file") {
      const item = new vscode.TreeItem(element.logicalPath, vscode.TreeItemCollapsibleState.None);
      item.description = `${element.kindLabel} · ${getSourceLabel(element.sourcePlatform)}`;
      item.tooltip = `${element.logicalPath}\n${element.sourceFormat}`;
      return item;
    }

    if (element.kind === "import_subagent") {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
      item.description = `${element.slug} · ${getSourceLabel(element.sourcePlatform)}`;
      item.tooltip = element.sourcePath
        ? `${element.name}\n${element.sourcePath}`
        : `${element.name}\nSource: ${getSourceLabel(element.sourcePlatform)}`;
      return item;
    }

    if (element.kind === "import_skill_rule") {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
      item.description = `${normalizeRuleKind(element.ruleKind)} · ${getSourceLabel(element.sourcePlatform)}`;
      item.tooltip = element.sourcePath
        ? `${element.name}\n${element.sourcePath}`
        : `${element.name}\nSource: ${getSourceLabel(element.sourcePlatform)}`;
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
          id: "imported_workspace",
          label: "Imported Workspace",
          description: !this.state.selection.versionId
            ? "Select a version"
            : this.state.importedWorkspaceError
              ? "load failed"
            : this.state.importedWorkspace
              ? `${this.state.importedWorkspace.files.length + this.state.importedWorkspace.subagents.length + this.state.importedWorkspace.skillRules.length} artifacts`
              : "loading",
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

    if (element.kind === "section" && element.id === "imported_workspace") {
      if (!this.state.connection.userEmail) {
        return [
          {
            kind: "status",
            label: "Connect first to load imported workspace data",
            description: "Use Connect Xupra in Next Actions",
          },
        ] satisfies ProjectTreeItem[];
      }

      if (!this.state.selection.versionId) {
        return [
          {
            kind: "status",
            label: "No version selected",
            description: "Select Version, then import workspace files",
          },
        ] satisfies ProjectTreeItem[];
      }

      const snapshot = this.state.importedWorkspace;

      if (this.state.importedWorkspaceError) {
        return [
          {
            kind: "status",
            label: "Failed to load imported workspace details",
            description: this.state.importedWorkspaceError,
          },
          {
            kind: "action",
            label: "Refresh Projects",
            description: "Retry loading imported file, skill, and agent details",
            command: "xupra.refreshProjects",
          },
          {
            kind: "action",
            label: "Open Web Workspace",
            description: "Open the website version view for verification",
            command: "xupra.openWebApp",
          },
        ] satisfies ProjectTreeItem[];
      }

      if (!snapshot || snapshot.versionId !== this.state.selection.versionId) {
        return [
          {
            kind: "status",
            label: "Imported workspace not loaded yet",
            description: "Refresh Projects to load file, skill, and agent details",
          },
          {
            kind: "action",
            label: "Refresh Projects",
            description: "Load server-side imported artifacts",
            command: "xupra.refreshProjects",
          },
        ] satisfies ProjectTreeItem[];
      }

      const sourcePlatforms = new Set<string>();
      snapshot.files.forEach((file) => sourcePlatforms.add(file.sourcePlatform));
      snapshot.subagents.forEach((subagent) => sourcePlatforms.add(subagent.sourcePlatform));
      snapshot.skillRules.forEach((rule) => sourcePlatforms.add(rule.sourcePlatform));

      const totalArtifacts = snapshot.files.length + snapshot.subagents.length + snapshot.skillRules.length;

      if (totalArtifacts === 0) {
        return [
          {
            kind: "status",
            label: "No imported artifacts in this version yet",
            description: "Run Import Workspace to populate files, skills, and agents",
          },
        ] satisfies ProjectTreeItem[];
      }

      return [
        {
          kind: "status",
          label: `Version: ${snapshot.versionId}`,
          description: `${totalArtifacts} artifacts in this package version`,
        },
        {
          kind: "import_group",
          groupId: "raw_files",
          label: "Raw Files",
          description: `${snapshot.files.length}`,
        },
        {
          kind: "import_group",
          groupId: "subagents",
          label: "Agents",
          description: `${snapshot.subagents.length}`,
        },
        {
          kind: "import_group",
          groupId: "skills_rules",
          label: "Skills And Rules",
          description: `${snapshot.skillRules.length}`,
        },
        {
          kind: "import_group",
          groupId: "systems",
          label: "By Source System",
          description: `${sourcePlatforms.size}`,
        },
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
      const selectedProject = this.state.projects.find((project) => project.id === this.state.selection.projectId);
      const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === this.state.selection.packageId);
      const selectedVersion = selectedPackage?.versions.find((version) => version.id === this.state.selection.versionId);
      const importedWorkspace =
        this.state.importedWorkspace && this.state.importedWorkspace.versionId === this.state.selection.versionId
          ? this.state.importedWorkspace
          : null;
      const importedFromLastRun =
        this.state.lastImport && this.state.lastImport.versionId === this.state.selection.versionId
          ? this.state.lastImport.imported?.rawFiles ?? this.state.lastImport.uploadedPaths.length
          : 0;
      const importedArtifacts = importedWorkspace
        ? importedWorkspace.files.length + importedWorkspace.subagents.length + importedWorkspace.skillRules.length
        : importedFromLastRun;

      const statusRows: ProjectTreeItem[] = [
        {
          kind: "status",
          label: this.state.connection.userEmail ? `Connected: ${this.state.connection.userEmail}` : "Step 1: Connect",
          description: this.state.connection.userEmail
            ? this.state.connection.organizationSlug
            : "Click 'Connect Xupra' below",
        },
        {
          kind: "status",
          label: selectedVersion ? `Selected version: v${selectedVersion.versionNumber}` : "Selected version: none",
          description: selectedVersion ? `${selectedProject?.name ?? "Project"} / ${selectedPackage?.name ?? "Package"}` : "Use Select Version",
        },
        {
          kind: "status",
          label: `Imported artifacts visible: ${importedArtifacts}`,
          description:
            this.state.importedWorkspaceError ??
            (importedArtifacts > 0 ? "Expand Imported Workspace to inspect files, skills, and agents" : "Run Import Workspace then refresh"),
        },
      ];

      if (!this.state.connection.userEmail) {
        return [
          ...statusRows,
          {
            kind: "action",
            label: "Connect Xupra",
            description: "Sign in and link this VS Code workspace",
            command: "xupra.connect",
          },
          {
            kind: "action",
            label: "Paste Extension Token",
            description: "Use manual token fallback from the connect page",
            command: "xupra.pasteToken",
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
          ...statusRows,
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
          ...statusRows,
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
        ...statusRows,
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

    if (element.kind === "import_group") {
      const snapshot = this.state.importedWorkspace;

      if (!snapshot) {
        return [];
      }

      if (element.groupId === "raw_files") {
        if (snapshot.files.length === 0) {
          return [
            {
              kind: "status",
              label: "No raw files uploaded yet",
              description: "Import Workspace uploads files into raw_source storage",
            },
          ] satisfies ProjectTreeItem[];
        }

        const sortedFiles = [...snapshot.files].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
        const limited = withLimit(sortedFiles);
        const rows: ProjectTreeItem[] = limited.items.map(
          (file) =>
            ({
              kind: "import_file",
              logicalPath: file.logicalPath,
              kindLabel: normalizeRuleKind(file.kind),
              sourceFormat: file.sourceFormat,
              sourcePlatform: file.sourcePlatform,
            }) satisfies ProjectTreeItem,
        );

        if (limited.remaining > 0) {
          rows.push({
            kind: "status",
            label: `... ${limited.remaining} more files not shown`,
            description: "Open web workspace for the full list",
          });
        }

        return rows;
      }

      if (element.groupId === "subagents") {
        if (snapshot.subagents.length === 0) {
          return [
            {
              kind: "status",
              label: "No imported agents yet",
              description: "Import files from .claude/agents or .codex/agents",
            },
          ] satisfies ProjectTreeItem[];
        }

        const sortedSubagents = [...snapshot.subagents].sort((a, b) => a.name.localeCompare(b.name));
        const limited = withLimit(sortedSubagents);
        const rows: ProjectTreeItem[] = limited.items.map(
          (subagent) =>
            ({
              kind: "import_subagent",
              name: subagent.name,
              slug: subagent.slug,
              sourcePlatform: subagent.sourcePlatform,
              sourcePath: subagent.sourcePath,
            }) satisfies ProjectTreeItem,
        );

        if (limited.remaining > 0) {
          rows.push({
            kind: "status",
            label: `... ${limited.remaining} more agents not shown`,
            description: "Open web workspace for the full list",
          });
        }

        return rows;
      }

      if (element.groupId === "skills_rules") {
        if (snapshot.skillRules.length === 0) {
          return [
            {
              kind: "status",
              label: "No imported skills or rules yet",
              description: "Import files from .agents/.claude/.cursor skill and rule folders",
            },
          ] satisfies ProjectTreeItem[];
        }

        const sortedRules = [...snapshot.skillRules].sort((a, b) => a.name.localeCompare(b.name));
        const limited = withLimit(sortedRules);
        const rows: ProjectTreeItem[] = limited.items.map(
          (rule) =>
            ({
              kind: "import_skill_rule",
              name: rule.name,
              ruleKind: rule.kind,
              sourcePlatform: rule.sourcePlatform,
              sourcePath: rule.sourcePath,
            }) satisfies ProjectTreeItem,
        );

        if (limited.remaining > 0) {
          rows.push({
            kind: "status",
            label: `... ${limited.remaining} more rules not shown`,
            description: "Open web workspace for the full list",
          });
        }

        return rows;
      }

      const bySource = new Map<string, { files: number; subagents: number; skillsRules: number }>();

      for (const file of snapshot.files) {
        const current = bySource.get(file.sourcePlatform) ?? { files: 0, subagents: 0, skillsRules: 0 };
        current.files += 1;
        bySource.set(file.sourcePlatform, current);
      }

      for (const subagent of snapshot.subagents) {
        const current = bySource.get(subagent.sourcePlatform) ?? { files: 0, subagents: 0, skillsRules: 0 };
        current.subagents += 1;
        bySource.set(subagent.sourcePlatform, current);
      }

      for (const rule of snapshot.skillRules) {
        const current = bySource.get(rule.sourcePlatform) ?? { files: 0, subagents: 0, skillsRules: 0 };
        current.skillsRules += 1;
        bySource.set(rule.sourcePlatform, current);
      }

      if (bySource.size === 0) {
        return [
          {
            kind: "status",
            label: "No source system metadata available",
            description: "Import files first so systems can be inferred",
          },
        ] satisfies ProjectTreeItem[];
      }

      return [...bySource.entries()]
        .sort(([a], [b]) => getSourceLabel(a).localeCompare(getSourceLabel(b)))
        .map(
          ([platform, counts]) =>
            ({
              kind: "import_source",
              sourcePlatform: platform,
              label: getSourceLabel(platform),
              description: `${counts.files} files, ${counts.subagents} agents, ${counts.skillsRules} skills/rules`,
            }) satisfies ProjectTreeItem,
        );
    }

    if (element.kind === "import_source") {
      const snapshot = this.state.importedWorkspace;

      if (!snapshot) {
        return [];
      }

      const sourceFiles = snapshot.files.filter((file) => file.sourcePlatform === element.sourcePlatform);
      const sourceSubagents = snapshot.subagents.filter((subagent) => subagent.sourcePlatform === element.sourcePlatform);
      const sourceRules = snapshot.skillRules.filter((rule) => rule.sourcePlatform === element.sourcePlatform);
      const rows: ProjectTreeItem[] = [
        {
          kind: "status",
          label: `Files: ${sourceFiles.length}`,
          description: `Agents: ${sourceSubagents.length}, Skills/Rules: ${sourceRules.length}`,
        },
      ];

      rows.push(
        ...sourceFiles.slice(0, 20).map(
          (file) =>
            ({
              kind: "import_file",
              logicalPath: file.logicalPath,
              kindLabel: normalizeRuleKind(file.kind),
              sourceFormat: file.sourceFormat,
              sourcePlatform: file.sourcePlatform,
            }) satisfies ProjectTreeItem,
        ),
      );

      rows.push(
        ...sourceSubagents.slice(0, 20).map(
          (subagent) =>
            ({
              kind: "import_subagent",
              name: subagent.name,
              slug: subagent.slug,
              sourcePlatform: subagent.sourcePlatform,
              sourcePath: subagent.sourcePath,
            }) satisfies ProjectTreeItem,
        ),
      );

      rows.push(
        ...sourceRules.slice(0, 20).map(
          (rule) =>
            ({
              kind: "import_skill_rule",
              name: rule.name,
              ruleKind: rule.kind,
              sourcePlatform: rule.sourcePlatform,
              sourcePath: rule.sourcePath,
            }) satisfies ProjectTreeItem,
        ),
      );

      return rows;
    }

    if (element.kind === "section" && element.id === "workspace") {
      const selectedProject = this.state.projects.find((project) => project.id === this.state.selection.projectId);
      const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === this.state.selection.packageId);
      const selectedVersion = selectedPackage?.versions.find((version) => version.id === this.state.selection.versionId);
      const importedWorkspace = this.state.importedWorkspace;
      const importedArtifacts = importedWorkspace
        ? importedWorkspace.files.length + importedWorkspace.subagents.length + importedWorkspace.skillRules.length
        : 0;

      return [
        {
          kind: "status",
          label: this.state.connection.userEmail ? `Connected: ${this.state.connection.userEmail}` : "Not connected",
          description: this.state.connection.organizationSlug ?? "Use 'Connect Xupra' in Next Actions"
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
        },
        {
          kind: "status",
          label: `Imported artifacts: ${importedArtifacts}`,
          description: importedWorkspace
            ? `${importedWorkspace.files.length} files, ${importedWorkspace.subagents.length} agents, ${importedWorkspace.skillRules.length} skills/rules`
            : "Select a version to load imported workspace data",
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
