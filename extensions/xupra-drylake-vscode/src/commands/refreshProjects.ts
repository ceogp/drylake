import { ApiClient } from "../services/apiClient";

export async function refreshProjectsCommand(apiClient: ApiClient) {
  const result = await apiClient.listProjects();
  return result.projects;
}
