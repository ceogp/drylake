import * as vscode from "vscode";

import type { RecentJob } from "../types/jobs";

export class JobTreeProvider implements vscode.TreeDataProvider<RecentJob> {
  private readonly emitter = new vscode.EventEmitter<RecentJob | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private jobs: RecentJob[] = [];

  setJobs(jobs: RecentJob[]) {
    this.jobs = jobs;
    this.refresh();
  }

  prepend(job: RecentJob) {
    this.jobs = [job, ...this.jobs].slice(0, 20);
    this.refresh();
  }

  refresh() {
    this.emitter.fire();
  }

  getTreeItem(element: RecentJob) {
    const item = new vscode.TreeItem(`${element.title} · ${element.status}`, vscode.TreeItemCollapsibleState.None);
    item.description = element.kind;
    item.tooltip = `${element.id}\n${element.createdAt}`;
    return item;
  }

  getChildren() {
    return this.jobs;
  }
}
