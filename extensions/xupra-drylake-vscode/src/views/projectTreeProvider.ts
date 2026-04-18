import * as vscode from "vscode";

import type { ProjectDetail, ProjectSummary } from "../types/api";

export type ProjectTreeItem =
  | { kind: "project"; project: ProjectSummary | ProjectDetail }
  | { kind: "package"; projectId: string; packageId: string; name: string }
  | { kind: "version"; projectId: string; packageId: string; versionId: string; label: string };

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly emitter = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private projects: ProjectSummary[] = [];

  setProjects(projects: ProjectSummary[]) {
    this.projects = projects;
    this.refresh();
  }

  refresh() {
    this.emitter.fire();
  }

  getTreeItem(element: ProjectTreeItem) {
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
      item.description = "package";
      item.command = {
        command: "xupra.selectPackage",
        title: "Select Package",
        arguments: [element]
      };
      return item;
    }

    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "xupra.version";
    item.description = "version";
    item.command = {
      command: "xupra.selectVersion",
      title: "Select Version",
      arguments: [element]
    };
    return item;
  }

  getChildren(element?: ProjectTreeItem) {
    if (!element) {
      return this.projects.map((project) => ({ kind: "project", project }) satisfies ProjectTreeItem);
    }

    if (element.kind === "project") {
      return element.project.packages.map(
        (agentPackage) =>
          ({
            kind: "package",
            projectId: element.project.id,
            packageId: agentPackage.id,
            name: agentPackage.name
          }) satisfies ProjectTreeItem
      );
    }

    if (element.kind === "package") {
      const project = this.projects.find((item) => item.id === element.projectId);
      const agentPackage = project?.packages.find((item) => item.id === element.packageId);

      return (
        agentPackage?.versions.map(
          (version) =>
            ({
              kind: "version",
              projectId: element.projectId,
              packageId: element.packageId,
              versionId: version.id,
              label: `v${version.versionNumber} · ${version.status}`
            }) satisfies ProjectTreeItem
        ) ?? []
      );
    }

    return [];
  }
}
