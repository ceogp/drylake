import { ApiClient } from "../services/apiClient";
import { ProjectTreeProvider } from "../views/projectTreeProvider";

export async function refreshProjectsCommand(apiClient: ApiClient, projectsView: ProjectTreeProvider) {
  const result = await apiClient.listProjects();
  projectsView.setProjects(result.projects);
  return result.projects;
}
