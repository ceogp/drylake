import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getLogger() {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Xupra DryLake");
  }

  return {
    info(message: string) {
      channel?.appendLine(`[info] ${message}`);
    },
    error(message: string) {
      channel?.appendLine(`[error] ${message}`);
    }
  };
}
