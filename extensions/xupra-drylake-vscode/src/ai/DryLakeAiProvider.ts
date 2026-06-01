import type { ApplicationBuildRunbook, XuMode } from "../xu/types";

export type DryLakeProviderId =
  | "xupra-pro-ai"
  | "databricks-api"
  | "claude-api"
  | "openai-api"
  | "hermes-agent"
  | "user-ide-ai"
  | "external-ai-prompt";
export type RunbookModelTier = "nano" | "foundation";
export type DryLakeProviderLabel =
  | "Xupra AI"
  | "Databricks API"
  | "Claude API"
  | "OpenAI API"
  | "Hermes Agent CLI"
  | "User IDE AI"
  | "External AI Prompt";

export type DryLakeAiAvailability = {
  available: boolean;
  reason?: string;
};

export type GenerateDraftRunbookInput = {
  prompt: string;
  mode: XuMode;
  workspaceSummary: string;
  requestedStageCount?: number;
  currentRunbook?: ApplicationBuildRunbook;
};

export type PlanningChatInput = GenerateDraftRunbookInput & {
  chatTranscript: string;
};

export type GenerateDraftRunbookResult = {
  runbook?: ApplicationBuildRunbook;
  promptForExternalAi?: string;
  message?: string;
  modelTier?: RunbookModelTier;
};

export type PlanningChatResult = {
  reply?: string;
  runbook?: ApplicationBuildRunbook;
  error?: string;
  modelTier?: RunbookModelTier;
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
  modelTier?: RunbookModelTier;
};

export interface DryLakeAiProvider {
  id: DryLakeProviderId;
  label: DryLakeProviderLabel;
  isAvailable(): Promise<DryLakeAiAvailability>;
  validateConnection?(): Promise<DryLakeAiAvailability>;
  generateDraftRunbook(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  refinePurpose(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  refineArchitecture(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  generatePhasePlan(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult>;
  planningChat(input: PlanningChatInput): Promise<PlanningChatResult>;
  clarifyIntent?(input: ClarifyIntentInput): Promise<ClarifyIntentResult>;
}

