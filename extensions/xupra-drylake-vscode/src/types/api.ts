export type Id = string;

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

export type ExtensionConnection = {
  editor: "vscode" | "cursor";
  auth: {
    mode: "dev" | "clerk";
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
            displayName?: string | null;
          }
        | null;
    };
  };
  user:
    | {
        id: string;
        email: string;
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
};
