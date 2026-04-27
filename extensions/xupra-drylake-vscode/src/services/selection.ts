import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
import { StateStore } from "./stateStore";

async function pickProject(
  apiClient: ApiClient,
  stateStore: StateStore
) {
  const projects = (await apiClient.listProjects()).projects;

  if (projects.length === 0) {
    throw new Error("No projects are available yet.");
  }

  const picked = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.name,
      description: `${project.packages.length} packages`,
      project
    })),
    {
      title: "Select Xupra project"
    }
  );

  if (!picked) {
    return null;
  }

  await stateStore.setSelection({
    projectId: picked.project.id,
    packageId: undefined,
    versionId: undefined
  });

  return picked.project;
}

export async function selectProjectWithPrompt(apiClient: ApiClient, stateStore: StateStore) {
  return pickProject(apiClient, stateStore);
}

export async function selectPackageWithPrompt(apiClient: ApiClient, stateStore: StateStore) {
  const selected = stateStore.getSelection();
  const projects = (await apiClient.listProjects()).projects;

  const packages = projects.flatMap((project) =>
    project.packages.map((agentPackage) => ({
      label: agentPackage.name,
      description: project.name,
      projectId: project.id,
      packageId: agentPackage.id
    }))
  );

  if (packages.length === 0) {
    throw new Error("No packages are available yet.");
  }

  const picked = await vscode.window.showQuickPick(packages, {
    title: "Select Xupra package",
    placeHolder: selected.projectId ? "Packages in your workspace" : undefined
  });

  if (!picked) {
    return null;
  }

  await stateStore.setSelection({
    projectId: picked.projectId,
    packageId: picked.packageId,
    versionId: undefined
  });

  return picked;
}

export async function selectVersionWithPrompt(apiClient: ApiClient, stateStore: StateStore) {
  const selected = stateStore.getSelection();
  const projects = (await apiClient.listProjects()).projects;

  const versions = projects.flatMap((project) =>
    project.packages.flatMap((agentPackage) =>
      agentPackage.versions.map((version) => ({
        label: `v${version.versionNumber} · ${version.status}`,
        description: `${project.name} / ${agentPackage.name}`,
        projectId: project.id,
        packageId: agentPackage.id,
        versionId: version.id
      }))
    )
  );

  if (versions.length === 0) {
    throw new Error("No import targets are available yet.");
  }

  const picked = await vscode.window.showQuickPick(versions, {
    title: "Choose where imports should land",
    placeHolder: selected.packageId ? "Available import targets" : undefined
  });

  if (!picked) {
    return null;
  }

  await stateStore.setSelection({
    projectId: picked.projectId,
    packageId: picked.packageId,
    versionId: picked.versionId
  });

  return picked;
}

export async function ensureVersionSelection(apiClient: ApiClient, stateStore: StateStore) {
  const selected = stateStore.getSelection();

  if (selected.versionId) {
    return selected;
  }

  const projects = (await apiClient.listProjects()).projects;
  const versions = projects.flatMap((project) =>
    project.packages.flatMap((agentPackage) =>
      agentPackage.versions.map((version) => ({
        projectId: project.id,
        packageId: agentPackage.id,
        versionId: version.id,
      })),
    ),
  );

  if (versions.length === 1) {
    const only = versions[0];
    await stateStore.setSelection({
      projectId: only.projectId,
      packageId: only.packageId,
      versionId: only.versionId,
    });
    return stateStore.getSelection();
  }

  const picked = await selectVersionWithPrompt(apiClient, stateStore);

  if (!picked) {
    return null;
  }

  return stateStore.getSelection();
}

export async function ensureProjectAndVersionSelection(apiClient: ApiClient, stateStore: StateStore) {
  const selected = await ensureVersionSelection(apiClient, stateStore);

  if (!selected?.projectId || !selected.versionId) {
    return null;
  }

  return selected;
}

export async function chooseTargetPlatform(
  configuration: vscode.WorkspaceConfiguration,
  title: string
) {
  const defaultTarget = String(configuration.get("defaultTargetPlatform", "claude_code"));
  const options = [
    { label: "Codex", value: "codex" },
    { label: "Claude Code", value: "claude_code" },
    { label: "Claude Agents", value: "claude_agents" },
    { label: "Cursor", value: "cursor" }
  ];

  return vscode.window.showQuickPick(options, {
    title,
    placeHolder: defaultTarget
  });
}
