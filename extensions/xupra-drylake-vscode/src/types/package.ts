export type SelectedContext = {
  projectId?: string;
  packageId?: string;
  versionId?: string;
};

export type ConnectionState = {
  organizationId?: string;
  organizationSlug?: string;
  userEmail?: string;
  authMode?: "dev" | "clerk";
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
