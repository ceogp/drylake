export type Id = string;
export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export type ProjectSummary = {
  id: Id;
  name: string;
  description?: string | null;
  packages: Array<{
    id: Id;
    name: string;
    versions: Array<{
      id: Id;
      versionNumber: number;
      status: string;
    }>;
  }>;
};

export type ProjectDetail = {
  id: Id;
  name: string;
  description?: string | null;
  packages: Array<{
    id: Id;
    name: string;
    versions: Array<{
      id: Id;
      versionNumber: number;
      status: string;
    }>;
  }>;
  deploymentTargets: Array<{
    id: Id;
    name: string;
    platform: string;
    deliveryMode: string;
  }>;
};

export type PackageVersionDetail = {
  id: Id;
  versionNumber: number;
  status: string;
  agentPackageId: Id;
  files?: Array<{
    id: Id;
    kind: string;
    logicalPath: string;
    sourceFormat: string;
    createdAt: string;
  }>;
  subagents?: Array<{
    id: Id;
    name: string;
    slug: string;
    description: string;
    instructionsMd: string;
    toolsJson?: unknown;
    modelHint?: string | null;
    permissionMode?: string | null;
    metadataJson?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  skillRules?: Array<{
    id: Id;
    name: string;
    kind: string;
    bodyMd: string;
    metadataJson?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  transformJobs?: Array<{
    id: Id;
    status: string;
    jobType: string;
    targetPlatform?: string | null;
  }>;
};

export type JobResult = {
  id: Id;
  status: string;
  targetPlatform?: string;
};

export type TransformJobDetail = {
  id: Id;
  status: string;
  jobType: string;
  targetPlatform?: string | null;
  resultJson?: Record<string, unknown> | null;
  errorJson?: Record<string, unknown> | null;
};

export type GeneratedExportFile = {
  id?: Id;
  logicalPath: string;
  preview: string;
  targetPlatform?: string;
  storedLogicalPath?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
};

export type GeneratedSkill = {
  name: string;
  description: string;
  targetPlatform: string;
  content: string;
};

export type GeneratedAgent = {
  name: string;
  description: string;
  targetPlatform: string;
  content: string;
};

export type ExtensionConnection = {
  editor: "vscode" | "cursor";
  auth: {
    mode: "dev" | "cognito";
    provider: string;
    configured: boolean;
    pendingKeys: string[];
    session: {
      status: string;
      organizationId: string | null;
      user:
        | {
            id: string;
            email: string;
            imageUrl?: string | null;
            displayName?: string | null;
          }
        | null;
    };
  };
  user:
    | {
        id: string;
        email: string;
        imageUrl?: string | null;
      }
    | null;
  organization:
    | {
        id: string | null;
        name?: string;
        slug?: string;
        tier?: string;
      }
    | null;
  organizationRole?: OrganizationRole;
  entitlements?: Record<string, boolean>;
  entitlementVersion?: number;
  plan?: string;
  subscription?: {
    status: string;
    currentPeriodEnd?: string;
  };
};
