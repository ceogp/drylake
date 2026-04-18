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
