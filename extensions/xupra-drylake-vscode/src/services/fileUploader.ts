import { ApiClient } from "./apiClient";

export async function uploadWorkspaceFiles(
  apiClient: ApiClient,
  versionId: string,
  files: Array<{ logicalPath: string; content: string }>
) {
  return apiClient.uploadFiles(versionId, files);
}
