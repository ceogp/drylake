import * as vscode from "vscode";

import { launchAgentTask } from "./phaseAgentLauncher";
import type { AgentRunEntry } from "../types/multiAgentRun";

export class MultiAgentLauncher {
  async launch(params: {
    entry: AgentRunEntry;
    prompt: string;
    promptFile: vscode.Uri;
    workspaceUri: vscode.Uri;
    terminalName: string;
  }) {
    return launchAgentTask({
      agent: params.entry.id,
      prompt: params.prompt,
      promptFile: params.promptFile,
      workspaceUri: params.workspaceUri,
      terminalName: params.terminalName,
    });
  }
}
