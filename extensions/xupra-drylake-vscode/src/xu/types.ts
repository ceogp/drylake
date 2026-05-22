export type XuStepStatus = "pending" | "active" | "approved" | "needs-revision" | "complete";

export const XU_PHASE_AGENTS = [
  "claude-code",
  "codex",
  "gemini",
  "cursor",
  "cline",
  "continue",
  "aider",
  "copilot",
  "augment-code",
] as const;

export type XuPhaseAgent = (typeof XU_PHASE_AGENTS)[number];

export type XuRunbookStatus = "draft" | "approved" | "in-progress" | "complete";

export type XuMode = "build-app" | "phases" | "plan" | "review";

export type XuConfirmation = {
  required: boolean;
  status: "pending" | "approved" | "needs-revision";
  userApprovedIntent: boolean;
  userApprovedArchitecture: boolean;
  userApprovedProvisioning: boolean;
};

export type XuArchitectureDecision = {
  id: string;
  choice: string;
  rationale: string;
};

export type XuArchitecture = {
  status: "draft" | "proposed" | "approved" | "needs-revision";
  summary: string;
  decisions: XuArchitectureDecision[];
  risks: string[];
  assumptions: string[];
};

export type XuProvisioning = {
  status: "draft" | "proposed" | "approved";
  commands: string[];
  filesToCreate: string[];
  environmentVariables: string[];
  externalServices: string[];
  safety: {
    requiresApprovalBeforeExecution: boolean;
    executeAutomatically: boolean;
  };
};

export type XuStep = {
  id: string;
  text: string;
  status: XuStepStatus;
};

export type XuPhase = {
  id: string;
  title: string;
  agent?: XuPhaseAgent;
  gate: string;
  status: XuStepStatus;
  objective: string;
  inputs: string[];
  outputs: string[];
  steps: XuStep[];
  acceptance: string[];
};

export type ApplicationBuildRunbook = {
  xu: 1;
  kind: "ApplicationBuildRunbook";
  metadata: {
    name: string;
    owner: string;
    status: XuRunbookStatus;
    mode?: XuMode;
  };
  intent: {
    rawPrompt: string;
    purpose: string;
    users: string[];
    goals: string[];
    nonGoals: string[];
    constraints: string[];
  };
  confirmation: XuConfirmation;
  architecture: XuArchitecture;
  provisioning: XuProvisioning;
  phases: XuPhase[];
  checks: {
    install?: string;
    dev?: string;
    build?: string;
    test?: string;
    lint?: string;
  };
  agentTargets: {
    agentsMd: boolean;
    claudeMd: boolean;
    copilotInstructions: boolean;
    cursorRules: boolean;
    codexSkill: boolean;
    openclawSkill: boolean;
  };
  handoff: {
    defaultAgent: string;
    autopilot: boolean;
    instructions: string[];
  };
};

export type XuValidationDiagnostic = {
  path: string;
  message: string;
};

export type XuValidationResult = {
  ok: boolean;
  diagnostics: XuValidationDiagnostic[];
};

export type BuildSessionState = {
  id: string;
  mode: XuMode;
  prompt: string;
  createdAt: string;
  runbookPath: string;
  providerId: "xupra-pro-ai" | "user-ide-ai" | "external-ai-prompt";
  providerLabel: "Xupra AI" | "User IDE AI" | "External AI Prompt";
};

