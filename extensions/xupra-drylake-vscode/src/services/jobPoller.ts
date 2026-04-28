import { ApiClient } from "./apiClient";

export async function waitForDeploymentJob(apiClient: ApiClient, jobId: string, attempts = 6) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await apiClient.getDeploymentJob(jobId);

    if (["succeeded", "failed", "cancelled"].includes(result.deploymentJob.status)) {
      return result.deploymentJob;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return apiClient.getDeploymentJob(jobId).then((result) => result.deploymentJob);
}

export async function waitForTransformJob(apiClient: ApiClient, jobId: string, attempts = 6) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await apiClient.getTransformJob(jobId);

    if (["succeeded", "failed", "cancelled"].includes(result.transformJob.status)) {
      return result.transformJob;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return apiClient.getTransformJob(jobId).then((result) => result.transformJob);
}
