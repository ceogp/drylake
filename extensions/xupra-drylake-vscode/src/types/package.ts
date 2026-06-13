export type SelectedContext = {
  projectId?: string;
  packageId?: string;
  versionId?: string;
};

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export type EntitlementKey =
  | "canUseHostedPlanning"
  | "canUseFixWithAI"
  | "canUseApprovedUpload"
  | "canUseDeepCloudAnalysis"
  | "canUseSuspiciousArtifactScan"
  | "canUseLocalWatchdog"
  | "canCreateTeam"
  | "canUseTeamBaseline"
  | "canUseContinuousWatch"
  | "canManageTeamPolicy"
  | "xupra_pro_ai"
  | "session_cloud_sync"
  | "pr_summary_generation";

export type EntitlementMap = Record<EntitlementKey, boolean>;

export type ConnectionState = {
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  organizationTier?: string;
  organizationRole?: OrganizationRole;
  plan?: string;
  entitlementVersion?: number;
  entitlements?: EntitlementMap;
  subscriptionStatus?: string;
  awaitingPlanRefreshUntil?: string | null;
  userEmail?: string;
  userAvatarUrl?: string | null;
  authMode?: "dev" | "clerk" | "cognito";
};

export type DetectedWorkspaceFile = {
  logicalPath: string;
  category:
    | "instruction"
    | "skill"
    | "subagent"
    | "rule"
    | "agent_config"
    | "source";
};

export type LastImportSummary = {
  jobId: string;
  versionId: string;
  status: string;
  completedAt: string;
  imported?: {
    rawFiles?: number;
    subagents?: number;
    skills?: number;
    rules?: number;
    updatedInstructions?: boolean;
  };
  warnings: string[];
  uploadedPaths: string[];
};

export type ImportedWorkspaceFile = {
  id: string;
  logicalPath: string;
  kind: string;
  sourceFormat: string;
  sourcePlatform: string;
};

export type ImportedWorkspaceSubagent = {
  id: string;
  name: string;
  slug: string;
  sourcePlatform: string;
  sourcePath?: string;
  sourceContent: string;
};

export type ImportedWorkspaceSkillRule = {
  id: string;
  name: string;
  kind: string;
  sourcePlatform: string;
  sourcePath?: string;
  sourceContent: string;
};

export type ImportedWorkspaceSnapshot = {
  versionId: string;
  files: ImportedWorkspaceFile[];
  subagents: ImportedWorkspaceSubagent[];
  skillRules: ImportedWorkspaceSkillRule[];
};
