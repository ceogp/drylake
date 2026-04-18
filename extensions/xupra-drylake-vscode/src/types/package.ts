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
