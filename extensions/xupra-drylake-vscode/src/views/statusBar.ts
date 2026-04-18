import * as vscode from "vscode";

type StatusBarState = {
  connected?: boolean;
  organizationSlug?: string;
  versionLabel?: string;
};

export function createStatusBar() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = "xupra.openWebApp";

  const update = (state: StatusBarState = {}) => {
    if (!state.connected) {
      item.text = "$(plug) Xupra: Connect";
      item.tooltip = "Connect Xupra DryLake";
      item.command = "xupra.connect";
      item.show();
      return;
    }

    item.command = "xupra.openWebApp";
    item.text = `$(plug-connected) Xupra: ${state.versionLabel ?? state.organizationSlug ?? "Connected"}`;
    item.tooltip = state.organizationSlug
      ? `Connected to ${state.organizationSlug}`
      : "Open Xupra DryLake";
    item.show();
  };

  update();

  return {
    item,
    update,
    dispose: () => item.dispose()
  };
}
