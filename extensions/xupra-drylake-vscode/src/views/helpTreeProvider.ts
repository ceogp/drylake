import * as vscode from "vscode";

type HelpItem = {
  label: string;
  description?: string;
  command?: string;
  arguments?: unknown[];
};

export class HelpTreeProvider implements vscode.TreeDataProvider<HelpItem> {
  private readonly emitter = new vscode.EventEmitter<HelpItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh() {
    this.emitter.fire();
  }

  getTreeItem(element: HelpItem) {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;

    if (element.command) {
      item.command = {
        command: element.command,
        title: element.label,
        arguments: element.arguments ?? []
      };
    }

    return item;
  }

  getChildren() {
    return [
      {
        label: "Walkthrough",
        description: "Open the Xupra walkthrough in VS Code",
        command: "xupra.openWalkthrough"
      },
      {
        label: "Import From IDE",
        description: "Open the browser page that returns to the editor import flow",
        command: "xupra.openInstallGuide"
      },
      {
        label: "Connect Extension",
        description: "Open the browser connect page or fallback flow",
        command: "xupra.openConnectPage"
      },
      {
        label: "Open Dashboard",
        description: "Open the Xupra workspace in your browser",
        command: "xupra.openWebApp"
      },
      {
        label: "Extension Settings",
        description: "Configure base URL, defaults, and writeback behavior",
        command: "xupra.openSettings"
      },
      {
        label: "Account Settings",
        description: "Open your Xupra account settings",
        command: "xupra.openAccountSettings"
      },
      {
        label: "Billing",
        description: "Open billing and plan management",
        command: "xupra.openBilling"
      },
      {
        label: "Supported Targets",
        description: "Codex, Claude Code, Claude Agents, Cursor",
        command: "xupra.openSupportedTargets"
      },
      {
        label: "Workflow",
        description: "Import -> canonicalize -> export",
        command: "xupra.openHowItWorks"
      },
      {
        label: "Sign Out",
        description: "Clear this editor's Xupra connection",
        command: "xupra.signOut"
      },
      {
        label: "Contact Support",
        description: "Email support@xupracorp.com",
        command: "xupra.contactSupport"
      }
    ];
  }
}
