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
    } else {
      item.contextValue = "disabled";
    }

    return item;
  }

  getChildren() {
    return [
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
      },
      {
        label: "— Advanced Tools —"
      },
      {
        label: "Import Agent Configs",
        description: "Import workspace agent instructions into Xupra",
        command: "xupra.importWorkspace"
      },
      {
        label: "Sync Agent Configs",
        description: "Install generated configs to local agent runtimes",
        command: "xupra.installToRuntime"
      },
      {
        label: "Validate Agent Configs",
        description: "Check compatibility across supported agent tools",
        command: "xupra.checkCompatibility"
      },
      {
        label: "Preview Agent Config Changes",
        description: "Preview generated config changes before writeback",
        command: "xupra.exportPreview"
      },
      {
        label: "Pull Generated Agent Files",
        description: "Pull generated files into the workspace",
        command: "xupra.pullPackage"
      }
    ];
  }
}
