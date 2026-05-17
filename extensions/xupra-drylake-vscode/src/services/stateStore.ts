import * as vscode from "vscode";

import type {
  ConnectionState,
  DetectedWorkspaceFile,
  LastImportSummary,
  SelectedContext,
} from "../types/package";
import type { BuildSessionState } from "../xu/types";
import type { ApplicationBuildRunbook, XuPhaseAgent } from "../xu/types";

const KEY = "xupra.selectedContext";
const CONNECTION_KEY = "xupra.connection";
const DETECTED_FILES_KEY = "xupra.detectedFiles";
const ACCESS_TOKEN_KEY = "xupra.extensionAccessToken";
const LAST_IMPORT_KEY = "xupra.lastImport";
const AWAITING_PLAN_REFRESH_KEY = "xupra.awaitingPlanRefreshUntil";
const BUILD_SESSION_KEY = "drylake.buildSession";
const PLANNING_PROVIDER_KEY = "drylake.planningProvider";
const CHAT_HISTORY_KEY = "drylake.chatHistory";

export type ActivePhaseSummary = {
  phaseId: string;
  phaseTitle: string;
  agent?: XuPhaseAgent;
};

export type PlanningProviderInfo = {
  id: BuildSessionState["providerId"];
  label: BuildSessionState["providerLabel"];
  reason?: string;
};

export type ChatMessageRole = "user" | "ai" | "system";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  text: string;
  ts: number;
};

export type ChatState = {
  messages: ChatMessage[];
};

const EMPTY_CHAT_STATE: ChatState = { messages: [] };

export class StateStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getSelection(): SelectedContext {
    return this.context.workspaceState.get<SelectedContext>(KEY, {});
  }

  async setSelection(next: SelectedContext) {
    const current = this.getSelection();
    await this.context.workspaceState.update(KEY, {
      ...current,
      ...next
    });
  }

  async clear() {
    await this.context.workspaceState.update(KEY, {});
  }

  async resetWorkspaceState() {
    await this.context.workspaceState.update(KEY, {});
    await this.context.workspaceState.update(DETECTED_FILES_KEY, []);
    await this.context.workspaceState.update(LAST_IMPORT_KEY, null);
  }

  getConnection(): ConnectionState {
    return this.context.workspaceState.get<ConnectionState>(CONNECTION_KEY, {});
  }

  async setConnection(next: ConnectionState) {
    const current = this.getConnection();
    await this.context.workspaceState.update(CONNECTION_KEY, {
      ...current,
      ...next
    });
  }

  async clearConnection() {
    await this.context.workspaceState.update(CONNECTION_KEY, {});
  }

  getAwaitingPlanRefreshUntil(): string | null {
    return this.context.workspaceState.get<string | null>(AWAITING_PLAN_REFRESH_KEY, null);
  }

  async setAwaitingPlanRefreshUntil(value: string | null): Promise<void> {
    await this.context.workspaceState.update(AWAITING_PLAN_REFRESH_KEY, value);
  }

  getDetectedFiles(): DetectedWorkspaceFile[] {
    return this.context.workspaceState.get<DetectedWorkspaceFile[]>(DETECTED_FILES_KEY, []);
  }

  async setDetectedFiles(files: DetectedWorkspaceFile[]) {
    await this.context.workspaceState.update(DETECTED_FILES_KEY, files);
  }

  getLastImport(): LastImportSummary | null {
    return this.context.workspaceState.get<LastImportSummary | null>(LAST_IMPORT_KEY, null);
  }

  async setLastImport(summary: LastImportSummary) {
    await this.context.workspaceState.update(LAST_IMPORT_KEY, summary);
  }

  async clearLastImport() {
    await this.context.workspaceState.update(LAST_IMPORT_KEY, null);
  }

  getBuildSession(): BuildSessionState | null {
    return this.context.workspaceState.get<BuildSessionState | null>(BUILD_SESSION_KEY, null);
  }

  async setBuildSession(session: BuildSessionState) {
    await this.context.workspaceState.update(BUILD_SESSION_KEY, session);
  }

  async clearBuildSession() {
    await this.context.workspaceState.update(BUILD_SESSION_KEY, null);
  }

  getPlanningProvider(): PlanningProviderInfo | null {
    return this.context.workspaceState.get<PlanningProviderInfo | null>(PLANNING_PROVIDER_KEY, null);
  }

  async setPlanningProvider(info: PlanningProviderInfo | null): Promise<void> {
    await this.context.workspaceState.update(PLANNING_PROVIDER_KEY, info);
  }

  getChatHistory(): ChatState {
    return this.context.workspaceState.get<ChatState>(CHAT_HISTORY_KEY, EMPTY_CHAT_STATE);
  }

  async setChatHistory(state: ChatState): Promise<void> {
    await this.context.workspaceState.update(CHAT_HISTORY_KEY, state);
  }

  async appendChatMessage(message: Omit<ChatMessage, "id" | "ts"> & { id?: string; ts?: number }): Promise<ChatMessage> {
    const current = this.getChatHistory();
    const next: ChatMessage = {
      id: message.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: message.role,
      text: message.text,
      ts: message.ts ?? Date.now(),
    };
    await this.setChatHistory({ messages: [...current.messages, next] });
    return next;
  }

  async clearChatHistory(): Promise<void> {
    await this.setChatHistory(EMPTY_CHAT_STATE);
  }

  getActivePhaseSummary(runbook: ApplicationBuildRunbook | null | undefined): ActivePhaseSummary | null {
    const phase = runbook?.phases.find((item) => item.status !== "complete") ?? runbook?.phases[0];

    if (!phase) {
      return null;
    }

    return {
      phaseId: phase.id,
      phaseTitle: phase.title,
      agent: phase.agent,
    };
  }

  async getAccessToken() {
    return this.context.secrets.get(ACCESS_TOKEN_KEY);
  }

  async setAccessToken(token: string) {
    await this.context.secrets.store(ACCESS_TOKEN_KEY, token);
  }

  async clearAccessToken() {
    await this.context.secrets.delete(ACCESS_TOKEN_KEY);
  }
}
