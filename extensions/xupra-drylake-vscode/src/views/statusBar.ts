import * as vscode from "vscode";

export function createStatusBar() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = "xupra.openWebApp";
  item.text = "$(plug) Xupra DryLake";
  item.tooltip = "Open Xupra DryLake";
  item.show();
  return item;
}
