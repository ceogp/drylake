import type { ApplicationBuildRunbook, XuMode } from "../xu/types";

export type DryLakeProviderId = "xupra-pro-ai" | "user-ide-ai" | "external-ai-prompt";

export type DryLakeAiAvailability = {
  available: boolean;
  reason?: string;
};

export type GenerateDraftRunbookInput = {
  prompt: string;
  mode: XuMode;
  workspaceSummary: string;
  currentRunbook?: ApplicationBuildRunbook;
};

export type PlanningChatInput = GenerateDraftRunbookInput & {
  chatTranscript: string;
};

export type GenerateDraftRunbookResult = {
  runbook?: ApplicationBuildRunbook;
  promptForExternalAi?: string;
  message?: string;
};

export type PlanningChatResult = {
  reply?: string;
  runbook?: ApplicationBuildRunbook;
  error?: string;
};

export type ClarifyIntentInput = {
  prompt: string;
  mode: XuMode;
  workspaceSummary: string;
};

export type ClarifyIntentResult = {
  questions?: string[];
  promptForExternalAi?: string;
  message?: string;
};

export interface DryLakeAiProvider {
  id: DryLakeProviderId;
  label: "Xupra AI" | "User IDE AI" | "External AI Prompt";
  isAvailable(): Promise<DryLakeAiAvailability>;
  generateDraftRunbook(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  refinePurpose(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  refineArchitecture(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  generatePhasePlan(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  planningChat(input: PlanningChatInput): Promise<PlanningChatResult>;
  clarifyIntent?(input: ClarifyIntentInput): Promise<ClarifyIntentResult>;
}

