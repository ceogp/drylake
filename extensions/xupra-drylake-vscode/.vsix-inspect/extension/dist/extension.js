"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode31 = __toESM(require("vscode"));

// src/commands/checkCompatibility.ts
var vscode2 = __toESM(require("vscode"));

// src/services/jobPoller.ts
async function waitForTransformJob(apiClient, jobId, attempts = 6) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await apiClient.getTransformJob(jobId);
    if (["succeeded", "failed", "cancelled"].includes(result.transformJob.status)) {
      return result.transformJob;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return apiClient.getTransformJob(jobId).then((result) => result.transformJob);
}

// src/services/selection.ts
var vscode = __toESM(require("vscode"));
async function selectVersionWithPrompt(apiClient, stateStore) {
  const selected = stateStore.getSelection();
  const projects = (await apiClient.listProjects()).projects;
  const versions = projects.flatMap(
    (project) => project.packages.flatMap(
      (agentPackage) => agentPackage.versions.map((version) => ({
        label: `v${version.versionNumber} \xB7 ${version.status}`,
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
    placeHolder: selected.packageId ? "Available import targets" : void 0
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
async function ensureVersionSelection(apiClient, stateStore) {
  const selected = stateStore.getSelection();
  if (selected.versionId) {
    return selected;
  }
  const projects = (await apiClient.listProjects()).projects;
  const versions = projects.flatMap(
    (project) => project.packages.flatMap(
      (agentPackage) => agentPackage.versions.map((version) => ({
        projectId: project.id,
        packageId: agentPackage.id,
        versionId: version.id
      }))
    )
  );
  if (versions.length === 1) {
    const only = versions[0];
    await stateStore.setSelection({
      projectId: only.projectId,
      packageId: only.packageId,
      versionId: only.versionId
    });
    return stateStore.getSelection();
  }
  const picked = await selectVersionWithPrompt(apiClient, stateStore);
  if (!picked) {
    return null;
  }
  return stateStore.getSelection();
}
async function chooseTargetPlatform(configuration, title) {
  const defaultTarget = String(configuration.get("defaultTargetPlatform", "claude_code"));
  const options = [
    { label: "Codex", value: "codex" },
    { label: "Claude Code", value: "claude_code" },
    { label: "Claude Agents", value: "claude_agents" },
    { label: "Cursor", value: "cursor" },
    { label: "Windsurf", value: "windsurf" },
    { label: "Cline", value: "cline" },
    { label: "Roo Code", value: "roo" },
    { label: "GitHub Copilot", value: "copilot" },
    { label: "Gemini CLI", value: "gemini" },
    { label: "JetBrains Junie", value: "junie" },
    { label: "Warp", value: "warp" },
    { label: "Generic .rules", value: "generic" }
  ];
  return vscode.window.showQuickPick(options, {
    title,
    placeHolder: defaultTarget
  });
}

// src/commands/checkCompatibility.ts
async function checkCompatibilityCommand(apiClient, configuration, stateStore, jobsView) {
  const selection = await ensureVersionSelection(apiClient, stateStore);
  if (!selection?.versionId) {
    return;
  }
  const picked = await chooseTargetPlatform(configuration, "Select target platform for compatibility");
  if (!picked) {
    return;
  }
  const targetPlatform = picked.value;
  const result = await apiClient.checkCompatibility(selection.versionId, targetPlatform);
  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Compatibility ${targetPlatform}`,
    status: result.job.status,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const completed = await waitForTransformJob(apiClient, result.job.id);
  void vscode2.window.showInformationMessage(`Compatibility check finished for ${picked.label} with status ${completed.status}.`);
}

// src/commands/connect.ts
var vscode5 = __toESM(require("vscode"));

// src/services/connectionState.ts
var DEFAULT_ENTITLEMENTS = {
  xupra_pro_ai: false,
  session_cloud_sync: false,
  pr_summary_generation: false
};
var ENTITLEMENT_KEYS = ["xupra_pro_ai", "session_cloud_sync", "pr_summary_generation"];
function normalizeEntitlements(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ENTITLEMENTS };
  }
  const entitlements = { ...DEFAULT_ENTITLEMENTS };
  const raw = value;
  for (const key of ENTITLEMENT_KEYS) {
    const enabled = raw[key];
    if (typeof enabled === "boolean") {
      entitlements[key] = enabled;
    }
  }
  return entitlements;
}
function connectionStateFromExtensionConnection(result) {
  return {
    organizationId: result.organization?.id ?? result.auth.session.organizationId ?? void 0,
    organizationName: result.organization?.name,
    organizationSlug: result.organization?.slug,
    organizationTier: result.organization?.tier ?? "free",
    entitlements: normalizeEntitlements(result.entitlements),
    subscriptionStatus: result.subscription?.status,
    userEmail: result.user?.email ?? void 0,
    userAvatarUrl: result.user?.imageUrl ?? result.auth.session.user?.imageUrl ?? void 0,
    authMode: result.auth.mode
  };
}
function connectionHasEntitlement(connection, key) {
  return Boolean(connection.entitlements?.[key]);
}

// src/services/session.ts
var vscode4 = __toESM(require("vscode"));

// src/utils/logging.ts
var vscode3 = __toESM(require("vscode"));
var channel;
function getLogger() {
  if (!channel) {
    channel = vscode3.window.createOutputChannel("Xupra DryLake");
  }
  return {
    info(message) {
      channel?.appendLine(`[info] ${message}`);
    },
    error(message) {
      channel?.appendLine(`[error] ${message}`);
    }
  };
}

// src/services/session.ts
var logger = getLogger();
async function promptForAccessToken(apiClient) {
  const openConnectPage = "Open Connect Page";
  const pasteToken = "Paste Token";
  const selection = await vscode4.window.showInformationMessage(
    "If the browser handoff does not work, open the connect page and use the manual token fallback.",
    openConnectPage,
    pasteToken
  );
  if (selection === openConnectPage) {
    await vscode4.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  }
  if (selection !== pasteToken) {
    return null;
  }
  return vscode4.window.showInputBox({
    title: "Xupra DryLake Extension Token",
    prompt: "Paste the extension token from the Xupra website.",
    ignoreFocusOut: true,
    password: true,
    validateInput(value) {
      return value.trim().length > 20 ? null : "Paste the full token from the website.";
    }
  });
}
async function connectSession(apiClient, configuration, stateStore, browserConnect) {
  const storedToken = await stateStore.getAccessToken();
  if (storedToken) {
    apiClient.setAccessToken(storedToken);
    const authSession2 = await apiClient.getAuthSession().catch(() => null);
    if (authSession2?.auth.session.status === "active") {
      return apiClient.connect(void 0, void 0, storedToken);
    }
    apiClient.setAccessToken(void 0);
    await stateStore.clearAccessToken();
  }
  const authSession = await apiClient.getAuthSession();
  if (authSession.auth.session.status === "active") {
    return apiClient.connect();
  }
  const browserResult = await browserConnect.start();
  if (browserResult?.kind === "approved") {
    apiClient.setAccessToken(browserResult.session.token.token);
    await stateStore.setAccessToken(browserResult.session.token.token);
    logger.info(
      `Browser connect poll_succeeded ${JSON.stringify({
        organizationId: browserResult.session.organization.id,
        editor: browserResult.session.editor
      })}`
    );
    const result = await apiClient.connect(
      void 0,
      void 0,
      browserResult.session.token.token
    );
    return result;
  }
  if (browserResult?.kind === "error") {
    void vscode4.window.showWarningMessage(browserResult.message);
  }
  const accessToken = await promptForAccessToken(apiClient);
  if (accessToken) {
    const trimmedToken = accessToken.trim();
    apiClient.setAccessToken(trimmedToken);
    const result = await apiClient.connect(void 0, void 0, trimmedToken);
    await stateStore.setAccessToken(trimmedToken);
    return result;
  }
  if (authSession.auth.mode !== "dev") {
    throw new Error("The browser sign-in did not complete. Use the manual token fallback if needed.");
  }
  const email = String(configuration.get("devEmail", "owner@xupra.local"));
  const displayName = String(configuration.get("devDisplayName", "Xupra Owner"));
  return apiClient.connect(email, displayName);
}

// src/commands/connect.ts
async function connectCommand(apiClient, configuration, stateStore, browserConnect) {
  try {
    const result = await connectSession(apiClient, configuration, stateStore, browserConnect);
    const connection = connectionStateFromExtensionConnection(result);
    await stateStore.setConnection(connection);
    await stateStore.clearLastImport();
    if (!result.auth.configured) {
      void vscode5.window.showWarningMessage(
        `Xupra DryLake auth is set to ${result.auth.mode}, but it still needs ${result.auth.pendingKeys.join(", ")}.`
      );
      return;
    }
    return true;
  } catch (error) {
    void vscode5.window.showErrorMessage(
      error instanceof Error ? error.message : "Failed to connect to Xupra DryLake."
    );
    return false;
  }
}

// src/commands/exportPreview.ts
var vscode7 = __toESM(require("vscode"));

// src/services/fileSync.ts
var vscode6 = __toESM(require("vscode"));
var path = __toESM(require("node:path"));
function safeLogicalPath(rawPath) {
  const normalized = rawPath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (path.posix.isAbsolute(rawPath) || normalized.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing to write generated file outside the workspace: ${rawPath}`);
  }
  return normalized;
}
async function writeGeneratedFilesToWorkspace(files, options) {
  const root = options?.rootUri ?? vscode6.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("No workspace folder is open.");
  }
  if (options?.confirmBeforeWrite) {
    const decision = await vscode6.window.showWarningMessage(
      `Write ${files.length} generated file${files.length === 1 ? "" : "s"} into ${options.confirmationLabel ?? "the current workspace"}?`,
      { modal: true },
      "Write Files"
    );
    if (decision !== "Write Files") {
      return 0;
    }
  }
  for (const file of files) {
    const pathSegments = safeLogicalPath(file.logicalPath);
    const target = vscode6.Uri.joinPath(root, ...pathSegments);
    const directorySegments = path.posix.dirname(file.logicalPath).split("/").filter((segment) => Boolean(segment) && segment !== "." && segment !== "..");
    const directory = directorySegments.length > 0 ? vscode6.Uri.joinPath(root, ...directorySegments) : root;
    await vscode6.workspace.fs.createDirectory(directory);
    await vscode6.workspace.fs.writeFile(target, Buffer.from(file.preview, "utf8"));
  }
  return files.length;
}

// src/commands/exportPreview.ts
async function exportPreviewCommand(apiClient, configuration, stateStore, jobsView) {
  const selection = await ensureVersionSelection(apiClient, stateStore);
  if (!selection?.versionId) {
    return;
  }
  const picked = await chooseTargetPlatform(configuration, "Select export target");
  if (!picked) {
    return;
  }
  const targetPlatform = picked.value;
  const result = await apiClient.exportPreview(selection.versionId, targetPlatform);
  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Export ${targetPlatform}`,
    status: result.job.status,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const completed = await waitForTransformJob(apiClient, result.job.id);
  if (configuration.get("pullGeneratedFilesAfterExport")) {
    const generated = result.generatedFiles?.length ? result.generatedFiles : (await apiClient.listGeneratedExports(selection.versionId, targetPlatform)).generatedFiles;
    if (generated.length === 0) {
      void vscode7.window.showWarningMessage(`Export preview completed for ${picked.label}, but no generated files were available to write.`);
      return;
    }
    const writtenCount = await writeGeneratedFilesToWorkspace(generated, {
      confirmBeforeWrite: configuration.get("confirmBeforeWriteback", true)
    });
    void vscode7.window.showInformationMessage(`Exported ${picked.label} with status ${completed.status} and wrote ${writtenCount} files.`);
    return;
  }
  void vscode7.window.showInformationMessage(`Export preview completed for ${picked.label} with status ${completed.status}.`);
}

// src/commands/importWorkspace.ts
var vscode10 = __toESM(require("vscode"));

// src/services/fileUploader.ts
async function uploadWorkspaceFiles(apiClient, versionId, files) {
  return apiClient.uploadFiles(versionId, files);
}

// src/services/workspaceScanner.ts
var vscode9 = __toESM(require("vscode"));
var import_node_os = __toESM(require("node:os"));
var import_node_path = __toESM(require("node:path"));

// src/utils/files.ts
var vscode8 = __toESM(require("vscode"));
async function readWorkspaceFile(uri) {
  const bytes = await vscode8.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}

// src/services/workspaceScanner.ts
var PATTERNS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/**/SKILL.md",
  ".codex/agents/**/*.toml",
  ".codex/skills/**/SKILL.md",
  ".claude/skills/**/SKILL.md",
  ".claude/agents/**/*.md",
  ".cursor/skills/**/SKILL.md",
  ".cursor/rules/**/*.mdc",
  ".windsurf/rules/**/*.md",
  ".clinerules",
  ".clinerules/**/*.md",
  ".roo/rules/**/*.md",
  ".roorules",
  ".github/copilot-instructions.md",
  ".github/instructions/**/*.instructions.md",
  "GEMINI.md",
  ".junie/guidelines.md",
  "WARP.md",
  ".rules"
];
var EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage,storage,.venv,__pycache__,google-cloud-sdk,generated_export,raw_source,deployment_output,worker-smoke,.system}/**";
var MAX_FILES_PER_GLOBAL_ROOT = 200;
var MAX_FILES_PER_SELECTED_FOLDER = 1e3;
var EXCLUDED_FOLDER_NAMES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "storage",
  ".venv",
  "__pycache__",
  "google-cloud-sdk",
  "generated_export",
  "raw_source",
  "deployment_output",
  "worker-smoke",
  ".system"
]);
var IGNORED_LOGICAL_PATH_PATTERN = /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|storage|\.venv|__pycache__|google-cloud-sdk|generated_export|raw_source|deployment_output|worker-smoke|\.system)(\/|$)/i;
var GLOBAL_SCAN_ROOTS = [
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".codex", "agents"),
    logicalBase: ".codex/agents",
    matches: (relativePath2) => /\.toml$/i.test(relativePath2)
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".codex", "skills"),
    logicalBase: ".codex/skills",
    matches: (relativePath2) => /(^|\/)SKILL\.md$/i.test(relativePath2)
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".claude", "agents"),
    logicalBase: ".claude/agents",
    matches: (relativePath2) => /\.md$/i.test(relativePath2)
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".claude", "skills"),
    logicalBase: ".claude/skills",
    matches: (relativePath2) => /(^|\/)SKILL\.md$/i.test(relativePath2)
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".cursor", "skills"),
    logicalBase: ".cursor/skills",
    matches: (relativePath2) => /(^|\/)SKILL\.md$/i.test(relativePath2)
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".cursor", "rules"),
    logicalBase: ".cursor/rules",
    matches: (relativePath2) => /\.mdc$/i.test(relativePath2)
  }
];
var GLOBAL_SCAN_FILES = [
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".codex", "AGENTS.md"),
    logicalPath: ".codex/AGENTS.md"
  },
  {
    absolutePath: () => import_node_path.default.join(import_node_os.default.homedir(), ".claude", "CLAUDE.md"),
    logicalPath: ".claude/CLAUDE.md"
  }
];
function getConfiguredPatterns(configuration) {
  const configuredPatterns = configuration?.get("additionalScanPatterns", []) ?? [];
  return [.../* @__PURE__ */ new Set([...PATTERNS, ...configuredPatterns.map((pattern) => pattern.trim()).filter(Boolean)])];
}
function getExcludePattern(configuration) {
  const userExcludes = (configuration?.get("scan.exclude", []) ?? []).map((pattern) => pattern.trim()).filter(Boolean);
  if (userExcludes.length === 0) {
    return EXCLUDE_PATTERN;
  }
  return `{${EXCLUDE_PATTERN},${userExcludes.join(",")}}`;
}
function shouldIgnoreLogicalPath(logicalPath) {
  return IGNORED_LOGICAL_PATH_PATTERN.test(logicalPath.replace(/\\/g, "/"));
}
async function scanWorkspaceFiles(configuration) {
  const seen = /* @__PURE__ */ new Set();
  const results = [];
  const excludePattern = getExcludePattern(configuration);
  for (const pattern of getConfiguredPatterns(configuration)) {
    const files = await vscode9.workspace.findFiles(pattern, excludePattern, 200);
    for (const file of files) {
      const logicalPath = vscode9.workspace.asRelativePath(file, false).replace(/\\/g, "/");
      if (shouldIgnoreLogicalPath(logicalPath)) {
        continue;
      }
      if (seen.has(logicalPath)) {
        continue;
      }
      seen.add(logicalPath);
      results.push({
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath)
      });
    }
  }
  if (configuration?.get("includeGlobalAgentFiles", true) ?? true) {
    const globalFiles = await scanGlobalAgentFiles();
    for (const file of globalFiles) {
      if (shouldIgnoreLogicalPath(file.logicalPath)) {
        continue;
      }
      if (seen.has(file.logicalPath)) {
        continue;
      }
      seen.add(file.logicalPath);
      results.push(file);
    }
  }
  return results;
}
async function scanDefaultLocationFiles() {
  return scanGlobalAgentFiles();
}
async function scanSelectedFolderFiles(rootUri) {
  const files = await findSelectedFolderFiles(rootUri, MAX_FILES_PER_SELECTED_FOLDER);
  return Promise.all(
    files.map(async (file) => {
      const logicalPath = getLogicalPathForSelectedFolder(rootUri, file);
      return {
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath)
      };
    })
  );
}
async function scanGlobalAgentFiles() {
  const results = [];
  for (const file of GLOBAL_SCAN_FILES) {
    const fileUri = vscode9.Uri.file(file.absolutePath());
    try {
      await vscode9.workspace.fs.stat(fileUri);
    } catch {
      continue;
    }
    results.push({
      logicalPath: file.logicalPath,
      content: await readWorkspaceFile(fileUri),
      category: classifyWorkspaceFile(file.logicalPath)
    });
  }
  for (const root of GLOBAL_SCAN_ROOTS) {
    const rootUri = vscode9.Uri.file(root.absolutePath());
    const files = await findGlobalFiles(rootUri, root.matches, MAX_FILES_PER_GLOBAL_ROOT);
    for (const file of files) {
      const relativePath2 = import_node_path.default.relative(rootUri.fsPath, file.fsPath).replace(/\\/g, "/");
      const logicalPath = `${root.logicalBase}/${relativePath2}`;
      results.push({
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath)
      });
    }
  }
  return results;
}
async function findGlobalFiles(rootUri, matches, limit) {
  const files = [];
  async function walk(currentUri) {
    if (files.length >= limit) {
      return;
    }
    let entries;
    try {
      entries = await vscode9.workspace.fs.readDirectory(currentUri);
    } catch {
      return;
    }
    for (const [name, fileType] of entries) {
      if (files.length >= limit) {
        return;
      }
      if (fileType === vscode9.FileType.Directory && EXCLUDED_FOLDER_NAMES.has(name)) {
        continue;
      }
      const childUri = vscode9.Uri.joinPath(currentUri, name);
      const relativePath2 = import_node_path.default.relative(rootUri.fsPath, childUri.fsPath).replace(/\\/g, "/");
      if (fileType === vscode9.FileType.Directory) {
        await walk(childUri);
        continue;
      }
      if (fileType === vscode9.FileType.File && matches(relativePath2)) {
        files.push(childUri);
      }
    }
  }
  await walk(rootUri);
  return files;
}
async function findSelectedFolderFiles(rootUri, limit) {
  const files = [];
  async function walk(currentUri) {
    if (files.length >= limit) {
      return;
    }
    let entries;
    try {
      entries = await vscode9.workspace.fs.readDirectory(currentUri);
    } catch {
      return;
    }
    for (const [name, fileType] of entries) {
      if (files.length >= limit) {
        return;
      }
      if (fileType === vscode9.FileType.Directory && EXCLUDED_FOLDER_NAMES.has(name)) {
        continue;
      }
      const childUri = vscode9.Uri.joinPath(currentUri, name);
      if (fileType === vscode9.FileType.Directory) {
        await walk(childUri);
        continue;
      }
      const logicalPath = getLogicalPathForSelectedFolder(rootUri, childUri);
      if (fileType === vscode9.FileType.File && !shouldIgnoreLogicalPath(logicalPath) && isSupportedFolderImportFile(rootUri, childUri)) {
        files.push(childUri);
      }
    }
  }
  await walk(rootUri);
  return files;
}
function isSupportedFolderImportFile(rootUri, fileUri) {
  const logicalPath = getLogicalPathForSelectedFolder(rootUri, fileUri).toLowerCase();
  const baseName = import_node_path.default.posix.basename(logicalPath);
  if (logicalPath === "agents.md" || logicalPath === "claude.md") {
    return true;
  }
  if (logicalPath === ".codex/agents.md" || logicalPath === ".claude/claude.md") {
    return true;
  }
  if (baseName === "skill.md" && /(^|\/)(\.agents|\.codex|\.claude|\.cursor)?\/?skills\//i.test(logicalPath)) {
    return true;
  }
  if (/\.codex\/agents\/.+\.toml$/i.test(logicalPath)) {
    return true;
  }
  if (/\.claude\/agents\/.+\.md$/i.test(logicalPath)) {
    return true;
  }
  if (/\.cursor\/rules\/.+\.mdc$/i.test(logicalPath)) {
    return true;
  }
  if (/\.windsurf\/rules\/.+\.md$/i.test(logicalPath) || /\.clinerules(?:\/.+\.md)?$/i.test(logicalPath) || /\.roo\/rules\/.+\.md$/i.test(logicalPath) || logicalPath === ".roorules" || logicalPath === ".github/copilot-instructions.md" || /\.github\/instructions\/.+\.instructions\.md$/i.test(logicalPath) || logicalPath === "gemini.md" || logicalPath === ".junie/guidelines.md" || logicalPath === "warp.md" || logicalPath === ".rules") {
    return true;
  }
  return false;
}
function getLogicalPathForSelectedFolder(rootUri, fileUri) {
  const relativePath2 = import_node_path.default.relative(rootUri.fsPath, fileUri.fsPath).replace(/\\/g, "/");
  const rootParts = rootUri.fsPath.replace(/\\/g, "/").split("/").filter(Boolean);
  let hiddenRootIndex = -1;
  for (let index = rootParts.length - 1; index >= 0; index -= 1) {
    const part = rootParts[index];
    if (part === ".agents" || part === ".codex" || part === ".claude" || part === ".cursor" || part === ".windsurf" || part === ".clinerules" || part === ".roo" || part === ".github" || part === ".junie") {
      hiddenRootIndex = index;
      break;
    }
  }
  if (hiddenRootIndex >= 0) {
    const prefix = rootParts.slice(hiddenRootIndex).join("/");
    return `${prefix}/${relativePath2}`;
  }
  return relativePath2;
}
function getWorkspaceDisplayName() {
  return vscode9.workspace.workspaceFolders?.[0]?.name ?? "No workspace";
}
function classifyWorkspaceFile(logicalPath) {
  if (logicalPath === "AGENTS.md" || logicalPath === "CLAUDE.md" || /^\.codex\/AGENTS\.md$/i.test(logicalPath) || /^\.claude\/CLAUDE\.md$/i.test(logicalPath)) {
    return "instruction";
  }
  if (/\.codex\/agents\/.+\.toml$/i.test(logicalPath)) {
    return "agent_config";
  }
  if (/\/?\.claude\/agents\/.+\.md$/i.test(logicalPath)) {
    return "subagent";
  }
  if (/\/?\.cursor\/rules\/.+\.mdc$/i.test(logicalPath)) {
    return "rule";
  }
  if (/\/?\.windsurf\/rules\/.+\.md$/i.test(logicalPath) || /\/?\.clinerules(?:\/.+\.md)?$/i.test(logicalPath) || /\/?\.roo\/rules\/.+\.md$/i.test(logicalPath) || /\/?\.roorules$/i.test(logicalPath) || /\/?\.github\/(?:copilot-instructions\.md|instructions\/.+\.instructions\.md)$/i.test(logicalPath) || /\/?\.junie\/guidelines\.md$/i.test(logicalPath) || /\/?\.rules$/i.test(logicalPath)) {
    return "rule";
  }
  if (/\/?(GEMINI|WARP)\.md$/i.test(logicalPath)) {
    return "instruction";
  }
  if (/\/?(\.agents\/skills|\.codex\/skills|\.claude\/skills|\.cursor\/skills)\/.+\/SKILL\.md$/i.test(logicalPath)) {
    return "skill";
  }
  return "source";
}

// src/commands/importWorkspace.ts
function asImportedCounts(rawValue) {
  const value = rawValue && typeof rawValue === "object" ? rawValue : {};
  const asNumber = (next) => typeof next === "number" && Number.isFinite(next) ? next : 0;
  const asBoolean2 = (next) => next === true;
  return {
    rawFiles: asNumber(value.rawFiles),
    subagents: asNumber(value.subagents),
    skills: asNumber(value.skills),
    rules: asNumber(value.rules),
    updatedInstructions: asBoolean2(value.updatedInstructions)
  };
}
async function importFiles(apiClient, stateStore, jobsView, files, title) {
  await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
  if (files.length === 0) {
    void vscode10.window.showWarningMessage("No supported skills, agents, rules, or instruction files were found.");
    return;
  }
  const selection = await ensureVersionSelection(apiClient, stateStore);
  if (!selection?.versionId) {
    void vscode10.window.showWarningMessage(
      "Import canceled because no import target was chosen."
    );
    return;
  }
  const uploadResult = await uploadWorkspaceFiles(apiClient, selection.versionId, files);
  const result = await apiClient.importVersion(selection.versionId);
  const imported = asImportedCounts(result.imported);
  const warnings = result.warnings ?? [];
  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title,
    status: result.job.status,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const completed = await waitForTransformJob(apiClient, result.job.id);
  await stateStore.setLastImport({
    jobId: result.job.id,
    versionId: selection.versionId,
    status: completed.status,
    completedAt: (/* @__PURE__ */ new Date()).toISOString(),
    imported,
    warnings,
    uploadedPaths: uploadResult.files.map((file) => file.logicalPath)
  });
  const warningSuffix = warnings.length > 0 ? ` Warning: ${warnings[0]}` : "";
  void vscode10.window.showInformationMessage(
    `Imported ${imported.rawFiles || files.length} files, ${imported.skills} skills, ${imported.subagents} agents, ${imported.rules} rules. Status: ${completed.status}.${warningSuffix}`
  );
}
async function importWorkspaceCommand(apiClient, stateStore, jobsView) {
  const files = await scanWorkspaceFiles(vscode10.workspace.getConfiguration("xupra"));
  return importFiles(apiClient, stateStore, jobsView, files, "Workspace import");
}
async function importDefaultLocationsCommand(apiClient, stateStore, jobsView) {
  const files = await scanDefaultLocationFiles();
  return importFiles(apiClient, stateStore, jobsView, files, "Default locations import");
}
async function importFolderCommand(apiClient, stateStore, jobsView) {
  const picked = await vscode10.window.showOpenDialog({
    title: "Choose Folder To Import Skills And Agents From",
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Import From Folder"
  });
  const folder = picked?.[0];
  if (!folder) {
    return;
  }
  const files = await scanSelectedFolderFiles(folder);
  return importFiles(apiClient, stateStore, jobsView, files, "Folder import");
}

// src/commands/openWebApp.ts
var vscode11 = __toESM(require("vscode"));
async function openWebAppCommand(apiClient) {
  await vscode11.env.openExternal(apiClient.openWebUrl("/app"));
}

// src/commands/pullPackage.ts
var vscode12 = __toESM(require("vscode"));
async function pullPackageCommand(apiClient, configuration, stateStore) {
  const selection = await ensureVersionSelection(apiClient, stateStore);
  if (!selection?.versionId) {
    return;
  }
  const picked = await chooseTargetPlatform(configuration, "Select export target to pull into the workspace");
  if (!picked) {
    return;
  }
  const result = await apiClient.listGeneratedExports(selection.versionId, picked.value, true);
  if (result.generatedFiles.length === 0) {
    void vscode12.window.showWarningMessage(`No generated files are available for ${picked.label}.`);
    return;
  }
  const writtenCount = await writeGeneratedFilesToWorkspace(result.generatedFiles, {
    confirmBeforeWrite: configuration.get("confirmBeforeWriteback", true)
  });
  void vscode12.window.showInformationMessage(`Pulled ${writtenCount} ${picked.label} files into the workspace.`);
}

// src/commands/refreshProjects.ts
async function refreshProjectsCommand(apiClient) {
  const result = await apiClient.listProjects();
  return result.projects;
}

// src/commands/runbooks.ts
var vscode17 = __toESM(require("vscode"));

// src/ai/prompts/buildDraftRunbookPrompt.ts
function buildDraftRunbookPrompt(input) {
  return [
    "You are generating a DryLake .xu runbook.",
    "Return only YAML. Do not wrap it in Markdown fences.",
    "",
    "Required YAML contract:",
    "xu: 1",
    "kind: ApplicationBuildRunbook",
    "metadata.name: kebab-case project name",
    "metadata.status: draft",
    "intent.rawPrompt, intent.purpose, intent.users, intent.goals, intent.nonGoals, intent.constraints",
    "confirmation.required: true",
    "confirmation.status: pending",
    "confirmation.userApprovedIntent: false",
    "confirmation.userApprovedArchitecture: false",
    "confirmation.userApprovedProvisioning: false",
    "architecture.status: proposed",
    "architecture.summary, architecture.decisions, architecture.risks, architecture.assumptions",
    "provisioning.status: draft",
    "provisioning.commands, provisioning.filesToCreate, provisioning.environmentVariables, provisioning.externalServices",
    "provisioning.safety.requiresApprovalBeforeExecution: true",
    "provisioning.safety.executeAutomatically: false",
    "phases: at least five phases with id, title, optional agent, gate, status, objective, inputs, outputs, steps, acceptance",
    "phase.agent optional enum: claude-code, codex, cursor, copilot, external-ai-prompt",
    "",
    `Mode: ${input.mode}`,
    "",
    "User prompt:",
    input.prompt,
    "",
    "Workspace summary:",
    input.workspaceSummary || "No workspace summary available."
  ].join("\n");
}

// src/ai/prompts/generatePhasePlanPrompt.ts
function generatePhasePlanPrompt(input) {
  return `${buildDraftRunbookPrompt(input)}

Focus this revision on phase-by-phase execution planning and acceptance criteria.`;
}

// src/ai/prompts/refineArchitecturePrompt.ts
function refineArchitecturePrompt(input) {
  return `${buildDraftRunbookPrompt(input)}

Focus this revision on architecture summary, decisions, risks, assumptions, and provisioning preview.`;
}

// src/ai/prompts/refinePurposePrompt.ts
function refinePurposePrompt(input) {
  return `${buildDraftRunbookPrompt(input)}

Focus this revision on purpose, users, goals, non-goals, and constraints.`;
}

// src/ai/providers/clipboardProvider.ts
var ClipboardProvider = class {
  id = "external-ai-prompt";
  label = "External AI Prompt";
  async isAvailable() {
    return { available: true };
  }
  async generateDraftRunbook(input) {
    return {
      promptForExternalAi: buildDraftRunbookPrompt(input),
      message: "DryLake created a local draft runbook. The external prompt is optional if you want an AI-refined draft."
    };
  }
  async refinePurpose(input) {
    return {
      promptForExternalAi: refinePurposePrompt(input),
      message: "Copy this purpose refinement prompt into an external AI tool."
    };
  }
  async refineArchitecture(input) {
    return {
      promptForExternalAi: refineArchitecturePrompt(input),
      message: "Copy this architecture refinement prompt into an external AI tool."
    };
  }
  async generatePhasePlan(input) {
    return {
      promptForExternalAi: generatePhasePlanPrompt(input),
      message: "Copy this phase planning prompt into an external AI tool."
    };
  }
};

// src/ai/providers/vscodeLmProvider.ts
var vscode13 = __toESM(require("vscode"));

// node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer) return null;
  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== "number") options.indent = 1;
  if (typeof options.linesBefore !== "number") options.linesBefore = 3;
  if (typeof options.linesAfter !== "number") options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result = Object.create(Schema$1.prototype);
  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);
  result.compiledImplicit = compileList(result, "implicit");
  result.compiledExplicit = compileList(result, "explicit");
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
  return result;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode(
    (c - 65536 >> 10) + 55296,
    (c - 65536 & 1023) + 56320
  );
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
var i;
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  })();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = (function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += "\n";
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 65536) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var Type = type;
var Schema = schema;
var FAILSAFE_SCHEMA = failsafe;
var JSON_SCHEMA = json;
var CORE_SCHEMA = core;
var DEFAULT_SCHEMA = _default;
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var YAMLException = exception;
var types = {
  binary,
  float,
  map,
  null: _null,
  pairs,
  set,
  timestamp,
  bool,
  int,
  merge,
  omap,
  seq,
  str
};
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");
var jsYaml = {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
};

// src/xu/createStarterXu.ts
function toSteps(phaseId, items) {
  return items.map((text, index) => ({
    id: `${phaseId}-step-${String(index + 1).padStart(2, "0")}`,
    text,
    status: "pending"
  }));
}
function slugifyName(prompt) {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "drylake-runbook";
}
function createStarterXu(params = {}) {
  const prompt = params.prompt?.trim() ?? "";
  const mode = params.mode ?? "build-app";
  return {
    xu: 1,
    kind: "ApplicationBuildRunbook",
    metadata: {
      name: params.name?.trim() || slugifyName(prompt) || "drylake-runbook",
      owner: "local",
      status: "draft",
      mode
    },
    intent: {
      rawPrompt: prompt,
      purpose: "",
      users: [],
      goals: [],
      nonGoals: [],
      constraints: []
    },
    confirmation: {
      required: true,
      status: "pending",
      userApprovedIntent: false,
      userApprovedArchitecture: false,
      userApprovedProvisioning: false
    },
    architecture: {
      status: "proposed",
      summary: "",
      decisions: [],
      risks: [],
      assumptions: []
    },
    provisioning: {
      status: "draft",
      commands: [],
      filesToCreate: [],
      environmentVariables: [],
      externalServices: [],
      safety: {
        requiresApprovalBeforeExecution: true,
        executeAutomatically: false
      }
    },
    phases: [
      {
        id: "01-intake",
        title: "Confirm application purpose",
        gate: "user-confirmation",
        status: "pending",
        objective: "Confirm what the user wants built.",
        inputs: ["user prompt"],
        outputs: ["confirmed purpose", "goals", "non-goals", "constraints"],
        steps: toSteps("01-intake", [
          "Parse the user prompt.",
          "Identify the application purpose.",
          "Identify target users.",
          "Identify non-goals and constraints.",
          "Ask the user to confirm before architecture work starts."
        ]),
        acceptance: [
          "Purpose is confirmed.",
          "Goals and non-goals are explicit.",
          "Constraints are recorded."
        ]
      },
      {
        id: "02-architecture",
        title: "Approve architecture",
        gate: "architecture-approval",
        status: "pending",
        objective: "Agree on technical architecture before implementation.",
        inputs: [],
        outputs: [],
        steps: toSteps("02-architecture", [
          "Propose architecture.",
          "List major dependencies.",
          "List data model assumptions.",
          "List deployment assumptions.",
          "Ask the user to approve or revise."
        ]),
        acceptance: [
          "Architecture is approved.",
          "Risks and assumptions are documented."
        ]
      },
      {
        id: "03-provisioning",
        title: "Preview provisioning",
        gate: "provisioning-approval",
        status: "pending",
        objective: "Preview project setup, commands, files, and environment requirements.",
        inputs: [],
        outputs: [],
        steps: toSteps("03-provisioning", [
          "Generate setup commands.",
          "Generate file creation plan.",
          "Generate environment variable list.",
          "Require approval before running or handing off commands."
        ]),
        acceptance: [
          "Provisioning plan is approved.",
          "No command executes without user confirmation."
        ]
      },
      {
        id: "04-implementation",
        title: "Implement in vertical slices",
        gate: "phase-review",
        status: "pending",
        objective: "Build the application step by step.",
        inputs: [],
        outputs: [],
        steps: toSteps("04-implementation", [
          "Implement one thin vertical slice.",
          "Avoid unrelated refactors.",
          "Keep changes reversible.",
          "Verify each phase before continuing."
        ]),
        acceptance: [
          "Changed files are summarized.",
          "Checks pass or failures are explained."
        ]
      },
      {
        id: "05-verification",
        title: "Verify and hand off",
        gate: "final-review",
        status: "pending",
        objective: "Validate implementation and produce final handoff.",
        inputs: [],
        outputs: [],
        steps: toSteps("05-verification", [
          "Run build.",
          "Run tests.",
          "Run lint.",
          "Summarize changed files.",
          "Summarize remaining risks."
        ]),
        acceptance: [
          "Verification is complete.",
          "Handoff notes are generated."
        ]
      }
    ],
    checks: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      lint: "npm run lint"
    },
    agentTargets: {
      agentsMd: true,
      claudeMd: true,
      copilotInstructions: true,
      cursorRules: true,
      codexSkill: true,
      openclawSkill: true
    },
    handoff: {
      defaultAgent: "claude-code",
      instructions: [
        "Follow phases in order.",
        "Do not skip approval gates.",
        "Do not provision infrastructure without explicit confirmation.",
        "Always summarize changed files and verification results."
      ]
    }
  };
}

// src/xu/types.ts
var XU_PHASE_AGENTS = [
  "claude-code",
  "codex",
  "cursor",
  "cline",
  "continue",
  "aider",
  "windsurf",
  "copilot",
  "roo-code",
  "augment-code",
  "external-ai-prompt"
];

// src/xu/normalizeXu.ts
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter((item) => item.trim().length > 0) : [];
}
function asStepStatus(value) {
  return value === "active" || value === "approved" || value === "needs-revision" || value === "complete" ? value : "pending";
}
function asSteps(value, phaseId) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    const fallbackId = `${phaseId}-step-${String(index + 1).padStart(2, "0")}`;
    if (typeof item === "string") {
      const text = item.trim();
      return text.length === 0 ? null : { id: fallbackId, text, status: "pending" };
    }
    if (item && typeof item === "object") {
      const record = item;
      const text = asString(record.text).trim();
      if (text.length === 0) {
        return null;
      }
      return {
        id: asString(record.id, fallbackId) || fallbackId,
        text,
        status: asStepStatus(record.status)
      };
    }
    return null;
  }).filter((step) => step !== null);
}
function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function asPhaseAgent(value) {
  return typeof value === "string" && XU_PHASE_AGENTS.includes(value) ? value : void 0;
}
function normalizePhase(value, index) {
  const phase = asRecord(value);
  const id = asString(phase.id, `phase-${String(index + 1).padStart(2, "0")}`);
  return {
    id,
    title: asString(phase.title, id),
    agent: asPhaseAgent(phase.agent),
    gate: asString(phase.gate, "phase-review"),
    status: phase.status === "active" || phase.status === "approved" || phase.status === "needs-revision" || phase.status === "complete" ? phase.status : "pending",
    objective: asString(phase.objective),
    inputs: asStringArray(phase.inputs),
    outputs: asStringArray(phase.outputs),
    steps: asSteps(phase.steps, id),
    acceptance: asStringArray(phase.acceptance)
  };
}
function normalizeXu(value) {
  const starter = createStarterXu();
  const root = asRecord(value);
  const metadata = asRecord(root.metadata);
  const intent = asRecord(root.intent);
  const confirmation = asRecord(root.confirmation);
  const architecture = asRecord(root.architecture);
  const provisioning = asRecord(root.provisioning);
  const safety = asRecord(provisioning.safety);
  const checks = asRecord(root.checks);
  const agentTargets = asRecord(root.agentTargets);
  const handoff = asRecord(root.handoff);
  return {
    xu: 1,
    kind: "ApplicationBuildRunbook",
    metadata: {
      name: asString(metadata.name, starter.metadata.name),
      owner: asString(metadata.owner, starter.metadata.owner),
      status: metadata.status === "approved" || metadata.status === "in-progress" || metadata.status === "complete" ? metadata.status : "draft",
      mode: metadata.mode === "phases" || metadata.mode === "plan" || metadata.mode === "review" || metadata.mode === "build-app" ? metadata.mode : starter.metadata.mode
    },
    intent: {
      rawPrompt: asString(intent.rawPrompt),
      purpose: asString(intent.purpose),
      users: asStringArray(intent.users),
      goals: asStringArray(intent.goals),
      nonGoals: asStringArray(intent.nonGoals),
      constraints: asStringArray(intent.constraints)
    },
    confirmation: {
      required: asBoolean(confirmation.required, true),
      status: confirmation.status === "approved" || confirmation.status === "needs-revision" ? confirmation.status : "pending",
      userApprovedIntent: asBoolean(confirmation.userApprovedIntent, false),
      userApprovedArchitecture: asBoolean(confirmation.userApprovedArchitecture, false),
      userApprovedProvisioning: asBoolean(confirmation.userApprovedProvisioning, false)
    },
    architecture: {
      status: architecture.status === "draft" || architecture.status === "approved" || architecture.status === "needs-revision" ? architecture.status : "proposed",
      summary: asString(architecture.summary),
      decisions: Array.isArray(architecture.decisions) ? architecture.decisions.map((item, index) => {
        const decision = asRecord(item);
        return {
          id: asString(decision.id, `decision-${index + 1}`),
          choice: asString(decision.choice),
          rationale: asString(decision.rationale)
        };
      }) : [],
      risks: asStringArray(architecture.risks),
      assumptions: asStringArray(architecture.assumptions)
    },
    provisioning: {
      status: provisioning.status === "proposed" || provisioning.status === "approved" ? provisioning.status : "draft",
      commands: asStringArray(provisioning.commands),
      filesToCreate: asStringArray(provisioning.filesToCreate),
      environmentVariables: asStringArray(provisioning.environmentVariables),
      externalServices: asStringArray(provisioning.externalServices),
      safety: {
        requiresApprovalBeforeExecution: asBoolean(safety.requiresApprovalBeforeExecution, true),
        executeAutomatically: false
      }
    },
    phases: Array.isArray(root.phases) && root.phases.length > 0 ? root.phases.map(normalizePhase) : starter.phases,
    checks: {
      install: asString(checks.install, starter.checks.install),
      dev: asString(checks.dev, starter.checks.dev),
      build: asString(checks.build, starter.checks.build),
      test: asString(checks.test, starter.checks.test),
      lint: asString(checks.lint, starter.checks.lint)
    },
    agentTargets: {
      agentsMd: asBoolean(agentTargets.agentsMd, true),
      claudeMd: asBoolean(agentTargets.claudeMd, true),
      copilotInstructions: asBoolean(agentTargets.copilotInstructions, true),
      cursorRules: asBoolean(agentTargets.cursorRules, true),
      codexSkill: asBoolean(agentTargets.codexSkill, true),
      openclawSkill: asBoolean(agentTargets.openclawSkill, true)
    },
    handoff: {
      defaultAgent: asString(handoff.defaultAgent, starter.handoff.defaultAgent),
      instructions: asStringArray(handoff.instructions).length > 0 ? asStringArray(handoff.instructions) : starter.handoff.instructions
    }
  };
}

// src/xu/validateXu.ts
function requireString(diagnostics, path8, value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    diagnostics.push({ path: path8, message });
  }
}
function requireArray(diagnostics, path8, value, message) {
  if (!Array.isArray(value) || value.length === 0) {
    diagnostics.push({ path: path8, message });
  }
}
function validateXu(runbook) {
  const diagnostics = [];
  if (runbook.xu !== 1) {
    diagnostics.push({ path: "xu", message: "Runbook must declare xu: 1." });
  }
  if (runbook.kind !== "ApplicationBuildRunbook") {
    diagnostics.push({
      path: "kind",
      message: "Runbook kind must be ApplicationBuildRunbook."
    });
  }
  requireString(diagnostics, "metadata.name", runbook.metadata.name, "Runbook must have metadata.name.");
  requireString(diagnostics, "intent.purpose", runbook.intent.purpose, "Runbook must have intent.purpose.");
  requireArray(diagnostics, "phases", runbook.phases, "Runbook must include at least one phase.");
  runbook.phases.forEach((phase, index) => {
    const prefix = `phases[${index}]`;
    requireString(diagnostics, `${prefix}.id`, phase.id, "Each phase must have an id.");
    requireString(diagnostics, `${prefix}.title`, phase.title, "Each phase must have a title.");
    requireArray(diagnostics, `${prefix}.steps`, phase.steps, "Each phase must include steps.");
    requireArray(diagnostics, `${prefix}.acceptance`, phase.acceptance, "Each phase must include acceptance criteria.");
  });
  if (!runbook.provisioning.safety.requiresApprovalBeforeExecution) {
    diagnostics.push({
      path: "provisioning.safety.requiresApprovalBeforeExecution",
      message: "Provisioning must require approval before execution."
    });
  }
  if (runbook.provisioning.safety.executeAutomatically) {
    diagnostics.push({
      path: "provisioning.safety.executeAutomatically",
      message: "DryLake v1 must not execute provisioning automatically."
    });
  }
  return {
    ok: diagnostics.length === 0,
    diagnostics
  };
}

// src/xu/parseXu.ts
function parseXu(content) {
  try {
    const parsed = jsYaml.load(content);
    const runbook = normalizeXu(parsed);
    return {
      runbook,
      validation: validateXu(runbook)
    };
  } catch (error) {
    return {
      runbook: null,
      validation: {
        ok: false,
        diagnostics: [
          {
            path: "$",
            message: error instanceof Error ? error.message : "Invalid .xu syntax."
          }
        ]
      }
    };
  }
}

// src/ai/parseAiRunbookResponse.ts
function stripFence(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:yaml|yml|xu)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}
function parseAiRunbookResponse(value) {
  return parseXu(stripFence(value));
}

// src/ai/providers/vscodeLmProvider.ts
async function readResponseText(response) {
  const parts = [];
  for await (const chunk of response.text) {
    parts.push(chunk);
  }
  return parts.join("");
}
var VscodeLmProvider = class {
  id = "user-ide-ai";
  label = "User IDE AI";
  async isAvailable() {
    try {
      const models = await vscode13.lm.selectChatModels();
      return models.length > 0 ? { available: true } : { available: false, reason: "No editor AI model is available." };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "User IDE AI is unavailable."
      };
    }
  }
  async runPrompt(prompt) {
    const models = await vscode13.lm.selectChatModels();
    const model = models[0];
    if (!model) {
      return { message: "User IDE AI is not available." };
    }
    const response = await model.sendRequest([
      vscode13.LanguageModelChatMessage.User(prompt)
    ]);
    const text = await readResponseText(response);
    const parsed = parseAiRunbookResponse(text);
    if (!parsed.runbook || !parsed.validation.ok) {
      return {
        message: `User IDE AI returned invalid .xu: ${parsed.validation.diagnostics.map((item) => item.message).join("; ")}`
      };
    }
    return { runbook: parsed.runbook };
  }
  generateDraftRunbook(input) {
    return this.runPrompt(buildDraftRunbookPrompt(input));
  }
  refinePurpose(input) {
    return this.runPrompt(refinePurposePrompt(input));
  }
  refineArchitecture(input) {
    return this.runPrompt(refineArchitecturePrompt(input));
  }
  generatePhasePlan(input) {
    return this.runPrompt(generatePhasePlanPrompt(input));
  }
  async clarifyIntent(input) {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }
    const models = await vscode13.lm.selectChatModels();
    const model = models[0];
    if (!model) {
      return { message: "User IDE AI is not available." };
    }
    const prompt = [
      "You help scope a DryLake build session.",
      "Return between 2 and 4 short clarifying questions about the user's prompt.",
      "Return ONLY a JSON array of strings. No prose, no Markdown fences.",
      "",
      `Mode: ${input.mode}`,
      "",
      "User prompt:",
      input.prompt,
      "",
      "Workspace summary:",
      input.workspaceSummary || "No workspace summary available."
    ].join("\n");
    try {
      const response = await model.sendRequest([vscode13.LanguageModelChatMessage.User(prompt)]);
      const raw = await readResponseText(response);
      const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      let questions = [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          questions = parsed.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 4);
        }
      } catch {
        questions = trimmed.split(/\r?\n/).map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim()).filter((line) => line.length > 0).slice(0, 4);
      }
      return { questions };
    } catch (error) {
      return {
        message: error instanceof Error ? `User IDE AI clarify request failed: ${error.message}` : "User IDE AI clarify request failed."
      };
    }
  }
};

// src/services/apiClient.ts
var vscode14 = __toESM(require("vscode"));
var LEGACY_HOSTS = /* @__PURE__ */ new Set(["52.196.86.96"]);
var DEFAULT_BASE_URL = "https://drylake.xupracorp.com";
function normalizeBaseUrl(rawValue) {
  const trimmed = rawValue.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }
  try {
    const parsed = new URL(trimmed);
    if (LEGACY_HOSTS.has(parsed.hostname)) {
      return DEFAULT_BASE_URL;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}
var ApiClient = class {
  constructor(configuration) {
    this.configuration = configuration;
  }
  accessToken;
  get baseUrl() {
    return normalizeBaseUrl(String(this.configuration.get("baseUrl", DEFAULT_BASE_URL)));
  }
  openWebUrl(pathname = "/app") {
    return vscode14.Uri.parse(`${this.baseUrl}${pathname}`);
  }
  setAccessToken(token) {
    this.accessToken = token;
  }
  async request(pathname, init) {
    const headers = new Headers(init?.headers);
    if (this.accessToken) {
      headers.set("x-xupra-extension-token", this.accessToken);
    }
    const requestUrl = `${this.baseUrl}${pathname}`;
    let response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        headers
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Network request failed for ${pathname}. Check xupra.baseUrl (currently ${this.baseUrl}). ${message}`
      );
    }
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error?.message ?? `Request failed for ${pathname}`);
    }
    return payload;
  }
  async connect(email, displayName, accessToken) {
    return this.request(
      "/api/v1/extension/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...email ? { email } : {},
          ...displayName ? { displayName } : {},
          ...accessToken ? { accessToken } : {},
          editor: "vscode"
        })
      }
    );
  }
  async exchangeBrowserConnectCode(code) {
    return this.request("/api/v1/extension/connect/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
  }
  async startBrowserConnect(editor) {
    return this.request("/api/v1/extension/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor })
    });
  }
  async pollBrowserConnect(requestId, pollToken) {
    return this.request(`/api/v1/extension/connect/poll?requestId=${encodeURIComponent(requestId)}`, {
      headers: {
        "x-xupra-connect-poll-token": pollToken
      }
    });
  }
  async getAuthSession() {
    return this.request("/api/v1/auth/session");
  }
  async listProjects() {
    return this.request("/api/v1/projects");
  }
  async getProject(projectId) {
    return this.request(`/api/v1/projects/${projectId}`);
  }
  async getVersion(versionId) {
    return this.request(`/api/v1/versions/${versionId}`);
  }
  async uploadFiles(versionId, files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("paths", file.logicalPath);
      formData.append("files", new Blob([file.content], { type: "text/plain" }), file.logicalPath);
    }
    return this.request(`/api/v1/versions/${versionId}/files`, {
      method: "POST",
      body: formData
    });
  }
  async importVersion(versionId) {
    return this.request(
      `/api/v1/versions/${versionId}/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" })
      }
    );
  }
  async checkCompatibility(versionId, targetPlatform) {
    return this.request(
      `/api/v1/versions/${versionId}/compatibility`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlatform })
      }
    );
  }
  async exportPreview(versionId, targetPlatform) {
    return this.request(
      `/api/v1/versions/${versionId}/export-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlatform })
      }
    );
  }
  async fetchVersionFile(versionId, logicalPath) {
    const search = new URLSearchParams({ logicalPath });
    return this.request(`/api/v1/extension/versions/${versionId}/file?${search.toString()}`);
  }
  async listGeneratedExports(versionId, targetPlatform, ensureGenerated = false) {
    const params = new URLSearchParams();
    params.set("targetPlatform", targetPlatform);
    if (ensureGenerated) {
      params.set("ensureGenerated", "true");
    }
    const payload = await this.request(`/api/v1/versions/${versionId}/exports?${params.toString()}`);
    return {
      generatedFiles: payload.generatedFiles ?? []
    };
  }
  async listDeploymentTargets(projectId) {
    return this.request(
      `/api/v1/projects/${projectId}/deployment-targets`
    );
  }
  async deploy(versionId, deploymentTargetId) {
    return this.request(`/api/v1/versions/${versionId}/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deploymentTargetId, triggerSource: "ui" })
    });
  }
  async getDeploymentJob(jobId) {
    return this.request(
      `/api/v1/deployment-jobs/${jobId}`
    );
  }
  async getTransformJob(jobId) {
    return this.request(`/api/v1/transform-jobs/${jobId}`);
  }
  async getSkillsMarketplace(pathname) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return this.request(`/api/v1/skills-marketplace${normalizedPath}`);
  }
  async generateSkill(params) {
    return this.request("/api/v1/skills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
  }
  async generateAgent(params) {
    return this.request("/api/v1/agents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
  }
  async optimizeAgent(params) {
    return this.request("/api/v1/agents/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
  }
};

// src/ai/providers/xupraCloudProvider.ts
function resolveBaseUrl(configuration, backendConfiguration) {
  const override = String(configuration.get("apiBaseUrl", "")).trim();
  if (override) {
    return normalizeBaseUrl(override);
  }
  return normalizeBaseUrl(String(backendConfiguration.get("baseUrl", DEFAULT_BASE_URL)));
}
var XupraCloudProvider = class {
  constructor(configuration, readConnection, readAccessToken, backendConfiguration = configuration) {
    this.configuration = configuration;
    this.readConnection = readConnection;
    this.readAccessToken = readAccessToken;
    this.backendConfiguration = backendConfiguration;
  }
  id = "xupra-pro-ai";
  label = "Xupra Pro AI";
  async isAvailable() {
    const connection = this.readConnection();
    const hasXupraProAi = Boolean(connection.entitlements?.xupra_pro_ai);
    if (!connection.userEmail || !hasXupraProAi) {
      return { available: false, reason: "Connect a Xupra account with Xupra Pro AI access to use this provider." };
    }
    return { available: true };
  }
  async post(endpoint, input) {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }
    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...token ? { "x-xupra-extension-token": token } : {}
        },
        body: JSON.stringify(input)
      });
      const text = await response.text();
      let content = text;
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = void 0;
      }
      if (!response.ok) {
        return {
          message: typeof payload?.error?.message === "string" ? payload.error.message : `Xupra Pro AI request failed (${response.status}).`
        };
      }
      if (payload) {
        content = typeof payload.content === "string" ? payload.content : typeof payload.yaml === "string" ? payload.yaml : JSON.stringify(payload.runbook ?? payload);
      }
      const parsed = parseAiRunbookResponse(content);
      if (!parsed.runbook || !parsed.validation.ok) {
        return {
          message: `Xupra Pro AI returned invalid .xu: ${parsed.validation.diagnostics.map((item) => item.message).join("; ")}`
        };
      }
      return { runbook: parsed.runbook };
    } catch (error) {
      return {
        message: error instanceof Error ? `Xupra Pro AI request failed: ${error.message}` : "Xupra Pro AI request failed."
      };
    }
  }
  generateDraftRunbook(input) {
    return this.post("/api/v1/drylake/runbooks/draft", input);
  }
  refinePurpose(input) {
    return this.post("/api/v1/drylake/runbooks/refine-purpose", input);
  }
  refineArchitecture(input) {
    return this.post("/api/v1/drylake/runbooks/refine-architecture", input);
  }
  generatePhasePlan(input) {
    return this.post("/api/v1/drylake/runbooks/generate-phases", input);
  }
  async clarifyIntent(input) {
    const availability = await this.isAvailable();
    if (!availability.available) {
      return { message: availability.reason };
    }
    const baseUrl = resolveBaseUrl(this.configuration, this.backendConfiguration);
    const token = await this.readAccessToken();
    try {
      const response = await fetch(`${baseUrl}/api/v1/drylake/runbooks/clarify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...token ? { "x-xupra-extension-token": token } : {}
        },
        body: JSON.stringify(input)
      });
      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = void 0;
      }
      if (!response.ok) {
        return {
          message: typeof payload?.error?.message === "string" ? payload.error.message : `Xupra Pro AI clarify request failed (${response.status}).`
        };
      }
      const questions = Array.isArray(payload?.questions) ? payload.questions.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
      return { questions };
    } catch (error) {
      return {
        message: error instanceof Error ? `Xupra Pro AI clarify request failed: ${error.message}` : "Xupra Pro AI clarify request failed."
      };
    }
  }
};

// src/ai/providerResolver.ts
async function resolveDryLakeAiProvider(params) {
  const configured = String(params.configuration.get("aiProvider", "auto"));
  const providers = {
    "xupra-pro-ai": new XupraCloudProvider(
      params.configuration,
      params.readConnection,
      params.readAccessToken,
      params.backendConfiguration
    ),
    "user-ide-ai": new VscodeLmProvider(),
    "external-ai-prompt": new ClipboardProvider()
  };
  if (configured !== "auto") {
    return { provider: providers[configured] ?? providers["external-ai-prompt"] };
  }
  const fallbackReasons = [];
  for (const candidate of [providers["xupra-pro-ai"], providers["user-ide-ai"]]) {
    const availability = await candidate.isAvailable();
    if (availability.available) {
      return {
        provider: candidate,
        reason: fallbackReasons.length > 0 ? fallbackReasons.join(" ") : void 0
      };
    }
    if (availability.reason) {
      fallbackReasons.push(`${candidate.label}: ${availability.reason}`);
    } else {
      fallbackReasons.push(`${candidate.label} unavailable.`);
    }
  }
  return {
    provider: providers["external-ai-prompt"],
    reason: fallbackReasons.length > 0 ? fallbackReasons.join(" ") : void 0
  };
}

// src/generators/common.ts
var GENERATED_HEADER = [
  "Generated by Xupra DryLake.",
  "Source: drylake.xu.",
  "Do not edit this generated file directly unless you intend to diverge from the approved runbook.",
  ""
].join("\n");
function bulletList(items) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}
function numberedList(items) {
  return items.length > 0 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. No steps recorded.";
}
function renderRunbookSummary(runbook) {
  return [
    `# ${runbook.metadata.name}`,
    "",
    `Purpose: ${runbook.intent.purpose || "Not confirmed yet."}`,
    "",
    "## Goals",
    bulletList(runbook.intent.goals),
    "",
    "## Non-Goals",
    bulletList(runbook.intent.nonGoals),
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Architecture",
    runbook.architecture.summary || "No architecture summary yet."
  ].join("\n");
}
function renderPhaseSection(phase) {
  return [
    `## ${phase.id}: ${phase.title}`,
    "",
    `Gate: ${phase.gate}`,
    "",
    "Objective:",
    phase.objective || "No objective recorded.",
    "",
    "Steps:",
    numberedList(phase.steps.map((step) => step.text)),
    "",
    "Acceptance:",
    bulletList(phase.acceptance)
  ].join("\n");
}

// src/generators/renderAgentsMd.ts
function renderAgentsMd(runbook) {
  return [
    GENERATED_HEADER,
    "# Agent Instructions",
    "",
    "Follow the approved DryLake runbook in `drylake.xu`.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Review drylake.xu for the current purpose.",
    "",
    "## Goals",
    bulletList(runbook.intent.goals),
    "",
    "## Non-Goals",
    bulletList(runbook.intent.nonGoals),
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Execution Rules",
    bulletList(runbook.handoff.instructions)
  ].join("\n");
}

// src/generators/renderClaudeMd.ts
function renderClaudeMd(runbook) {
  return [
    GENERATED_HEADER,
    "# Claude Code Instructions",
    "",
    "Use `drylake.xu` as the source of truth for this work.",
    "",
    "## Approved Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Handoff",
    bulletList(runbook.handoff.instructions)
  ].join("\n");
}

// src/generators/renderCodexSkill.ts
function renderCodexSkill(runbook) {
  return [
    GENERATED_HEADER,
    "# DryLake Execution Skill",
    "",
    "name: drylake-execution",
    "description: Execute the approved DryLake runbook phase by phase.",
    "",
    "Use this skill when executing a DryLake Agent Runbook.",
    "",
    "## Source",
    "Read `drylake.xu` before making changes.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Required Behavior",
    bulletList(runbook.handoff.instructions)
  ].join("\n");
}

// src/generators/renderCopilotInstructions.ts
function renderCopilotInstructions(runbook) {
  return [
    GENERATED_HEADER,
    "# GitHub Copilot Instructions",
    "",
    "Follow `drylake.xu` and the current phase prompt under `.drylake/generated/`.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Do Not",
    bulletList(runbook.intent.nonGoals)
  ].join("\n");
}

// src/generators/renderCursorRules.ts
function renderCursorRules(runbook) {
  return [
    GENERATED_HEADER,
    "# Cursor Rules",
    "",
    "description: DryLake execution runbook",
    "globs: **/*",
    "alwaysApply: true",
    "",
    "Use `drylake.xu` as the source of truth.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose approval is still pending.",
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture approval is still pending.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints)
  ].join("\n");
}

// src/generators/renderPhasePrompt.ts
var AGENT_PREAMBLES = {
  "claude-code": "You are running as Claude Code. Use the bash tool for file operations.",
  codex: "You are running as Codex CLI. Output shell commands and file patches.",
  cursor: "You are running inside Cursor. Use the Composer for multi-file edits.",
  cline: "You are running inside Cline. Use the focused phase objective, steps, and acceptance criteria to make safe workspace edits.",
  continue: "You are running inside Continue.dev. Use the focused phase objective, steps, and acceptance criteria to guide the chat or edit session.",
  aider: "You are running as Aider. Use the focused phase objective, steps, and acceptance criteria to plan patches before editing files.",
  windsurf: "You are running inside Windsurf. Use the Cascade workflow for multi-file edits and keep the phase acceptance criteria in view.",
  copilot: "You are running as GitHub Copilot. Use inline suggestions and chat.",
  "roo-code": "You are running inside Roo Code. Use the focused phase objective, steps, and acceptance criteria to execute this phase.",
  "augment-code": "You are running inside Augment Code. Use the focused phase objective, steps, and acceptance criteria to make repo-aware edits.",
  "external-ai-prompt": "Copy this prompt into your preferred AI tool."
};
var PROVIDER_PREAMBLES = {
  "xupra-pro-ai": "Use the active DryLake build-session provider: Xupra Pro AI.",
  "user-ide-ai": "Use the active DryLake build-session provider: User IDE AI.",
  "external-ai-prompt": "Copy this prompt into your preferred AI tool."
};
function normalizeAgent(value) {
  return typeof value === "string" && XU_PHASE_AGENTS.includes(value) ? value : void 0;
}
function providerPreamble(activeProvider) {
  if (!activeProvider) {
    return void 0;
  }
  return PROVIDER_PREAMBLES[activeProvider.providerId] ?? `Use the active DryLake build-session provider: ${activeProvider.providerLabel}.`;
}
function agentPreamble(runbook, phase, options) {
  const agent = phase.agent;
  if (agent) {
    return AGENT_PREAMBLES[agent];
  }
  const activeProviderPreamble = providerPreamble(options.activeProvider);
  if (activeProviderPreamble) {
    return activeProviderPreamble;
  }
  const defaultAgent2 = normalizeAgent(runbook.handoff.defaultAgent);
  if (defaultAgent2) {
    return AGENT_PREAMBLES[defaultAgent2];
  }
  return `Use the configured DryLake AI provider: ${runbook.handoff.defaultAgent || "session default"}.`;
}
function renderPhasePrompt(runbook, phase, options = {}) {
  return [
    GENERATED_HEADER,
    `# Execute ${phase.id}: ${phase.title}`,
    "",
    agentPreamble(runbook, phase, options),
    "",
    `You are executing phase ${phase.id} from drylake.xu.`,
    "",
    "Do not skip approval gates.",
    "Do not modify files unless this phase requires it.",
    "Use the approved purpose, architecture, and constraints below.",
    "",
    "## Purpose",
    runbook.intent.purpose || "Purpose has not been confirmed.",
    "",
    "## Constraints",
    bulletList(runbook.intent.constraints),
    "",
    "## Architecture",
    runbook.architecture.summary || "Architecture has not been approved.",
    "",
    "## Phase Objective",
    phase.objective || "No objective recorded.",
    "",
    "## Steps",
    numberedList(phase.steps.map((step) => step.text)),
    "",
    "## Acceptance Criteria",
    bulletList(phase.acceptance),
    "",
    "Return:",
    "1. proposed changes",
    "2. affected files",
    "3. risks",
    "4. verification plan"
  ].join("\n");
}

// src/generators/renderRunbookMd.ts
function renderRunbookMd(runbook) {
  return [
    GENERATED_HEADER,
    renderRunbookSummary(runbook),
    "",
    "# Phases",
    "",
    ...runbook.phases.map(renderPhaseSection),
    "",
    "# Provisioning Preview",
    "",
    "Commands are preview-only in this version. DryLake will not run them automatically.",
    "",
    runbook.provisioning.commands.length > 0 ? runbook.provisioning.commands.map((command) => `- \`${command}\``).join("\n") : "- No commands recorded."
  ].join("\n");
}

// src/generators/renderGeneratedFiles.ts
function renderGeneratedFiles(runbook, options = {}) {
  const files = [
    {
      logicalPath: ".drylake/generated/RUNBOOK.md",
      content: renderRunbookMd(runbook)
    },
    ...runbook.phases.map((phase) => ({
      logicalPath: `.drylake/generated/phase-${phase.id}.md`,
      content: renderPhasePrompt(runbook, phase, { activeProvider: options.activeProvider })
    }))
  ];
  if (runbook.agentTargets.agentsMd) {
    files.push({ logicalPath: ".drylake/generated/AGENTS.md", content: renderAgentsMd(runbook) });
  }
  if (runbook.agentTargets.claudeMd) {
    files.push({ logicalPath: ".drylake/generated/CLAUDE.md", content: renderClaudeMd(runbook) });
  }
  if (runbook.agentTargets.copilotInstructions) {
    files.push({
      logicalPath: ".drylake/generated/.github/copilot-instructions.md",
      content: renderCopilotInstructions(runbook)
    });
  }
  if (runbook.agentTargets.cursorRules) {
    files.push({
      logicalPath: ".drylake/generated/.cursor/rules/drylake.mdc",
      content: renderCursorRules(runbook)
    });
  }
  if (runbook.agentTargets.codexSkill) {
    files.push({
      logicalPath: ".drylake/generated/.agents/skills/drylake-execution/SKILL.md",
      content: renderCodexSkill(runbook)
    });
  }
  if (runbook.agentTargets.openclawSkill) {
    files.push({
      logicalPath: ".drylake/generated/.openclaw/skills/drylake-execution/SKILL.md",
      content: renderCodexSkill(runbook)
    });
  }
  return files;
}

// src/generators/planGeneratedFiles.ts
async function planGeneratedFiles(files, readExisting) {
  const planned = [];
  for (const file of files) {
    const existingContent = await readExisting(file.logicalPath);
    if (existingContent === null) {
      planned.push({ ...file, status: "new" });
      continue;
    }
    if (existingContent === file.content) {
      planned.push({ ...file, status: "unchanged", existingContent });
      continue;
    }
    planned.push({
      ...file,
      status: existingContent.includes("Generated by Xupra DryLake.") ? "would update" : "conflict",
      existingContent
    });
  }
  return planned;
}
function summarizeGeneratedFilePlan(plan) {
  const counts = {
    new: 0,
    unchanged: 0,
    "would update": 0,
    conflict: 0
  };
  for (const item of plan) {
    counts[item.status] += 1;
  }
  return counts;
}

// src/generators/writeGeneratedFiles.ts
var path3 = __toESM(require("node:path"));
var vscode15 = __toESM(require("vscode"));
function safePathSegments(logicalPath) {
  const normalized = logicalPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (path3.posix.isAbsolute(normalized) || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing to write outside the workspace: ${logicalPath}`);
  }
  return segments;
}
async function writeUtf8(uri, content) {
  await vscode15.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}
async function writeGeneratedFiles(params) {
  let written = 0;
  let backups = 0;
  for (const item of params.plan) {
    if (item.status === "unchanged" && !params.includeUnchanged) {
      continue;
    }
    const segments = safePathSegments(item.logicalPath);
    const target = vscode15.Uri.joinPath(params.rootUri, ...segments);
    const directorySegments = segments.slice(0, -1);
    const directory = directorySegments.length > 0 ? vscode15.Uri.joinPath(params.rootUri, ...directorySegments) : params.rootUri;
    await vscode15.workspace.fs.createDirectory(directory);
    if (item.existingContent !== void 0 && item.existingContent !== item.content) {
      await writeUtf8(target.with({ path: `${target.path}.drylake.bak` }), item.existingContent);
      backups += 1;
    }
    await writeUtf8(target, item.content);
    written += 1;
  }
  return { written, backups };
}
async function readWorkspaceExisting(rootUri, logicalPath) {
  const segments = safePathSegments(logicalPath);
  const uri = vscode15.Uri.joinPath(rootUri, ...segments);
  try {
    const bytes = await vscode15.workspace.fs.readFile(uri);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

// src/xu/approvalState.ts
function buildApprovalRecord(params) {
  return {
    type: params.type,
    approvedAt: params.approvedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    approvedBy: "local-user",
    runbook: "drylake.xu",
    summary: params.type === "purpose" ? params.runbook.intent.purpose : params.runbook.architecture.summary
  };
}
function applyApproval(runbook, type2) {
  if (type2 === "purpose") {
    return {
      ...runbook,
      confirmation: {
        ...runbook.confirmation,
        userApprovedIntent: true,
        status: runbook.confirmation.userApprovedArchitecture ? "approved" : "pending"
      },
      phases: runbook.phases.map(
        (phase) => phase.id === "01-intake" ? { ...phase, status: "approved" } : phase
      )
    };
  }
  return {
    ...runbook,
    confirmation: {
      ...runbook.confirmation,
      userApprovedArchitecture: true,
      status: runbook.confirmation.userApprovedIntent ? "approved" : "pending"
    },
    architecture: {
      ...runbook.architecture,
      status: "approved"
    },
    phases: runbook.phases.map(
      (phase) => phase.id === "02-architecture" ? { ...phase, status: "approved" } : phase
    )
  };
}

// src/xu/createLocalDraftXu.ts
function firstSentence(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(.+?[.!?])\s/);
  return (match?.[1] ?? trimmed).slice(0, 220);
}
function modePurpose(mode, prompt) {
  const summary = firstSentence(prompt);
  if (summary) {
    return summary;
  }
  switch (mode) {
    case "build-app":
      return "Build an application from an approved DryLake runbook.";
    case "phases":
      return "Break the requested work into approval-gated execution phases.";
    case "plan":
      return "Create an inspectable implementation plan for AI coding agents.";
    case "review":
      return "Review or repair the workspace through an approval-gated runbook.";
  }
}
function createLocalDraftXu(params) {
  const base = params.currentRunbook ?? createStarterXu({ prompt: params.prompt, mode: params.mode });
  const purpose = modePurpose(params.mode, params.prompt);
  const workspaceNote = params.workspaceSummary?.split("\n").find((line) => line.startsWith("Workspace:")) ?? "Workspace: current";
  return {
    ...base,
    metadata: {
      ...base.metadata,
      mode: params.mode,
      status: "draft"
    },
    intent: {
      ...base.intent,
      rawPrompt: params.prompt,
      purpose,
      users: base.intent.users.length > 0 ? base.intent.users : ["developer"],
      goals: base.intent.goals.length > 0 ? base.intent.goals : [
        "Create an inspectable drylake.xu runbook.",
        "Confirm purpose before architecture work.",
        "Approve architecture before execution handoff.",
        "Generate native agent files from the approved runbook."
      ],
      nonGoals: base.intent.nonGoals.length > 0 ? base.intent.nonGoals : [
        "Do not deploy or publish from this runbook.",
        "Do not run provisioning commands automatically.",
        "Do not call production APIs from the runbook flow."
      ],
      constraints: base.intent.constraints.length > 0 ? base.intent.constraints : [
        "Local-first workflow.",
        "Preview provisioning before execution.",
        "Keep generated artifacts under .drylake/generated first.",
        "Preserve user files with backups before overwrite."
      ]
    },
    architecture: {
      ...base.architecture,
      status: "proposed",
      summary: base.architecture.summary || `Use the current workspace as the source of truth (${workspaceNote}). Keep the runbook, approvals, generated files, and phase handoffs inspectable on disk.`,
      decisions: base.architecture.decisions.length > 0 ? base.architecture.decisions : [
        {
          id: "ADR-001",
          choice: "Use drylake.xu as the workflow source of truth.",
          rationale: "The user can inspect and version purpose, constraints, architecture, phases, and handoff instructions."
        },
        {
          id: "ADR-002",
          choice: "Generate preview artifacts before installing root instruction files.",
          rationale: "Preview-first generation makes the workflow safe to test in development."
        }
      ],
      risks: base.architecture.risks.length > 0 ? base.architecture.risks : [
        "The generated draft is local and deterministic when no integrated AI is available.",
        "Execution still depends on the user's chosen coding agent."
      ],
      assumptions: base.architecture.assumptions.length > 0 ? base.architecture.assumptions : [
        "The user will approve purpose and architecture before execution.",
        "Provisioning commands are reviewed manually."
      ]
    },
    provisioning: {
      ...base.provisioning,
      status: "draft",
      commands: base.provisioning.commands.length > 0 ? base.provisioning.commands : ["npm install", "npm run build"],
      filesToCreate: base.provisioning.filesToCreate.length > 0 ? base.provisioning.filesToCreate : [".drylake/generated/RUNBOOK.md", ".drylake/generated/AGENTS.md", ".drylake/generated/CLAUDE.md"],
      safety: {
        requiresApprovalBeforeExecution: true,
        executeAutomatically: false
      }
    }
  };
}

// src/xu/renderXu.ts
function renderXu(runbook) {
  return jsYaml.dump(runbook, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
    sortKeys: false
  });
}

// src/services/featureGates.ts
var vscode16 = __toESM(require("vscode"));
var UPGRADE_ACTION = "Upgrade to Pro";
function hasXupraProAiEntitlement(stateStore) {
  return connectionHasEntitlement(stateStore.getConnection(), "xupra_pro_ai");
}
async function promptForUpgrade(apiClient, message, stateStore) {
  const selected = await vscode16.window.showWarningMessage(message, UPGRADE_ACTION);
  if (selected === UPGRADE_ACTION) {
    await vscode16.env.openExternal(apiClient.openWebUrl("/billing?source=extension"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 12e4).toISOString());
  }
}
async function requireXupraProAiEntitlement(apiClient, stateStore, featureLabel) {
  if (hasXupraProAiEntitlement(stateStore)) {
    return true;
  }
  await promptForUpgrade(apiClient, `${featureLabel} requires a Pro plan. Upgrade to unlock.`, stateStore);
  return false;
}

// src/commands/runbooks.ts
var MODE_CHOICES = [
  {
    label: "Build App",
    description: "Purpose, architecture, phases, and agent-ready execution files",
    mode: "build-app"
  },
  {
    label: "Break Into Phases",
    description: "Clarify intent and split the work into manageable phases",
    mode: "phases"
  },
  {
    label: "Create Plan",
    description: "Generate a detailed file-level execution plan",
    mode: "plan"
  },
  {
    label: "Review / Repair",
    description: "Review existing code and produce a correction runbook",
    mode: "review"
  }
];
function workspaceRoot() {
  const root = vscode17.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake build session.");
  }
  return root;
}
function relativePath(uri) {
  return vscode17.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
}
function phaseAgentFromArg(arg) {
  return typeof arg === "string" && XU_PHASE_AGENTS.includes(arg) ? arg : void 0;
}
function phaseStatusFromArg(arg) {
  return arg === "pending" || arg === "active" || arg === "complete" ? arg : void 0;
}
function modeFromArg(arg) {
  if (typeof arg !== "string") {
    return void 0;
  }
  const normalized = arg.trim();
  return MODE_CHOICES.some((item) => item.mode === normalized) ? normalized : void 0;
}
async function pickMode(arg) {
  const fromArg = modeFromArg(arg);
  if (fromArg) {
    return fromArg;
  }
  const picked = await vscode17.window.showQuickPick(MODE_CHOICES, {
    placeHolder: "What do you want to build?",
    ignoreFocusOut: true
  });
  return picked?.mode;
}
async function resolveProvider(stateStore) {
  const resolution = await resolveDryLakeAiProvider({
    configuration: vscode17.workspace.getConfiguration("drylake"),
    backendConfiguration: vscode17.workspace.getConfiguration("xupra"),
    readConnection: () => stateStore.getConnection(),
    readAccessToken: () => stateStore.getAccessToken()
  });
  await stateStore.setPlanningProvider({
    id: resolution.provider.id,
    label: resolution.provider.label,
    reason: resolution.reason
  });
  return resolution.provider;
}
async function buildWorkspaceSummary() {
  const rootName = getWorkspaceDisplayName();
  let detected = [];
  try {
    const files = await scanWorkspaceFiles(vscode17.workspace.getConfiguration("xupra"));
    detected = files.map((file) => `${file.logicalPath} (${file.category})`);
  } catch {
    detected = [];
  }
  return [
    `Workspace: ${rootName}`,
    detected.length > 0 ? "Detected agent files:" : "Detected agent files: none",
    ...detected.slice(0, 80).map((item) => `- ${item}`)
  ].join("\n");
}
async function openGeneratedPromptDocument(title, content) {
  await vscode17.env.clipboard.writeText(content);
  const document = await vscode17.workspace.openTextDocument({
    language: "markdown",
    content: `# ${title}

The prompt has been copied to your clipboard.

${content}`
  });
  await vscode17.window.showTextDocument(document, { preview: false });
}
async function maybeImportExternalResult(sessionStore, currentUri) {
  const choice = await vscode17.window.showInformationMessage(
    "External AI Prompt is ready. Paste the AI's YAML result back into DryLake when it returns.",
    "Paste Result",
    "Open drylake.xu"
  );
  if (choice === "Paste Result") {
    const pasted = await vscode17.window.showInputBox({
      title: "Paste External AI Result",
      prompt: "Paste the YAML runbook returned by your external AI tool.",
      ignoreFocusOut: true
    });
    if (pasted?.trim()) {
      const parsed = parseAiRunbookResponse(pasted);
      if (!parsed.runbook) {
        throw new Error(parsed.validation.diagnostics.map((item) => item.message).join("\n"));
      }
      await sessionStore.writeRunbook(currentUri, parsed.runbook);
      void vscode17.window.showInformationMessage("Imported external AI result into drylake.xu.");
    }
    return;
  }
  if (choice === "Open drylake.xu") {
    const document = await vscode17.workspace.openTextDocument(currentUri);
    await vscode17.window.showTextDocument(document, { preview: false });
  }
}
async function seedChatWithClarifyingQuestions(params) {
  if (typeof params.provider.clarifyIntent !== "function") {
    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text: "I've drafted a starter plan based on your prompt. Tell me anything else I should know and I'll refine it."
    });
    return;
  }
  try {
    const workspaceSummary = await buildWorkspaceSummary();
    const result = await params.provider.clarifyIntent({
      prompt: params.prompt,
      mode: params.mode,
      workspaceSummary
    });
    const questions = Array.isArray(result.questions) ? result.questions.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
    if (questions.length === 0) {
      await params.deps.stateStore.appendChatMessage({
        role: "ai",
        text: result.message ?? "I've drafted a starter plan. Tell me anything else I should know and I'll refine it."
      });
      return;
    }
    const numbered = questions.slice(0, 4).map((question, index) => `${index + 1}. ${question}`).join("\n");
    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text: `Before I lock the plan, a few quick questions:
${numbered}

Answer in one message \u2014 anything you skip I'll just guess.`
    });
  } catch (error) {
    console.warn("DryLake clarifying questions failed:", error);
    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text: "I've drafted a starter plan. Tell me anything else I should know and I'll refine it."
    });
  }
}
async function chatSendMessageCommand(deps, textArg) {
  const text = typeof textArg === "string" ? textArg.trim() : "";
  if (!text) {
    return;
  }
  await deps.stateStore.appendChatMessage({ role: "user", text });
  await deps.controlRoom.refresh();
  const session = deps.stateStore.getBuildSession();
  const current = await deps.sessionStore.readRunbook();
  if (!session || !current) {
    await deps.stateStore.appendChatMessage({
      role: "system",
      text: "Start a build session first, then I can refine the plan based on what you say here."
    });
    await deps.controlRoom.refresh();
    return;
  }
  const provider = await resolveProvider(deps.stateStore);
  const availability = await provider.isAvailable();
  if (!availability.available && provider.id !== "external-ai-prompt") {
    await deps.stateStore.appendChatMessage({
      role: "system",
      text: availability.reason ?? `${provider.label} is not available right now.`
    });
    await deps.controlRoom.refresh();
    return;
  }
  const chatHistory = deps.stateStore.getChatHistory().messages;
  const chatTranscript = chatHistory.map((message) => {
    const speaker = message.role === "user" ? "User" : message.role === "system" ? "DryLake" : "Planning AI";
    return `${speaker}: ${message.text}`;
  }).join("\n");
  const refinedPrompt = `${session.prompt.trim()}

Planning chat so far:
${chatTranscript}`;
  await vscode17.window.withProgress(
    {
      location: vscode17.ProgressLocation.Notification,
      title: "DryLake is refining the plan...",
      cancellable: false
    },
    async () => {
      const workspaceSummary = await buildWorkspaceSummary();
      const result = await provider.generateDraftRunbook({
        prompt: refinedPrompt,
        mode: session.mode,
        workspaceSummary,
        currentRunbook: current.runbook
      });
      if (result.runbook) {
        await deps.sessionStore.writeRunbook(current.uri, result.runbook);
        await deps.stateStore.appendChatMessage({
          role: "ai",
          text: "Plan updated. Check the kanban below \u2014 let me know what else to change."
        });
      } else if (result.promptForExternalAi) {
        await openGeneratedPromptDocument("DryLake External AI Prompt", result.promptForExternalAi);
        await deps.stateStore.appendChatMessage({
          role: "system",
          text: result.message ?? "I opened an external AI prompt for you. Paste the result back to refine the plan further."
        });
      } else if (result.message) {
        await deps.stateStore.appendChatMessage({ role: "system", text: result.message });
      } else {
        await deps.stateStore.appendChatMessage({
          role: "system",
          text: "I couldn't refine the plan this time. Try rephrasing."
        });
      }
    }
  );
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}
async function clearChatCommand(deps) {
  await deps.stateStore.clearChatHistory();
  await deps.controlRoom.refresh();
}
async function applyAiDraft(params) {
  const workspaceSummary = await buildWorkspaceSummary();
  const localDraft = createLocalDraftXu({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
    currentRunbook: params.runbook
  });
  await params.deps.sessionStore.writeRunbook(params.runbookUri, localDraft);
  const availability = await params.provider.isAvailable();
  if (!availability.available && params.provider.id !== "external-ai-prompt") {
    if (params.provider.id === "xupra-pro-ai" && params.deps.stateStore.getConnection().userEmail) {
      await requireXupraProAiEntitlement(params.deps.apiClient, params.deps.stateStore, "Xupra Pro AI");
      return localDraft;
    }
    void vscode17.window.showInformationMessage(
      `${params.provider.label} is not available, so DryLake created a local draft runbook.`
    );
    return localDraft;
  }
  if (params.provider.id === "external-ai-prompt" && !params.openExternalPrompt) {
    void vscode17.window.showInformationMessage("DryLake created a local draft runbook.");
    return localDraft;
  }
  const result = await params.provider.generateDraftRunbook({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
    currentRunbook: localDraft
  });
  if (result.runbook) {
    await params.deps.sessionStore.writeRunbook(params.runbookUri, result.runbook);
    return result.runbook;
  }
  if (result.promptForExternalAi) {
    await openGeneratedPromptDocument("DryLake External AI Prompt", result.promptForExternalAi);
    await maybeImportExternalResult(params.deps.sessionStore, params.runbookUri);
  }
  if (result.message) {
    void vscode17.window.showInformationMessage(result.message);
  }
  return localDraft;
}
async function openControlRoomCommand(deps, context) {
  await deps.controlRoom.createOrShow(context);
}
async function startBuildSessionCommand(deps, context, modeArg, promptArg) {
  if (!(typeof promptArg === "string" && promptArg.trim())) {
    await deps.controlRoom.createOrShow(context);
    return;
  }
  const mode = await pickMode(modeArg);
  if (!mode) {
    return;
  }
  const prompt = promptArg;
  if (!prompt?.trim()) {
    return;
  }
  await deps.controlRoom.createOrShow(context);
  const provider = await resolveProvider(deps.stateStore);
  await vscode17.window.withProgress(
    {
      location: vscode17.ProgressLocation.Notification,
      title: "Starting DryLake build session...",
      cancellable: false
    },
    async () => {
      const cleanedPrompt = prompt.trim();
      await deps.stateStore.clearChatHistory();
      await deps.stateStore.appendChatMessage({ role: "user", text: cleanedPrompt });
      const ensured = await deps.sessionStore.ensureRunbook({ prompt: cleanedPrompt, mode });
      const session = await deps.sessionStore.createSession({
        prompt: cleanedPrompt,
        mode,
        runbookPath: relativePath(ensured.uri),
        providerId: provider.id,
        providerLabel: provider.label
      });
      await deps.stateStore.setBuildSession(session);
      await applyAiDraft({
        deps,
        prompt: cleanedPrompt,
        mode,
        runbook: ensured.runbook,
        runbookUri: ensured.uri,
        provider,
        openExternalPrompt: false
      });
      await seedChatWithClarifyingQuestions({ deps, provider, prompt: cleanedPrompt, mode });
    }
  );
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}
async function generateDraftRunbookCommand(deps) {
  const mode = await pickMode(deps.stateStore.getBuildSession()?.mode);
  if (!mode) {
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  const defaultPrompt = current?.runbook.intent.rawPrompt ?? deps.stateStore.getBuildSession()?.prompt ?? "";
  const prompt = await vscode17.window.showInputBox({
    title: "Generate Draft XU Runbook",
    prompt: "Describe the task to convert into drylake.xu.",
    value: defaultPrompt,
    ignoreFocusOut: true
  });
  if (!prompt?.trim()) {
    return;
  }
  const provider = await resolveProvider(deps.stateStore);
  const ensured = await deps.sessionStore.ensureRunbook({ prompt: prompt.trim(), mode });
  await applyAiDraft({
    deps,
    prompt: prompt.trim(),
    mode,
    runbook: ensured.runbook,
    runbookUri: ensured.uri,
    provider,
    openExternalPrompt: true
  });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}
async function validateXuRunbookCommand(deps) {
  const uri = await deps.sessionStore.findRunbookUri() ?? deps.sessionStore.getDefaultRunbookUri();
  let text = "";
  try {
    const bytes = await vscode17.workspace.fs.readFile(uri);
    text = new TextDecoder("utf-8").decode(bytes);
  } catch {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const parsed = parseXu(text);
  const diagnostics = parsed.runbook ? validateXu(parsed.runbook).diagnostics : parsed.validation.diagnostics;
  if (diagnostics.length === 0) {
    void vscode17.window.showInformationMessage("drylake.xu is valid.");
    return;
  }
  const content = ["# drylake.xu diagnostics", "", ...diagnostics.map((item) => `- ${item.path}: ${item.message}`)].join("\n");
  const document = await vscode17.workspace.openTextDocument({ language: "markdown", content });
  await vscode17.window.showTextDocument(document, { preview: false });
}
async function approve(deps, type2) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  if (type2 === "purpose" && !current.runbook.intent.purpose.trim()) {
    void vscode17.window.showWarningMessage("Add a purpose to drylake.xu before approving it.");
    return;
  }
  if (type2 === "architecture" && !current.runbook.architecture.summary.trim()) {
    void vscode17.window.showWarningMessage("Add an architecture summary to drylake.xu before approving it.");
    return;
  }
  const updated = applyApproval(current.runbook, type2);
  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.sessionStore.writeApproval(type2, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode17.window.showInformationMessage(
    type2 === "purpose" ? "DryLake purpose approval recorded." : "DryLake architecture approval recorded."
  );
}
async function approvePurposeCommand(deps) {
  await approve(deps, "purpose");
}
async function approveArchitectureCommand(deps) {
  await approve(deps, "architecture");
}
async function previewProvisioningPlanCommand(deps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const provisioning = current.runbook.provisioning;
  const content = [
    "# DryLake Provisioning Preview",
    "",
    "This is a preview. DryLake will not run these commands automatically in this version.",
    "",
    "## Commands",
    ...provisioning.commands.length ? provisioning.commands.map((command) => `- \`${command}\``) : ["- None"],
    "",
    "## Files To Create",
    ...provisioning.filesToCreate.length ? provisioning.filesToCreate.map((file) => `- ${file}`) : ["- None"],
    "",
    "## Environment Variables",
    ...provisioning.environmentVariables.length ? provisioning.environmentVariables.map((name) => `- ${name}`) : ["- None"],
    "",
    "## External Services",
    ...provisioning.externalServices.length ? provisioning.externalServices.map((name) => `- ${name}`) : ["- None"]
  ].join("\n");
  const document = await vscode17.workspace.openTextDocument({ language: "markdown", content });
  await vscode17.window.showTextDocument(document, { preview: false });
}
async function generateAgentFilesCommand(deps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const root = workspaceRoot();
  const buildSession = deps.stateStore.getBuildSession();
  const files = renderGeneratedFiles(current.runbook, { activeProvider: buildSession });
  const plan = await planGeneratedFiles(files, (logicalPath) => readWorkspaceExisting(root, logicalPath));
  const summary = summarizeGeneratedFilePlan(plan);
  const choice = await vscode17.window.showInformationMessage(
    `Generate DryLake preview artifacts? ${summary}. Existing changed preview files receive .drylake.bak backups.`,
    { modal: true },
    "Generate"
  );
  if (choice !== "Generate") {
    return;
  }
  const result = await writeGeneratedFiles({ rootUri: root, plan });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode17.window.showInformationMessage(
    `Generated ${result.written} DryLake preview file${result.written === 1 ? "" : "s"} under .drylake/generated.`
  );
}
function nextPhase(runbook) {
  return runbook.phases.find((phase) => phase.status !== "complete") ?? runbook.phases[0];
}
async function exportHandoffPromptCommand(deps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const phase = nextPhase(current.runbook);
  if (!phase) {
    void vscode17.window.showWarningMessage("drylake.xu has no phases.");
    return;
  }
  const buildSession = deps.stateStore.getBuildSession();
  const content = renderPhasePrompt(current.runbook, phase, { activeProvider: buildSession });
  await vscode17.env.clipboard.writeText(content);
  const document = await vscode17.workspace.openTextDocument({ language: "markdown", content });
  await vscode17.window.showTextDocument(document, { preview: false });
  void vscode17.window.showInformationMessage("Phase handoff prompt copied to clipboard.");
}
async function runNextPhaseCommand(deps) {
  await exportHandoffPromptCommand(deps);
}
async function handoffPhaseCommand(deps, phaseIdArg) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  if (!phaseId) {
    void vscode17.window.showWarningMessage("DryLake could not start the handoff because no phase was specified.");
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const phase = current.runbook.phases.find((item) => item.id === phaseId);
  if (!phase) {
    void vscode17.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }
  const updated = {
    ...current.runbook,
    phases: current.runbook.phases.map((item) => {
      if (item.id !== phaseId) {
        return item.status === "active" ? { ...item, status: "pending" } : item;
      }
      return { ...item, status: "active" };
    })
  };
  await deps.sessionStore.writeRunbook(current.uri, updated);
  const buildSession = deps.stateStore.getBuildSession();
  const content = renderPhasePrompt(updated, phase, { activeProvider: buildSession });
  await vscode17.env.clipboard.writeText(content);
  const document = await vscode17.workspace.openTextDocument({ language: "markdown", content });
  await vscode17.window.showTextDocument(document, { preview: false });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode17.window.showInformationMessage(`Handoff prompt for ${phase.title} copied to clipboard.`);
}
async function updatePhaseAgentCommand(deps, phaseIdArg, agentArg) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const agent = phaseAgentFromArg(agentArg);
  if (!phaseId || !agent) {
    void vscode17.window.showWarningMessage("DryLake could not update the phase agent because the request was invalid.");
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  let changed = false;
  const updated = {
    ...current.runbook,
    phases: current.runbook.phases.map((phase) => {
      if (phase.id !== phaseId) {
        return phase;
      }
      changed = true;
      return { ...phase, agent };
    })
  };
  if (!changed) {
    void vscode17.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }
  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}
async function updatePhaseStatusCommand(deps, phaseIdArg, statusArg) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const status = phaseStatusFromArg(statusArg);
  if (!phaseId || !status) {
    void vscode17.window.showWarningMessage("DryLake could not update the phase status because the request was invalid.");
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  let changed = false;
  const updated = {
    ...current.runbook,
    phases: current.runbook.phases.map((phase) => {
      if (phase.id !== phaseId) {
        return phase;
      }
      changed = true;
      return { ...phase, status };
    })
  };
  if (!changed) {
    void vscode17.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }
  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}
function stepStatusFromArg(arg) {
  return arg === "pending" || arg === "active" || arg === "approved" || arg === "needs-revision" || arg === "complete" ? arg : void 0;
}
async function toggleStepCommand(deps, phaseIdArg, stepIdArg, statusArg) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const stepId = typeof stepIdArg === "string" ? stepIdArg.trim() : "";
  const nextStatus = stepStatusFromArg(statusArg) ?? "complete";
  if (!phaseId || !stepId) {
    void vscode17.window.showWarningMessage("DryLake could not toggle the step because the request was invalid.");
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  let stepFound = false;
  let phaseWithUpdatedSteps;
  const phasesAfterStepUpdate = current.runbook.phases.map((phase) => {
    if (phase.id !== phaseId) {
      return phase;
    }
    const nextSteps = phase.steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }
      stepFound = true;
      return { ...step, status: nextStatus };
    });
    phaseWithUpdatedSteps = { ...phase, steps: nextSteps };
    return phaseWithUpdatedSteps;
  });
  if (!stepFound || !phaseWithUpdatedSteps) {
    void vscode17.window.showWarningMessage(`DryLake could not find step ${stepId} in phase ${phaseId}.`);
    return;
  }
  const allStepsComplete = phaseWithUpdatedSteps.steps.length > 0 && phaseWithUpdatedSteps.steps.every(
    (step) => step.status === "complete" || step.status === "approved"
  );
  let didAutoAdvance = false;
  let phases = phasesAfterStepUpdate;
  if (allStepsComplete && phaseWithUpdatedSteps.status !== "complete") {
    didAutoAdvance = true;
    const completedPhaseIndex = phases.findIndex((phase) => phase.id === phaseId);
    phases = phases.map((phase, index) => {
      if (index === completedPhaseIndex) {
        return { ...phase, status: "complete" };
      }
      return phase;
    });
    const nextPendingIndex = phases.findIndex(
      (phase, index) => index > completedPhaseIndex && phase.status !== "complete"
    );
    if (nextPendingIndex !== -1) {
      phases = phases.map(
        (phase, index) => index === nextPendingIndex ? { ...phase, status: "active" } : phase
      );
    }
  }
  const updated = {
    ...current.runbook,
    phases
  };
  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  if (didAutoAdvance) {
    const nextActive = updated.phases.find((phase) => phase.status === "active");
    if (nextActive) {
      void vscode17.window.showInformationMessage(
        `${phaseWithUpdatedSteps.title} complete. ${nextActive.title} is now active.`
      );
    } else {
      void vscode17.window.showInformationMessage(`${phaseWithUpdatedSteps.title} complete. All phases done.`);
    }
  }
}
async function reorderPhaseCommand(deps, phaseIdArg, afterPhaseIdArg) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const afterPhaseId = typeof afterPhaseIdArg === "string" && afterPhaseIdArg.trim() ? afterPhaseIdArg.trim() : null;
  if (!phaseId) {
    void vscode17.window.showWarningMessage("DryLake could not reorder the phase because the request was invalid.");
    return;
  }
  if (phaseId === afterPhaseId) {
    return;
  }
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode17.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }
  const phaseIndex = current.runbook.phases.findIndex((phase) => phase.id === phaseId);
  if (phaseIndex === -1) {
    void vscode17.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }
  const movingPhase = current.runbook.phases[phaseIndex];
  const remainingPhases = current.runbook.phases.filter((phase) => phase.id !== phaseId);
  let insertionIndex = 0;
  if (afterPhaseId) {
    const afterIndex = remainingPhases.findIndex((phase) => phase.id === afterPhaseId);
    if (afterIndex === -1) {
      void vscode17.window.showWarningMessage(`DryLake could not find phase ${afterPhaseId}.`);
      return;
    }
    insertionIndex = afterIndex + 1;
  }
  const phases = [
    ...remainingPhases.slice(0, insertionIndex),
    movingPhase,
    ...remainingPhases.slice(insertionIndex)
  ];
  if (phases.map((phase) => phase.id).join("\0") === current.runbook.phases.map((phase) => phase.id).join("\0")) {
    return;
  }
  await deps.sessionStore.writeRunbook(current.uri, {
    ...current.runbook,
    phases
  });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

// src/commands/signOut.ts
var vscode18 = __toESM(require("vscode"));
async function signOutCommand(apiClient, stateStore) {
  const hadSession = Boolean(await stateStore.getAccessToken()) || Boolean(stateStore.getConnection().userEmail);
  if (hadSession) {
    const choice = await vscode18.window.showWarningMessage(
      "Sign out of Xupra DryLake in this editor?",
      { modal: true },
      "Sign Out"
    );
    if (choice !== "Sign Out") {
      return false;
    }
  }
  apiClient.setAccessToken(void 0);
  await stateStore.clearAccessToken();
  await stateStore.clearConnection();
  await stateStore.setAwaitingPlanRefreshUntil(null);
  void vscode18.window.showInformationMessage(
    hadSession ? "Signed out of Xupra DryLake." : "Xupra DryLake is already signed out."
  );
  return true;
}

// src/services/browserConnect.ts
var import_node_crypto = require("node:crypto");
var path5 = __toESM(require("node:path"));
var vscode20 = __toESM(require("vscode"));

// src/services/runtimeInstall.ts
var import_node_os2 = __toESM(require("node:os"));
var import_node_path2 = __toESM(require("node:path"));
var vscode19 = __toESM(require("vscode"));
var CODEX_AGENT_PATH_PATTERN = /^\.codex\/agents\/.+\.toml$/i;
var CLAUDE_AGENT_PATH_PATTERN = /^\.claude\/agents\/.+\.md$/i;
var CURSOR_RULE_PATH_PATTERN = /^\.cursor\/rules\/.+\.mdc$/i;
var CURSOR_SKILL_PATH_PATTERN = /^\.cursor\/skills\/.+\/SKILL\.md$/i;
function inferTargetGroup(file) {
  const targetPlatform = file.targetPlatform?.toLowerCase();
  const normalized = file.logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (targetPlatform === "codex" || normalized.startsWith(".codex/") || normalized.startsWith(".agents/")) {
    return "codex";
  }
  if (targetPlatform === "claude_code" || targetPlatform === "claude_agents" || normalized.startsWith(".claude/")) {
    return "claude";
  }
  if (targetPlatform === "cursor" || normalized.startsWith(".cursor/")) {
    return "cursor";
  }
  if (normalized === "AGENTS.md") {
    return "codex";
  }
  if (normalized === "CLAUDE.md") {
    return "claude";
  }
  return null;
}
function mapRuntimeLogicalPath(file) {
  const normalized = file.logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const targetGroup = inferTargetGroup(file);
  if (!targetGroup) {
    return null;
  }
  if (targetGroup === "codex") {
    if (normalized === "AGENTS.md") {
      return ".codex/AGENTS.md";
    }
    if (normalized.startsWith(".agents/skills/")) {
      return `.codex/skills/${normalized.slice(".agents/skills/".length)}`;
    }
    if (normalized.startsWith(".codex/")) {
      return normalized;
    }
    return null;
  }
  if (targetGroup === "claude") {
    if (normalized === "CLAUDE.md") {
      return ".claude/CLAUDE.md";
    }
    if (normalized.startsWith(".claude/")) {
      return normalized;
    }
    return null;
  }
  if (targetGroup === "cursor") {
    if (normalized.startsWith(".cursor/")) {
      return normalized;
    }
    return null;
  }
  return null;
}
async function installGeneratedFilesToRuntimeHome(files) {
  const homeUri = vscode19.Uri.file(import_node_os2.default.homedir());
  const mappedFiles = files.flatMap((file) => {
    const logicalPath = mapRuntimeLogicalPath(file);
    return logicalPath ? [
      {
        logicalPath,
        preview: file.preview
      }
    ] : [];
  });
  if (mappedFiles.length === 0) {
    throw new Error("No generated files map to Codex, Claude, or Cursor runtime locations.");
  }
  const writtenCount = await writeGeneratedFilesToWorkspace(mappedFiles, {
    confirmBeforeWrite: true,
    rootUri: homeUri,
    confirmationLabel: `the default vendor runtime directories under ${import_node_os2.default.homedir()} (.codex, .claude, .cursor)`
  });
  if (writtenCount === 0) {
    return null;
  }
  const codexAgents = mappedFiles.filter((file) => CODEX_AGENT_PATH_PATTERN.test(file.logicalPath)).map((file) => import_node_path2.default.posix.basename(file.logicalPath, ".toml"));
  const claudeAgents = mappedFiles.filter((file) => CLAUDE_AGENT_PATH_PATTERN.test(file.logicalPath)).map((file) => import_node_path2.default.posix.basename(file.logicalPath, ".md"));
  const cursorRules = mappedFiles.filter((file) => CURSOR_RULE_PATH_PATTERN.test(file.logicalPath)).map((file) => import_node_path2.default.posix.basename(file.logicalPath, ".mdc"));
  const cursorSkills = mappedFiles.filter((file) => CURSOR_SKILL_PATH_PATTERN.test(file.logicalPath)).map((file) => import_node_path2.default.posix.dirname(file.logicalPath).split("/").pop() ?? "skill");
  return {
    writtenCount,
    installRoot: import_node_os2.default.homedir(),
    codexAgents,
    claudeAgents,
    cursorRules,
    cursorSkills
  };
}

// src/services/browserConnect.ts
var CONNECT_TIMEOUT_MS = 1e3 * 60 * 3;
var CONNECT_POLL_INTERVAL_MS = 1500;
var SUPPORTED_INSTALL_TARGETS = /* @__PURE__ */ new Set(["codex", "claude_code", "claude_agents", "cursor"]);
var ALL_INSTALL_TARGETS = ["codex", "claude_code", "claude_agents", "cursor"];
var logger2 = getLogger();
function logConnectStage(stage, details) {
  logger2.info(
    `Browser connect ${stage}${details ? ` ${JSON.stringify(details)}` : ""}`
  );
}
function buildExternalConnectUrl(apiClient, callbackUri, requestId, state) {
  const url = new URL(apiClient.openWebUrl("/extensions/connect").toString());
  url.searchParams.set("callback", callbackUri.toString());
  url.searchParams.set("editor", vscode20.env.uriScheme === "cursor" ? "cursor" : "vscode");
  url.searchParams.set("requestId", requestId);
  url.searchParams.set("state", state);
  url.searchParams.set("request", Date.now().toString());
  return vscode20.Uri.parse(url.toString());
}
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function normalizeInstallTarget(rawValue) {
  const value = rawValue?.trim();
  if (!value) {
    return null;
  }
  if (value === "claude") {
    return "claude_agents";
  }
  if (value === "all") {
    return "all";
  }
  return SUPPORTED_INSTALL_TARGETS.has(value) ? value : null;
}
function normalizeInstallMode(rawValue) {
  if (!rawValue || rawValue === "workspace-root") {
    return "workspace-root";
  }
  if (rawValue === "runtime-home") {
    return "runtime-home";
  }
  if (rawValue === "custom-path") {
    return "custom-path";
  }
  return null;
}
function isInsideWorkspace(uri) {
  const roots = vscode20.workspace.workspaceFolders ?? [];
  return roots.some((root) => {
    const relative2 = path5.relative(root.uri.fsPath, uri.fsPath);
    return relative2 === "" || !relative2.startsWith("..") && !path5.isAbsolute(relative2);
  });
}
var BrowserConnectCoordinator = class {
  constructor(context, apiClient, stateStore) {
    this.context = context;
    this.apiClient = apiClient;
    this.stateStore = stateStore;
  }
  pending;
  register() {
    return vscode20.window.registerUriHandler(this);
  }
  async applyConnectedSession(exchanged) {
    this.apiClient.setAccessToken(exchanged.token.token);
    await this.stateStore.setAccessToken(exchanged.token.token);
    await this.stateStore.setConnection({
      organizationId: exchanged.organization.id,
      organizationName: exchanged.organization.name,
      organizationSlug: exchanged.organization.slug,
      organizationTier: exchanged.organization.tier,
      entitlements: normalizeEntitlements(exchanged.entitlements),
      subscriptionStatus: exchanged.subscription?.status,
      userEmail: exchanged.user.email,
      userAvatarUrl: exchanged.user.imageUrl ?? void 0,
      authMode: "clerk"
    });
    logConnectStage("exchange_succeeded", {
      organizationId: exchanged.organization.id,
      editor: exchanged.editor
    });
    const tierLabel = exchanged.organization.tier ? exchanged.organization.tier.charAt(0).toUpperCase() + exchanged.organization.tier.slice(1).toLowerCase() : "Free";
    void vscode20.window.showInformationMessage(
      `Connected to Xupra DryLake as ${exchanged.user.email} (${tierLabel} plan).`
    );
    void vscode20.commands.executeCommand("xupra.refreshProjects");
  }
  async pollPendingRequest(pendingRequest) {
    while (this.pending === pendingRequest) {
      try {
        const pollResult = await this.apiClient.pollBrowserConnect(
          pendingRequest.requestId,
          pendingRequest.pollToken
        );
        if (this.pending !== pendingRequest) {
          return;
        }
        if (pollResult.status === "pending") {
          await sleep(CONNECT_POLL_INTERVAL_MS);
          continue;
        }
        clearTimeout(pendingRequest.timeout);
        this.pending = void 0;
        if (pollResult.status === "approved") {
          logConnectStage("poll_approved", { requestId: pendingRequest.requestId });
          pendingRequest.resolve({
            kind: "approved",
            session: pollResult
          });
          return;
        }
        const messages = {
          denied: "The browser denied the Xupra connection request. Start Connect again from the editor.",
          expired: "The Xupra browser approval request expired. Start Connect again from the editor.",
          consumed: "This Xupra browser approval request was already completed. Start Connect again if this editor is still disconnected."
        };
        logConnectStage("poll_finished_without_session", {
          requestId: pendingRequest.requestId,
          status: pollResult.status
        });
        pendingRequest.resolve({
          kind: "error",
          message: messages[pollResult.status]
        });
        return;
      } catch (error) {
        logConnectStage("poll_retry", {
          requestId: pendingRequest.requestId,
          message: error instanceof Error ? error.message : String(error)
        });
        await sleep(CONNECT_POLL_INTERVAL_MS);
      }
    }
  }
  async handleUri(uri) {
    if (uri.path === "/import") {
      await vscode20.commands.executeCommand("xupra.projects.focus");
      if (!await this.stateStore.getAccessToken()) {
        void vscode20.window.showInformationMessage(
          "Connect Xupra first, then the import will run from this editor."
        );
        await vscode20.commands.executeCommand("xupra.connect");
      }
      if (await this.stateStore.getAccessToken()) {
        await vscode20.commands.executeCommand("xupra.importWorkspace");
      }
      return;
    }
    if (uri.path === "/install") {
      await this.handleInstallUri(uri);
      return;
    }
    if (uri.path !== "/auth-complete") {
      return;
    }
    const query = new URLSearchParams(uri.query);
    const code = query.get("code");
    const state = query.get("state");
    const error = query.get("error");
    const message = query.get("message");
    const approved = query.get("approved") === "1" || query.get("connected") === "1";
    const matchesPendingState = Boolean(this.pending && state === this.pending.state);
    logConnectStage("callback_received", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      approved,
      matchesPendingState
    });
    if (!code) {
      if (approved && this.pending && state === this.pending.state) {
        logConnectStage("focus_callback_received");
        return;
      }
      if (this.pending && state === this.pending.state) {
        clearTimeout(this.pending.timeout);
        logConnectStage("missing_code", { error, message });
        this.pending.resolve({
          kind: "error",
          message: message ?? error ?? "The browser callback did not include a connect code."
        });
        this.pending = void 0;
      }
      return;
    }
    if (this.pending && state === this.pending.state) {
      const pendingRequest = this.pending;
      clearTimeout(pendingRequest.timeout);
      this.pending = void 0;
      logConnectStage("legacy_code_received");
      const exchanged2 = await this.apiClient.exchangeBrowserConnectCode(code).catch(() => null);
      if (!exchanged2) {
        logConnectStage("exchange_failed");
        pendingRequest.resolve({
          kind: "error",
          message: "Xupra DryLake received a browser callback, but the connection code could not be exchanged. Run Connect again."
        });
        return;
      }
      pendingRequest.resolve({
        kind: "approved",
        session: exchanged2
      });
      return;
    }
    logConnectStage("state_mismatch_or_unsolicited_callback", {
      hasPendingRequest: Boolean(this.pending)
    });
    const exchanged = await this.apiClient.exchangeBrowserConnectCode(code).catch(() => null);
    if (!exchanged) {
      logConnectStage("exchange_failed");
      void vscode20.window.showWarningMessage(
        "Xupra DryLake received a browser callback, but the connection code could not be exchanged. Run Connect again."
      );
      return;
    }
    await this.applyConnectedSession(exchanged);
  }
  async handleInstallUri(uri) {
    const query = new URLSearchParams(uri.query);
    const versionId = query.get("versionId")?.trim();
    const targetPlatform = normalizeInstallTarget(
      query.get("targetPlatform") ?? query.get("platform") ?? query.get("format")
    );
    const mode = normalizeInstallMode(query.get("mode"));
    if (!versionId) {
      void vscode20.window.showErrorMessage("Xupra install link is missing a package version.");
      return;
    }
    if (!targetPlatform) {
      void vscode20.window.showErrorMessage("Xupra install link has an unsupported target format.");
      return;
    }
    if (!mode) {
      void vscode20.window.showErrorMessage("Xupra install link has an unsupported install mode.");
      return;
    }
    await vscode20.commands.executeCommand("xupra.projects.focus");
    if (!await this.stateStore.getAccessToken()) {
      void vscode20.window.showInformationMessage(
        "Connect Xupra first, then the install will run from this editor."
      );
      await vscode20.commands.executeCommand("xupra.connect");
    }
    if (!await this.stateStore.getAccessToken()) {
      return;
    }
    await this.stateStore.setSelection({ versionId });
    try {
      const installTargets = targetPlatform === "all" ? ALL_INSTALL_TARGETS : [targetPlatform];
      const generatedFilesByPath = /* @__PURE__ */ new Map();
      for (const installTarget of installTargets) {
        const preview = await this.apiClient.exportPreview(versionId, installTarget);
        const generatedFiles2 = preview.generatedFiles?.length ? preview.generatedFiles : (await this.apiClient.listGeneratedExports(versionId, installTarget, true)).generatedFiles;
        for (const file of generatedFiles2) {
          generatedFilesByPath.set(`${installTarget}:${file.logicalPath}`, {
            logicalPath: file.logicalPath,
            preview: file.preview,
            targetPlatform: installTarget
          });
        }
      }
      const generatedFiles = Array.from(generatedFilesByPath.values());
      if (generatedFiles.length === 0) {
        void vscode20.window.showWarningMessage(`No generated files are available for ${targetPlatform}.`);
        return;
      }
      if (mode === "runtime-home") {
        const summary = await installGeneratedFilesToRuntimeHome(generatedFiles);
        if (!summary) {
          return;
        }
        const details = [];
        if (summary.codexAgents.length > 0) {
          details.push(
            `Codex agents: ${summary.codexAgents.join(", ")}. Ask Codex to use the named Xupra agent`
          );
        }
        if (summary.claudeAgents.length > 0) {
          details.push(
            `Claude agents: ${summary.claudeAgents.join(", ")}. Run claude --agent <name> or ask Claude to use that subagent`
          );
        }
        if (summary.cursorRules.length > 0 || summary.cursorSkills.length > 0) {
          details.push(
            `Cursor rules: ${summary.cursorRules.join(", ") || "none"}. Cursor skills: ${summary.cursorSkills.join(", ") || "none"}`
          );
        }
        const suffix = details.length > 0 ? ` ${details.join(". ")}.` : "";
        void vscode20.window.showInformationMessage(
          `Installed ${summary.writtenCount} files into the default vendor directories under ${summary.installRoot} (.codex, .claude, .cursor), not the current workspace.${suffix}`
        );
        return;
      }
      if (mode === "custom-path") {
        const picked = await vscode20.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: vscode20.workspace.workspaceFolders?.[0]?.uri,
          openLabel: "Choose Install Folder",
          title: "Choose where Xupra should write generated files"
        });
        const targetFolder = picked?.[0];
        if (!targetFolder) {
          return;
        }
        if (!isInsideWorkspace(targetFolder)) {
          void vscode20.window.showErrorMessage("Choose a folder inside the current workspace.");
          return;
        }
        const writtenCount2 = await writeGeneratedFilesToWorkspace(generatedFiles, {
          confirmBeforeWrite: true,
          rootUri: targetFolder,
          confirmationLabel: "the selected folder"
        });
        if (writtenCount2 > 0) {
          void vscode20.window.showInformationMessage(`Installed ${writtenCount2} files.`);
        }
        return;
      }
      const writtenCount = await writeGeneratedFilesToWorkspace(generatedFiles, {
        confirmBeforeWrite: true
      });
      if (writtenCount > 0) {
        void vscode20.window.showInformationMessage(`Installed ${writtenCount} files.`);
      }
    } catch (error) {
      void vscode20.window.showErrorMessage(
        error instanceof Error ? error.message : "Xupra install failed."
      );
    }
  }
  async start() {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.resolve(null);
      this.pending = void 0;
    }
    const state = (0, import_node_crypto.randomUUID)();
    const internalCallbackUri = vscode20.Uri.parse(
      `${vscode20.env.uriScheme}://${this.context.extension.id}/auth-complete?state=${encodeURIComponent(state)}`
    );
    const externalCallbackUri = await vscode20.env.asExternalUri(internalCallbackUri);
    const editor = vscode20.env.uriScheme === "cursor" ? "cursor" : "vscode";
    const connectRequest = await this.apiClient.startBrowserConnect(editor);
    const connectUrl = buildExternalConnectUrl(
      this.apiClient,
      externalCallbackUri,
      connectRequest.requestId,
      state
    );
    let pendingRequest;
    const resultPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pending?.state === state) {
          this.pending = void 0;
          logConnectStage("timeout");
          void vscode20.window.showWarningMessage(
            "Xupra did not receive browser approval before the request expired. Start Connect again or use the manual token fallback."
          );
          resolve(null);
        }
      }, CONNECT_TIMEOUT_MS);
      pendingRequest = {
        state,
        requestId: connectRequest.requestId,
        pollToken: connectRequest.pollToken,
        resolve,
        timeout
      };
      this.pending = pendingRequest;
      void this.pollPendingRequest(pendingRequest);
    });
    try {
      const opened = await vscode20.env.openExternal(connectUrl);
      logConnectStage("browser_opened", { opened });
      if (!opened && pendingRequest?.state === state) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve({
          kind: "error",
          message: `Xupra could not open your browser automatically. Open ${this.apiClient.baseUrl}/extensions/connect and continue from there.`
        });
        if (this.pending === pendingRequest) {
          this.pending = void 0;
        }
      }
    } catch (error) {
      if (pendingRequest?.state === state) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve({
          kind: "error",
          message: error instanceof Error ? `Xupra could not open your browser: ${error.message}` : "Xupra could not open your browser automatically."
        });
        if (this.pending === pendingRequest) {
          this.pending = void 0;
        }
      }
    }
    return resultPromise;
  }
};

// src/services/importedSkillEditor.ts
var path6 = __toESM(require("node:path"));
var import_node_os3 = __toESM(require("node:os"));
var vscode21 = __toESM(require("vscode"));
function normalizeLogicalPath(rawValue) {
  return rawValue.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}
function safeLogicalPathSegments(rawValue) {
  const normalized = normalizeLogicalPath(rawValue);
  const segments = normalized.split("/").filter(Boolean);
  if (!normalized || path6.posix.isAbsolute(normalized) || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid Xupra skill path: ${rawValue}`);
  }
  return segments;
}
function slugForName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "skill";
}
function fallbackSkillPath(skill) {
  const slug = slugForName(skill.name);
  switch (skill.sourcePlatform) {
    case "codex":
      return `.codex/skills/${slug}/SKILL.md`;
    case "cursor":
      return `.cursor/skills/${slug}/SKILL.md`;
    case "windsurf":
      return `.windsurf/rules/skills/${slug}.md`;
    case "cline":
      return `.clinerules/skills/${slug}.md`;
    case "roo":
      return `.roo/rules/skills/${slug}.md`;
    case "copilot":
      return `.github/instructions/${slug}.instructions.md`;
    case "gemini":
      return `GEMINI-${slug}.md`;
    case "junie":
      return `.junie/${slug}.md`;
    case "warp":
      return `WARP-${slug}.md`;
    case "claude_agents":
    case "claude_code":
    default:
      return `.claude/skills/${slug}/SKILL.md`;
  }
}
function fallbackAgentPath(agent) {
  switch (agent.sourcePlatform) {
    case "codex":
      return `.codex/agents/${agent.slug}.toml`;
    case "cursor":
      return `.cursor/rules/${agent.slug}.mdc`;
    case "windsurf":
      return `.windsurf/rules/${agent.slug}.md`;
    case "cline":
      return `.clinerules/${agent.slug}.md`;
    case "roo":
      return `.roo/rules/${agent.slug}.md`;
    case "copilot":
      return ".github/copilot-instructions.md";
    case "gemini":
      return "GEMINI.md";
    case "junie":
      return ".junie/guidelines.md";
    case "warp":
      return "WARP.md";
    case "generic":
      return ".rules";
    case "claude_agents":
    case "claude_code":
    default:
      return `.claude/agents/${agent.slug}.md`;
  }
}
function defaultRuntimeLogicalPath(rawValue) {
  const logicalPath = normalizeLogicalPath(rawValue);
  if (logicalPath === "AGENTS.md") {
    return ".codex/AGENTS.md";
  }
  if (logicalPath === "CLAUDE.md") {
    return ".claude/CLAUDE.md";
  }
  if (logicalPath.startsWith(".agents/skills/")) {
    return `.codex/skills/${logicalPath.slice(".agents/skills/".length)}`;
  }
  if (logicalPath.startsWith(".codex/") || logicalPath.startsWith(".claude/") || logicalPath.startsWith(".cursor/") || logicalPath.startsWith(".windsurf/") || logicalPath.startsWith(".clinerules/") || logicalPath.startsWith(".roo/") || logicalPath.startsWith(".github/") || logicalPath.startsWith(".junie/")) {
    return logicalPath;
  }
  if ([".clinerules", ".roorules", ".rules", "GEMINI.md", "WARP.md"].includes(logicalPath)) {
    return logicalPath;
  }
  return null;
}
var ImportedSkillEditorManager = class {
  constructor(context, apiClient, onSynced) {
    this.context = context;
    this.apiClient = apiClient;
    this.onSynced = onSynced;
    this.disposables.push(
      vscode21.workspace.onDidSaveTextDocument((document) => {
        void this.syncManagedDocument(document);
      })
    );
  }
  managedDocuments = /* @__PURE__ */ new Map();
  disposables = [];
  dispose() {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
  async openImportedSkill(versionId, skill) {
    await this.openImportedItem({
      versionId,
      logicalPath: normalizeLogicalPath(skill.sourcePath || fallbackSkillPath(skill)),
      content: skill.sourceContent,
      label: "skill"
    });
  }
  async openImportedAgent(versionId, agent) {
    await this.openImportedItem({
      versionId,
      logicalPath: normalizeLogicalPath(agent.sourcePath || fallbackAgentPath(agent)),
      content: agent.sourceContent,
      label: "agent"
    });
  }
  async uninstallImportedSkill(skill) {
    const logicalPath = normalizeLogicalPath(skill.sourcePath || fallbackSkillPath(skill));
    await this.uninstallImportedItem(logicalPath, "skill", skill.name || logicalPath);
  }
  async uninstallImportedAgent(agent) {
    const logicalPath = normalizeLogicalPath(agent.sourcePath || fallbackAgentPath(agent));
    await this.uninstallImportedItem(logicalPath, "agent", agent.name || agent.slug || logicalPath);
  }
  async uninstallImportedItem(logicalPath, label, displayName) {
    const targets = [];
    const workspaceFile = await this.findWorkspaceFile(logicalPath);
    if (workspaceFile) {
      targets.push(workspaceFile);
    }
    const runtimeFile = this.resolveDefaultRuntimeFile(logicalPath);
    if (runtimeFile) {
      const existing = await this.findFile(runtimeFile);
      if (existing) {
        targets.push(existing);
      }
    }
    if (targets.length === 0) {
      void vscode21.window.showInformationMessage(
        `${displayName}: no installed runtime file found for ${logicalPath}. Nothing to uninstall.`
      );
      return;
    }
    const targetList = targets.map((uri) => uri.fsPath).join("\n");
    const choice = await vscode21.window.showWarningMessage(
      `Uninstall ${label} "${displayName}"? This deletes the runtime file from disk:

${targetList}

The imported record in Xupra is preserved as audit history. You can reinstall by clicking the row.`,
      { modal: true },
      "Delete"
    );
    if (choice !== "Delete") {
      return;
    }
    const failures = [];
    for (const target of targets) {
      try {
        await vscode21.workspace.fs.delete(target, { useTrash: false });
        this.managedDocuments.delete(target.toString());
      } catch (error) {
        failures.push(
          `${target.fsPath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    if (failures.length > 0) {
      void vscode21.window.showErrorMessage(`Failed to uninstall ${label}: ${failures.join("; ")}`);
      return;
    }
    void vscode21.window.showInformationMessage(
      `Uninstalled ${label} "${displayName}". Deleted ${targets.length} file(s).`
    );
  }
  async openImportedItem(params) {
    const { versionId, logicalPath, content, label } = params;
    const workspaceFile = await this.findWorkspaceFile(logicalPath);
    if (workspaceFile) {
      const document2 = await vscode21.workspace.openTextDocument(workspaceFile);
      await vscode21.window.showTextDocument(document2, { preview: false });
      void vscode21.window.showInformationMessage(`Opened workspace ${label} ${logicalPath}. Re-import to sync local edits back to Xupra.`);
      return;
    }
    const runtimeFile = this.resolveDefaultRuntimeFile(logicalPath);
    if (runtimeFile) {
      const existingRuntimeFile = await this.findFile(runtimeFile);
      if (!existingRuntimeFile) {
        await this.writeFile(runtimeFile, content);
      }
      this.managedDocuments.set(runtimeFile.toString(), {
        versionId,
        logicalPath,
        label
      });
      const document2 = await vscode21.workspace.openTextDocument(runtimeFile);
      await vscode21.window.showTextDocument(document2, { preview: false });
      void vscode21.window.showInformationMessage(
        `Opened default runtime ${label} ${logicalPath}. Save to sync changes back to Xupra.`
      );
      return;
    }
    const managedFile = await this.writeManagedFile(versionId, logicalPath, content);
    this.managedDocuments.set(managedFile.toString(), {
      versionId,
      logicalPath,
      label
    });
    const document = await vscode21.workspace.openTextDocument(managedFile);
    await vscode21.window.showTextDocument(document, { preview: false });
    void vscode21.window.showInformationMessage(`Opened Xupra-managed ${label} ${logicalPath}. Save to sync changes back to Xupra.`);
  }
  async findWorkspaceFile(logicalPath) {
    const rootUri = vscode21.workspace.workspaceFolders?.[0]?.uri;
    if (!rootUri) {
      return null;
    }
    const target = vscode21.Uri.joinPath(rootUri, ...safeLogicalPathSegments(logicalPath));
    return this.findFile(target);
  }
  resolveDefaultRuntimeFile(logicalPath) {
    const runtimeLogicalPath = defaultRuntimeLogicalPath(logicalPath);
    if (!runtimeLogicalPath) {
      return null;
    }
    return vscode21.Uri.joinPath(vscode21.Uri.file(import_node_os3.default.homedir()), ...safeLogicalPathSegments(runtimeLogicalPath));
  }
  async findFile(target) {
    try {
      const stat = await vscode21.workspace.fs.stat(target);
      return stat.type === vscode21.FileType.File ? target : null;
    } catch {
      return null;
    }
  }
  async writeFile(fileUri, content) {
    const directory = vscode21.Uri.file(path6.dirname(fileUri.fsPath));
    await vscode21.workspace.fs.createDirectory(directory);
    await vscode21.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
  }
  async writeManagedFile(versionId, logicalPath, content) {
    const root = vscode21.Uri.joinPath(this.context.globalStorageUri, "editable-imports", versionId);
    const segments = safeLogicalPathSegments(logicalPath);
    const fileUri = vscode21.Uri.joinPath(root, ...segments);
    await this.writeFile(fileUri, content);
    return fileUri;
  }
  async syncManagedDocument(document) {
    const managed = this.managedDocuments.get(document.uri.toString());
    if (!managed) {
      return;
    }
    try {
      await this.apiClient.uploadFiles(managed.versionId, [
        {
          logicalPath: managed.logicalPath,
          content: document.getText()
        }
      ]);
      await this.apiClient.importVersion(managed.versionId);
      if (this.onSynced) {
        await this.onSynced(managed.versionId);
      }
      void vscode21.window.showInformationMessage(`Synced ${managed.logicalPath} to Xupra.`);
    } catch (error) {
      void vscode21.window.showErrorMessage(
        error instanceof Error ? error.message : `Failed to sync ${managed.label} changes back to Xupra.`
      );
    }
  }
};

// src/services/optimization.ts
var vscode22 = __toESM(require("vscode"));
var SCHEME = "xupra-optimized";
var IMPORTED_SCHEME = "xupra-imported";
var OptimizationContentProvider = class {
  contentByPath = /* @__PURE__ */ new Map();
  emitter = new vscode22.EventEmitter();
  onDidChange = this.emitter.event;
  provideTextDocumentContent(uri) {
    return this.contentByPath.get(uri.toString()) ?? "";
  }
  register(originalUri, content) {
    const optimizedUri = vscode22.Uri.from({
      scheme: SCHEME,
      path: originalUri.path,
      query: `t=${Date.now()}`
    });
    const key = optimizedUri.toString();
    this.contentByPath.set(key, content);
    this.emitter.fire(optimizedUri);
    return optimizedUri;
  }
  static get scheme() {
    return SCHEME;
  }
};
var ImportedContentProvider = class {
  constructor(fetcher) {
    this.fetcher = fetcher;
  }
  cache = /* @__PURE__ */ new Map();
  emitter = new vscode22.EventEmitter();
  onDidChange = this.emitter.event;
  static buildUri(versionId, logicalPath) {
    const safePath = logicalPath.startsWith("/") ? logicalPath : "/" + logicalPath;
    return vscode22.Uri.from({
      scheme: IMPORTED_SCHEME,
      authority: versionId,
      path: safePath
    });
  }
  static get scheme() {
    return IMPORTED_SCHEME;
  }
  refresh(uri) {
    this.cache.delete(uri.toString());
    this.emitter.fire(uri);
  }
  async provideTextDocumentContent(uri) {
    const key = uri.toString();
    const cached = this.cache.get(key);
    if (cached !== void 0) return cached;
    const versionId = uri.authority;
    const logicalPath = uri.path.replace(/^\/+/, "");
    if (!versionId || !logicalPath) {
      return "// Unable to load file: missing version or path.";
    }
    try {
      const content = await this.fetcher(versionId, logicalPath);
      this.cache.set(key, content);
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `// Failed to load ${logicalPath} from server.
// ${message}`;
    }
  }
};
var CODEX_AGENT = /(^|\/)\.codex\/agents\/.+\.toml$/i;
var CODEX_AGENTS_MD = /(^|\/)AGENTS\.md$/i;
var CODEX_SKILL = /(^|\/)\.codex\/skills\/.+/i;
var CLAUDE_AGENT = /(^|\/)\.claude\/agents\/.+\.md$/i;
var CLAUDE_MD = /(^|\/)CLAUDE\.md$/i;
var CLAUDE_SKILL = /(^|\/)\.claude\/(skills|commands)\/.+/i;
var CURSOR_RULE = /(^|\/)\.cursor\/rules\/.+\.mdc?$/i;
var CURSOR_SKILL = /(^|\/)\.cursor\/(skills|commands)\/.+/i;
var CURSOR_ANY = /(^|\/)\.cursor\//i;
var WINDSURF_RULE = /(^|\/)\.windsurf\/rules\/.+\.md$/i;
var CLINE_RULE = /(^|\/)\.clinerules(?:\/.+\.md)?$/i;
var ROO_RULE = /(^|\/)(?:\.roo\/rules\/.+\.md|\.roorules)$/i;
var COPILOT_INSTRUCTIONS = /(^|\/)\.github\/(?:copilot-instructions\.md|instructions\/.+\.instructions\.md)$/i;
var GEMINI_MD = /(^|\/)GEMINI\.md$/i;
var JUNIE_GUIDELINES = /(^|\/)\.junie\/guidelines\.md$/i;
var WARP_MD = /(^|\/)WARP\.md$/i;
var GENERIC_RULES = /(^|\/)\.rules$/i;
var AGENTS_DIR = /(^|\/)\.agents\//i;
function inferTargetPlatformFromUri(uri) {
  const normalized = uri.path.replace(/\\/g, "/");
  if (CODEX_AGENT.test(normalized) || CODEX_AGENTS_MD.test(normalized) || CODEX_SKILL.test(normalized)) {
    return "codex";
  }
  if (CLAUDE_AGENT.test(normalized)) {
    return "claude_agents";
  }
  if (CLAUDE_MD.test(normalized) || CLAUDE_SKILL.test(normalized)) {
    return "claude_code";
  }
  if (CURSOR_RULE.test(normalized) || CURSOR_SKILL.test(normalized) || CURSOR_ANY.test(normalized)) {
    return "cursor";
  }
  if (WINDSURF_RULE.test(normalized)) {
    return "windsurf";
  }
  if (CLINE_RULE.test(normalized)) {
    return "cline";
  }
  if (ROO_RULE.test(normalized)) {
    return "roo";
  }
  if (COPILOT_INSTRUCTIONS.test(normalized)) {
    return "copilot";
  }
  if (GEMINI_MD.test(normalized)) {
    return "gemini";
  }
  if (JUNIE_GUIDELINES.test(normalized)) {
    return "junie";
  }
  if (WARP_MD.test(normalized)) {
    return "warp";
  }
  if (GENERIC_RULES.test(normalized)) {
    return "generic";
  }
  if (AGENTS_DIR.test(normalized)) {
    return "codex";
  }
  return null;
}
async function pickTargetPlatform(currentBest) {
  const items = [
    { label: "Codex", description: "AGENTS.md / .codex/agents/*.toml", value: "codex" },
    { label: "Claude Code", description: "CLAUDE.md / .claude/skills/*", value: "claude_code" },
    { label: "Claude Agents", description: ".claude/agents/*.md", value: "claude_agents" },
    { label: "Cursor", description: ".cursor/rules/*.mdc", value: "cursor" },
    { label: "Windsurf", description: ".windsurf/rules/*.md", value: "windsurf" },
    { label: "Cline", description: ".clinerules or .clinerules/*.md", value: "cline" },
    { label: "Roo Code", description: ".roo/rules/*.md or .roorules", value: "roo" },
    { label: "GitHub Copilot", description: ".github/copilot-instructions.md", value: "copilot" },
    { label: "Gemini CLI", description: "GEMINI.md", value: "gemini" },
    { label: "JetBrains Junie", description: ".junie/guidelines.md", value: "junie" },
    { label: "Warp", description: "WARP.md", value: "warp" },
    { label: "Generic .rules", description: ".rules", value: "generic" }
  ];
  const picked = await vscode22.window.showQuickPick(items, {
    placeHolder: currentBest ? `Pick the target platform (best guess: ${currentBest})` : "Pick the target platform for Xupra AI to optimize against",
    ignoreFocusOut: true
  });
  return picked?.value ?? null;
}
async function collectRepoContext() {
  const root = vscode22.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    return void 0;
  }
  const segments = [];
  const readSnippet = async (relative2, label, maxBytes) => {
    try {
      const fileUri = vscode22.Uri.joinPath(root, ...relative2.split("/"));
      const bytes = await vscode22.workspace.fs.readFile(fileUri);
      const text = new TextDecoder("utf-8").decode(bytes).slice(0, maxBytes).trim();
      if (text) {
        segments.push(`--- ${label} (${relative2}) ---
${text}`);
      }
    } catch {
    }
  };
  await readSnippet("package.json", "package.json", 1500);
  await readSnippet("README.md", "README.md", 2e3);
  await readSnippet("pyproject.toml", "pyproject.toml", 1e3);
  await readSnippet("go.mod", "go.mod", 800);
  await readSnippet("Cargo.toml", "Cargo.toml", 800);
  return segments.length > 0 ? segments.join("\n\n") : void 0;
}

// src/services/stateStore.ts
var KEY = "xupra.selectedContext";
var CONNECTION_KEY = "xupra.connection";
var DETECTED_FILES_KEY = "xupra.detectedFiles";
var ACCESS_TOKEN_KEY = "xupra.extensionAccessToken";
var LAST_IMPORT_KEY = "xupra.lastImport";
var AWAITING_PLAN_REFRESH_KEY = "xupra.awaitingPlanRefreshUntil";
var BUILD_SESSION_KEY = "drylake.buildSession";
var PLANNING_PROVIDER_KEY = "drylake.planningProvider";
var CHAT_HISTORY_KEY = "drylake.chatHistory";
var EMPTY_CHAT_STATE = { messages: [] };
var StateStore = class {
  constructor(context) {
    this.context = context;
  }
  getSelection() {
    return this.context.workspaceState.get(KEY, {});
  }
  async setSelection(next) {
    const current = this.getSelection();
    await this.context.workspaceState.update(KEY, {
      ...current,
      ...next
    });
  }
  async clear() {
    await this.context.workspaceState.update(KEY, {});
  }
  async resetWorkspaceState() {
    await this.context.workspaceState.update(KEY, {});
    await this.context.workspaceState.update(DETECTED_FILES_KEY, []);
    await this.context.workspaceState.update(LAST_IMPORT_KEY, null);
  }
  getConnection() {
    return this.context.workspaceState.get(CONNECTION_KEY, {});
  }
  async setConnection(next) {
    const current = this.getConnection();
    await this.context.workspaceState.update(CONNECTION_KEY, {
      ...current,
      ...next
    });
  }
  async clearConnection() {
    await this.context.workspaceState.update(CONNECTION_KEY, {});
  }
  getAwaitingPlanRefreshUntil() {
    return this.context.workspaceState.get(AWAITING_PLAN_REFRESH_KEY, null);
  }
  async setAwaitingPlanRefreshUntil(value) {
    await this.context.workspaceState.update(AWAITING_PLAN_REFRESH_KEY, value);
  }
  getDetectedFiles() {
    return this.context.workspaceState.get(DETECTED_FILES_KEY, []);
  }
  async setDetectedFiles(files) {
    await this.context.workspaceState.update(DETECTED_FILES_KEY, files);
  }
  getLastImport() {
    return this.context.workspaceState.get(LAST_IMPORT_KEY, null);
  }
  async setLastImport(summary) {
    await this.context.workspaceState.update(LAST_IMPORT_KEY, summary);
  }
  async clearLastImport() {
    await this.context.workspaceState.update(LAST_IMPORT_KEY, null);
  }
  getBuildSession() {
    return this.context.workspaceState.get(BUILD_SESSION_KEY, null);
  }
  async setBuildSession(session) {
    await this.context.workspaceState.update(BUILD_SESSION_KEY, session);
  }
  async clearBuildSession() {
    await this.context.workspaceState.update(BUILD_SESSION_KEY, null);
  }
  getPlanningProvider() {
    return this.context.workspaceState.get(PLANNING_PROVIDER_KEY, null);
  }
  async setPlanningProvider(info) {
    await this.context.workspaceState.update(PLANNING_PROVIDER_KEY, info);
  }
  getChatHistory() {
    return this.context.workspaceState.get(CHAT_HISTORY_KEY, EMPTY_CHAT_STATE);
  }
  async setChatHistory(state) {
    await this.context.workspaceState.update(CHAT_HISTORY_KEY, state);
  }
  async appendChatMessage(message) {
    const current = this.getChatHistory();
    const next = {
      id: message.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: message.role,
      text: message.text,
      ts: message.ts ?? Date.now()
    };
    await this.setChatHistory({ messages: [...current.messages, next] });
    return next;
  }
  async clearChatHistory() {
    await this.setChatHistory(EMPTY_CHAT_STATE);
  }
  getActivePhaseSummary(runbook) {
    const phase = runbook?.phases.find((item) => item.status !== "complete") ?? runbook?.phases[0];
    if (!phase) {
      return null;
    }
    return {
      phaseId: phase.id,
      phaseTitle: phase.title,
      agent: phase.agent
    };
  }
  async getAccessToken() {
    return this.context.secrets.get(ACCESS_TOKEN_KEY);
  }
  async setAccessToken(token) {
    await this.context.secrets.store(ACCESS_TOKEN_KEY, token);
  }
  async clearAccessToken() {
    await this.context.secrets.delete(ACCESS_TOKEN_KEY);
  }
};

// src/views/helpTreeProvider.ts
var vscode23 = __toESM(require("vscode"));
var HelpTreeProvider = class {
  emitter = new vscode23.EventEmitter();
  onDidChangeTreeData = this.emitter.event;
  refresh() {
    this.emitter.fire();
  }
  getTreeItem(element) {
    const item = new vscode23.TreeItem(element.label, vscode23.TreeItemCollapsibleState.None);
    item.description = element.description;
    if (element.command) {
      item.command = {
        command: element.command,
        title: element.label,
        arguments: element.arguments ?? []
      };
    } else {
      item.contextValue = "disabled";
    }
    return item;
  }
  getChildren() {
    return [
      {
        label: "Connect Extension",
        description: "Open the browser connect page or fallback flow",
        command: "xupra.openConnectPage"
      },
      {
        label: "Open Dashboard",
        description: "Open the Xupra workspace in your browser",
        command: "xupra.openWebApp"
      },
      {
        label: "Extension Settings",
        description: "Configure base URL, defaults, and writeback behavior",
        command: "xupra.openSettings"
      },
      {
        label: "Account Settings",
        description: "Open your Xupra account settings",
        command: "xupra.openAccountSettings"
      },
      {
        label: "Billing",
        description: "Open billing and plan management",
        command: "xupra.openBilling"
      },
      {
        label: "Workflow",
        description: "Import -> canonicalize -> export",
        command: "xupra.openHowItWorks"
      },
      {
        label: "Sign Out",
        description: "Clear this editor's Xupra connection",
        command: "xupra.signOut"
      },
      {
        label: "Contact Support",
        description: "Email support@xupracorp.com",
        command: "xupra.contactSupport"
      },
      {
        label: "\u2014 Advanced Tools \u2014"
      },
      {
        label: "Import Agent Configs",
        description: "Import workspace agent instructions into Xupra",
        command: "xupra.importWorkspace"
      },
      {
        label: "Sync Agent Configs",
        description: "Install generated configs to local agent runtimes",
        command: "xupra.installToRuntime"
      },
      {
        label: "Validate Agent Configs",
        description: "Check compatibility across supported agent tools",
        command: "xupra.checkCompatibility"
      },
      {
        label: "Preview Agent Config Changes",
        description: "Preview generated config changes before writeback",
        command: "xupra.exportPreview"
      },
      {
        label: "Pull Generated Agent Files",
        description: "Pull generated files into the workspace",
        command: "xupra.pullPackage"
      }
    ];
  }
};

// src/views/howItWorksPanel.ts
var vscode24 = __toESM(require("vscode"));
var sections = {
  workflow: {
    title: "Import, Normalize, Export",
    eyebrow: "Workflow",
    body: "Xupra DryLake turns IDE-specific agent files into a canonical package, then exports that package for another supported target.",
    items: [
      "Import supported workspace and global files from this editor.",
      "Review normalized agents, skills, rules, and raw files in the workspace.",
      "Run compatibility checks before export preview.",
      "Export generated files back into the target IDE format."
    ]
  }
};
var HowItWorksPanel = class _HowItWorksPanel {
  static currentPanel;
  static createOrShow(context, section = "workflow") {
    const column = vscode24.window.activeTextEditor?.viewColumn ?? vscode24.ViewColumn.One;
    if (_HowItWorksPanel.currentPanel) {
      _HowItWorksPanel.currentPanel.reveal(column);
      _HowItWorksPanel.currentPanel.webview.html = _HowItWorksPanel.render(section);
      return;
    }
    const panel = vscode24.window.createWebviewPanel(
      "xupra.howItWorks",
      "Xupra DryLake Help",
      column,
      {
        enableScripts: false,
        localResourceRoots: [context.extensionUri]
      }
    );
    _HowItWorksPanel.currentPanel = panel;
    panel.webview.html = _HowItWorksPanel.render(section);
    panel.onDidDispose(() => {
      _HowItWorksPanel.currentPanel = void 0;
    });
  }
  static render(section) {
    const content = sections[section];
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    main {
      max-width: 760px;
      padding: 32px;
    }

    .eyebrow {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 10px 0 12px;
      font-size: 30px;
      line-height: 1.1;
    }

    p {
      max-width: 680px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.65;
    }

    ol {
      display: grid;
      gap: 10px;
      margin: 22px 0 0;
      padding: 0;
      list-style: none;
    }

    li {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px 14px;
      background: var(--vscode-sideBar-background, var(--vscode-editorWidget-background));
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">${content.eyebrow}</div>
    <h1>${content.title}</h1>
    <p>${content.body}</p>
    <ol>
      ${content.items.map((item) => `<li>${item}</li>`).join("")}
    </ol>
  </main>
</body>
</html>`;
  }
};

// src/views/jobTreeProvider.ts
var vscode25 = __toESM(require("vscode"));
var JobTreeProvider = class {
  emitter = new vscode25.EventEmitter();
  onDidChangeTreeData = this.emitter.event;
  jobs = [];
  setJobs(jobs) {
    this.jobs = jobs;
    this.refresh();
  }
  prepend(job) {
    this.jobs = [job, ...this.jobs].slice(0, 20);
    this.refresh();
  }
  refresh() {
    this.emitter.fire();
  }
  getTreeItem(element) {
    const item = new vscode25.TreeItem(`${element.title} \xB7 ${element.status}`, vscode25.TreeItemCollapsibleState.None);
    item.description = element.kind;
    item.tooltip = `${element.id}
${element.createdAt}`;
    return item;
  }
  getChildren() {
    return this.jobs;
  }
};

// src/views/skillCreationPanel.ts
var vscode26 = __toESM(require("vscode"));
var LOGICAL_PATH_BY_PLATFORM = {
  claude_code: (slug) => `.claude/agents/${slug}.md`,
  claude_agents: (slug) => `.claude/agents/${slug}.md`,
  codex: (slug) => `.codex/agents/${slug}.toml`,
  cursor: (slug) => `.cursor/rules/${slug}.mdc`,
  windsurf: (slug) => `.windsurf/rules/${slug}.md`,
  cline: (slug) => `.clinerules/${slug}.md`,
  roo: (slug) => `.roo/rules/${slug}.md`,
  copilot: () => ".github/copilot-instructions.md",
  gemini: () => "GEMINI.md",
  junie: () => ".junie/guidelines.md",
  warp: () => "WARP.md",
  generic: () => ".rules"
};
function slugForAgentName(agentName) {
  return agentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
}
function logicalPathForPlatform(targetPlatform, agentName) {
  const slug = slugForAgentName(agentName);
  return (LOGICAL_PATH_BY_PLATFORM[targetPlatform] ?? ((value) => `.agents/agents/${value}.md`))(slug);
}
function escapeTomlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function escapeYamlString(value) {
  return value.replace(/"/g, '\\"');
}
function buildMarkdownAgent(params) {
  const name = params.name.trim() || "New Agent";
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();
  return [
    "---",
    `name: "${escapeYamlString(name)}"`,
    `description: "${escapeYamlString(description)}"`,
    `targetPlatform: "${escapeYamlString(params.targetPlatform)}"`,
    "tools: []",
    "---",
    "",
    `# ${name}`,
    "",
    description,
    ...context ? ["", "## Codebase Context", "", context] : [],
    "",
    "## Operating Guidance",
    "",
    "- Understand the user's goal before changing code.",
    "- Follow the conventions already present in the current repository.",
    "- Keep changes scoped to the requested work.",
    "- Validate meaningful behavior before finishing.",
    "",
    "## Output Standard",
    "",
    "- Explain what changed.",
    "- Mention validation performed.",
    "- Surface blockers or risks clearly."
  ].join("\n");
}
function buildCodexAgent(params) {
  const name = params.name.trim() || "New Agent";
  const slug = slugForAgentName(name);
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();
  const instructions = [
    `# ${name}`,
    "",
    description,
    ...context ? ["", "## Codebase Context", "", context] : [],
    "",
    "## Operating Guidance",
    "",
    "- Understand the user's goal before changing code.",
    "- Follow the conventions already present in the current repository.",
    "- Keep changes scoped to the requested work.",
    "- Validate meaningful behavior before finishing."
  ].join("\n");
  return [
    `name = "${escapeTomlString(slug)}"`,
    `description = "${escapeTomlString(description)}"`,
    "tools = []",
    'developer_instructions = """',
    instructions.replace(/"""/g, '\\"\\"\\"'),
    '"""'
  ].join("\n");
}
function buildCursorAgent(params) {
  const name = params.name.trim() || "New Agent";
  const description = params.description.trim() || "Describe what this agent should help with.";
  const context = params.context?.trim();
  return [
    "---",
    `description: "${escapeYamlString(description)}"`,
    "alwaysApply: false",
    "---",
    "",
    `# ${name}`,
    "",
    description,
    ...context ? ["", "## Codebase Context", "", context] : [],
    "",
    "## Operating Guidance",
    "",
    "- Use this rule when the current task matches the description.",
    "- Follow the current repository's conventions.",
    "- Keep edits scoped and validated."
  ].join("\n");
}
function buildBlankAgentTemplate(params) {
  switch (params.targetPlatform) {
    case "codex":
      return buildCodexAgent(params);
    case "cursor":
      return buildCursorAgent(params);
    case "claude_agents":
    case "claude_code":
    default:
      return buildMarkdownAgent(params);
  }
}
function withPathSuffix(logicalPath, suffix) {
  const slashIndex = logicalPath.lastIndexOf("/");
  const directory = slashIndex >= 0 ? logicalPath.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? logicalPath.slice(slashIndex + 1) : logicalPath;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${directory}${fileName}${suffix}`;
  }
  return `${directory}${fileName.slice(0, dotIndex)}${suffix}${fileName.slice(dotIndex)}`;
}
var SkillCreationPanel = class _SkillCreationPanel {
  constructor(_panel, _context, _apiClient, _stateStore, _configuration) {
    this._panel = _panel;
    this._context = _context;
    this._apiClient = _apiClient;
    this._stateStore = _stateStore;
    this._configuration = _configuration;
    this._panel.onDidDispose(
      () => {
        _SkillCreationPanel._current = void 0;
        this.dispose();
      },
      null,
      this._disposables
    );
    this._panel.webview.html = this._getHtml();
    this._registerMessageHandler();
  }
  static _current;
  _disposables = [];
  static createOrShow(context, apiClient, stateStore, configuration) {
    if (_SkillCreationPanel._current) {
      _SkillCreationPanel._current._panel.reveal(vscode26.ViewColumn.One);
      return;
    }
    const panel = vscode26.window.createWebviewPanel(
      "xupra.skillCreation",
      "Create Agent \u2014 Xupra DryLake",
      vscode26.ViewColumn.One,
      { enableScripts: true }
    );
    _SkillCreationPanel._current = new _SkillCreationPanel(
      panel,
      context,
      apiClient,
      stateStore,
      configuration
    );
  }
  dispose() {
    while (this._disposables.length > 0) {
      this._disposables.pop()?.dispose();
    }
  }
  _registerMessageHandler() {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.type) {
            case "startBlank":
              await this._handleStartBlank(message);
              break;
            case "generate":
              await this._handleGenerate(message);
              break;
          }
        } catch (error) {
          await this._postMessage({
            type: "error",
            requestId: message.requestId ?? "unknown",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      },
      null,
      this._disposables
    );
  }
  async _handleStartBlank(message) {
    const content = buildBlankAgentTemplate(message);
    await this._writeAndOpenAgent({
      requestId: message.requestId,
      name: message.name,
      targetPlatform: message.targetPlatform,
      content,
      label: "Blank agent draft"
    });
  }
  async _handleGenerate(message) {
    await this._postMessage({ type: "stateUpdate", isLoading: true });
    try {
      const hasEntitlement = await requireXupraProAiEntitlement(
        this._apiClient,
        this._stateStore,
        "Xupra AI agent generation"
      );
      if (!hasEntitlement) {
        await this._postMessage({
          type: "error",
          requestId: message.requestId,
          message: "upgrade_required"
        });
        await this._postMessage({ type: "stateUpdate", isLoading: false });
        return;
      }
      const agent = await this._apiClient.generateAgent({
        name: message.name,
        description: message.description,
        targetPlatform: message.targetPlatform,
        context: message.context
      });
      await this._writeAndOpenAgent({
        requestId: message.requestId,
        name: message.name,
        targetPlatform: message.targetPlatform,
        content: agent.agent.content,
        label: "Xupra AI agent draft"
      });
      await this._postMessage({ type: "stateUpdate", isLoading: false });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error)
      });
      await this._postMessage({ type: "stateUpdate", isLoading: false });
    }
  }
  async _writeAndOpenAgent(params) {
    const requestedLogicalPath = logicalPathForPlatform(params.targetPlatform, params.name);
    try {
      const root = vscode26.workspace.workspaceFolders?.[0]?.uri;
      if (!root) {
        await this._postMessage({
          type: "error",
          requestId: params.requestId,
          message: "Open a folder in VS Code first, then try Create Agent again. Xupra writes the new agent file into your workspace."
        });
        const choice = await vscode26.window.showWarningMessage(
          "Create Agent needs an open folder. Pick a folder to write the new agent into.",
          "Open Folder\u2026"
        );
        if (choice === "Open Folder\u2026") {
          await vscode26.commands.executeCommand("vscode.openFolder");
        }
        return;
      }
      const logicalPath = await this._nextAvailableLogicalPath(root, requestedLogicalPath);
      await writeGeneratedFilesToWorkspace([{ logicalPath, preview: params.content }], {
        confirmBeforeWrite: false
      });
      const document = await vscode26.workspace.openTextDocument(vscode26.Uri.joinPath(root, ...logicalPath.split("/").filter(Boolean)));
      await vscode26.window.showTextDocument(document, { preview: false });
      void vscode26.window.showInformationMessage(
        `${params.label} opened at ${logicalPath}.`,
        "Sync to Xupra"
      ).then((choice) => {
        if (choice === "Sync to Xupra") {
          void vscode26.commands.executeCommand("xupra.importWorkspace");
        }
      });
      await this._postMessage({ type: "result", requestId: params.requestId });
    } catch (error) {
      await this._postMessage({
        type: "error",
        requestId: params.requestId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  async _nextAvailableLogicalPath(root, logicalPath) {
    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? logicalPath : withPathSuffix(logicalPath, `-${index + 1}`);
      const target = vscode26.Uri.joinPath(root, ...candidate.split("/").filter(Boolean));
      try {
        await vscode26.workspace.fs.stat(target);
      } catch {
        return candidate;
      }
    }
    return withPathSuffix(logicalPath, `-${Date.now()}`);
  }
  _postMessage(message) {
    return this._panel.webview.postMessage(message);
  }
  _getHtml() {
    const extensionPath = this._context.extensionUri.toString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 760px;
      padding: 20px;
    }

    h2 {
      margin: 0 0 4px;
      font-size: 1.35em;
      font-weight: 650;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      color: var(--vscode-foreground);
      font-weight: 600;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-height: 32px;
      padding: 7px 9px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    textarea {
      min-height: 104px;
      resize: vertical;
      line-height: 1.45;
    }

    button {
      align-self: flex-start;
      padding: 7px 12px;
      border: 1px solid var(--vscode-button-background);
      border-radius: 4px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }

    button:disabled {
      cursor: default;
      opacity: 0.6;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .status,
    .error {
      color: var(--vscode-descriptionForeground);
    }

    .intro {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }

    .error {
      padding: 8px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }

    .hint {
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
  </style>
</head>
<body data-extension-path="${extensionPath}">
  <main class="panel">
    <h2>Create DryLake Agent</h2>
    <p class="intro">Create a system-specific agent file manually for free, or generate a draft with Xupra AI on Pro.</p>

    <div class="field">
      <label for="agent-name">Agent name</label>
      <input type="text" id="agent-name">
    </div>

    <div class="field">
      <label for="agent-description">Purpose</label>
      <input type="text" id="agent-description">
    </div>

    <div class="field">
      <label for="target-platform">Target platform</label>
      <select id="target-platform">
        <option value="claude_code">Claude Code</option>
        <option value="codex">Codex</option>
        <option value="cursor">Cursor</option>
        <option value="claude_agents">Claude Agents</option>
        <option value="windsurf">Windsurf</option>
        <option value="cline">Cline</option>
        <option value="roo">Roo Code</option>
        <option value="copilot">GitHub Copilot</option>
        <option value="gemini">Gemini CLI</option>
        <option value="junie">JetBrains Junie</option>
        <option value="warp">Warp</option>
        <option value="generic">Generic .rules</option>
      </select>
    </div>

    <div class="field">
      <label for="agent-context">Company or codebase context</label>
      <textarea id="agent-context"></textarea>
    </div>

    <div class="actions">
      <button id="start-blank-btn">Start Blank Agent</button>
      <button id="generate-btn">Generate Agent with Xupra AI (Pro)</button>
    </div>
    <div class="hint">Drafts are written into the current workspace and opened in a normal VS Code editor tab.</div>
    <div id="loading" class="status" style="display:none">Generating agent\u2026</div>
    <div id="error-message" class="error" style="display:none"></div>
  </main>

  <script>
    const vscode = acquireVsCodeApi();

    function uuid() {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const agentName = document.getElementById("agent-name");
    const agentDescription = document.getElementById("agent-description");
    const targetPlatform = document.getElementById("target-platform");
    const agentContext = document.getElementById("agent-context");
    const startBlankBtn = document.getElementById("start-blank-btn");
    const generateBtn = document.getElementById("generate-btn");
    const loading = document.getElementById("loading");
    const errorMessage = document.getElementById("error-message");

    function showError(message) {
      errorMessage.innerHTML = escapeHtml(message);
      errorMessage.style.display = "block";
    }

    function clearError() {
      errorMessage.textContent = "";
      errorMessage.style.display = "none";
    }

    startBlankBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "startBlank",
        requestId: uuid(),
        name: agentName.value,
        description: agentDescription.value,
        targetPlatform: targetPlatform.value,
        context: agentContext.value
      });
    });

    generateBtn.addEventListener("click", function() {
      clearError();
      vscode.postMessage({
        type: "generate",
        requestId: uuid(),
        name: agentName.value,
        description: agentDescription.value,
        targetPlatform: targetPlatform.value,
        context: agentContext.value
      });
    });

    window.addEventListener("message", function(event) {
      const message = event.data;

      if (message.type === "stateUpdate") {
        loading.style.display = message.isLoading ? "block" : "none";
        startBlankBtn.disabled = Boolean(message.isLoading);
        generateBtn.disabled = Boolean(message.isLoading);
      }

      if (message.type === "result") {
        clearError();
      }

      if (message.type === "error") {
        loading.style.display = "none";
        startBlankBtn.disabled = false;
        generateBtn.disabled = false;

        if (message.message === "upgrade_required") {
          return;
        }

        showError(message.message || "Something went wrong.");
      }
    });
  </script>
</body>
</html>`;
  }
};

// src/views/statusBar.ts
var vscode27 = __toESM(require("vscode"));
function createStatusBar() {
  const item = vscode27.window.createStatusBarItem(vscode27.StatusBarAlignment.Left, 100);
  item.command = "xupra.openWebApp";
  const update = (state = {}) => {
    if (!state.connected) {
      item.text = "$(plug) Xupra: Connect";
      item.tooltip = "Connect Xupra DryLake";
      item.command = "xupra.connect";
      item.show();
      return;
    }
    item.command = "xupra.openWebApp";
    item.text = `$(plug-connected) Xupra: ${state.versionLabel ?? state.organizationSlug ?? "Connected"}`;
    item.tooltip = state.organizationSlug ? `Connected to ${state.organizationSlug}` : "Open Xupra DryLake";
    item.show();
  };
  update();
  return {
    item,
    update,
    dispose: () => item.dispose()
  };
}

// src/views/workspaceSidebarProvider.ts
var vscode28 = __toESM(require("vscode"));
var import_node_os4 = __toESM(require("node:os"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_path3 = __toESM(require("node:path"));
function loadXupraMarkDataUri() {
  const candidates = [
    import_node_path3.default.join(__dirname, "..", "media", "xupra-mark.webp"),
    import_node_path3.default.join(__dirname, "media", "xupra-mark.webp")
  ];
  for (const candidate of candidates) {
    try {
      const buffer = import_node_fs.default.readFileSync(candidate);
      return "data:image/webp;base64," + buffer.toString("base64");
    } catch {
    }
  }
  return "";
}
var XUPRA_MARK_DATA_URI = loadXupraMarkDataUri();
var WorkspaceSidebarProvider = class {
  constructor(stateStore, apiClient) {
    this.stateStore = stateStore;
    this.apiClient = apiClient;
  }
  _view;
  resolveWebviewView(webviewView) {
    webviewView.webview.options = { enableScripts: true };
    this._view = webviewView;
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case "connect":
            await vscode28.commands.executeCommand("xupra.connect");
            break;
          case "importWorkspace":
            await vscode28.commands.executeCommand("xupra.importWorkspace");
            break;
          case "importDefaultLocations":
            await vscode28.commands.executeCommand("xupra.importDefaultLocations");
            break;
          case "importFolder":
            await vscode28.commands.executeCommand("xupra.importFolder");
            break;
          case "openBilling":
            await vscode28.commands.executeCommand("xupra.openBilling");
            break;
          case "openDashboard":
            await vscode28.commands.executeCommand("xupra.openWebApp");
            break;
          case "openSettings":
            await vscode28.commands.executeCommand("xupra.openSettings");
            break;
          case "signOut":
            await vscode28.commands.executeCommand("xupra.signOut");
            break;
          case "refreshPlan":
            await vscode28.commands.executeCommand("xupra.refreshPlan");
            break;
          case "createAgent":
            await vscode28.commands.executeCommand("xupra.createAgent");
            break;
          case "exportPreview":
            await vscode28.commands.executeCommand("xupra.exportPreview");
            break;
          case "installToRuntime":
            await vscode28.commands.executeCommand("xupra.installToRuntime");
            break;
          case "checkCompatibility":
            await vscode28.commands.executeCommand("xupra.checkCompatibility");
            break;
          case "pullPackage":
            await vscode28.commands.executeCommand("xupra.pullPackage");
            break;
          case "startBuildSession":
            await vscode28.commands.executeCommand("drylake.startBuildSession");
            break;
          case "openControlRoom":
            await vscode28.commands.executeCommand("drylake.openControlRoom");
            break;
          case "validateXuRunbook":
            await vscode28.commands.executeCommand("drylake.validateXuRunbook");
            break;
          case "generateAgentFiles":
            await vscode28.commands.executeCommand("drylake.generateAgentFiles");
            break;
          case "exportHandoffPrompt":
            await vscode28.commands.executeCommand("drylake.exportHandoffPrompt");
            break;
          case "openImportedSkill":
            await vscode28.commands.executeCommand("xupra.openImportedSkill", message.skillRuleId);
            break;
          case "openImportedAgent":
            await vscode28.commands.executeCommand("xupra.openImportedAgent", message.subagentId);
            break;
          case "uninstallImportedAgent":
            await vscode28.commands.executeCommand("xupra.uninstallImportedAgent", message.subagentId);
            break;
          case "uninstallImportedSkill":
            await vscode28.commands.executeCommand("xupra.uninstallImportedSkill", message.skillRuleId);
            break;
          case "clearImportCache":
            await vscode28.commands.executeCommand("xupra.clearImportCache");
            break;
          case "optimizeFile": {
            const uri = await this.resolveLogicalPathUri(message.logicalPath);
            if (!uri) {
              void vscode28.window.showWarningMessage(
                `Could not locate ${message.logicalPath} in the workspace or runtime directories.`
              );
              break;
            }
            await vscode28.commands.executeCommand("xupra.optimizeFile", uri);
            break;
          }
          case "openRawFile": {
            const uri = await this.resolveLogicalPathUri(message.logicalPath);
            if (!uri) {
              void vscode28.window.showWarningMessage(
                `Could not locate ${message.logicalPath}. The file may have been deleted.`
              );
              break;
            }
            const document = await vscode28.workspace.openTextDocument(uri);
            await vscode28.window.showTextDocument(document, { preview: false });
            break;
          }
        }
        await webviewView.webview.postMessage({
          type: "result",
          requestId: message.requestId
        });
      } catch (error) {
        const outbound = {
          type: "error",
          requestId: message.requestId,
          message: error instanceof Error ? error.message : String(error)
        };
        await webviewView.webview.postMessage(outbound);
      }
    });
    this.postState(this._buildState());
  }
  postState(state) {
    if (!this._view) {
      return;
    }
    const message = { type: "stateUpdate", state };
    void this._view.webview.postMessage(message);
  }
  async resolveLogicalPathUri(logicalPath) {
    const normalized = logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) {
      return null;
    }
    const segments = normalized.split("/").filter(Boolean);
    const root = vscode28.workspace.workspaceFolders?.[0]?.uri;
    if (root) {
      const candidate = vscode28.Uri.joinPath(root, ...segments);
      try {
        await vscode28.workspace.fs.stat(candidate);
        return candidate;
      } catch {
      }
    }
    const homeUri = vscode28.Uri.file(import_node_os4.default.homedir());
    const runtimeCandidates = [];
    if (segments[0] === ".codex" || segments[0] === ".claude" || segments[0] === ".cursor") {
      runtimeCandidates.push(segments);
    } else if (normalized === "AGENTS.md") {
      runtimeCandidates.push([".codex", "AGENTS.md"]);
    } else if (normalized === "CLAUDE.md") {
      runtimeCandidates.push([".claude", "CLAUDE.md"]);
    }
    for (const candidateSegments of runtimeCandidates) {
      const candidate = vscode28.Uri.joinPath(homeUri, ...candidateSegments);
      try {
        await vscode28.workspace.fs.stat(candidate);
        return candidate;
      } catch {
      }
    }
    const versionId = this.stateStore.getSelection().versionId;
    if (versionId) {
      return vscode28.Uri.from({
        scheme: "xupra-imported",
        authority: versionId,
        path: "/" + normalized
      });
    }
    return null;
  }
  _buildState() {
    const connection = this.stateStore.getConnection();
    const detectedFiles = this.stateStore.getDetectedFiles();
    const selection = this.stateStore.getSelection();
    const planningProvider = this.stateStore.getPlanningProvider();
    return {
      connected: Boolean(connection.userEmail),
      userEmail: connection.userEmail,
      userAvatarUrl: connection.userAvatarUrl,
      orgName: connection.organizationName,
      orgTier: connection.organizationTier,
      entitlements: connection.entitlements,
      detectedFiles,
      importedWorkspace: null,
      selection,
      runbook: {
        sessionName: this.stateStore.getBuildSession()?.id,
        approvalStatus: "No runbook",
        providerStatus: planningProvider?.label ?? "User IDE AI / External AI Prompt",
        generatedFiles: []
      },
      isLoading: false
    };
  }
  _getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    button {
      font: inherit;
      color: var(--vscode-foreground);
    }

    button:disabled {
      cursor: default;
      opacity: 0.65;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 12px;
    }

    .account-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      border-radius: 50%;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font-weight: 700;
      text-transform: uppercase;
      overflow: hidden;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      grid-area: 1 / 1;
    }

    .avatar-initial {
      grid-area: 1 / 1;
    }

    .account-info {
      min-width: 0;
      flex: 1;
    }

    .account-email {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .account-org {
      margin-top: 2px;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.92em;
    }

    .plan-badge {
      flex: 0 0 auto;
      padding: 2px 7px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-size: 0.85em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .plan-badge.pro {
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      border-color: var(--vscode-badge-background);
    }

    .upgrade-btn {
      width: 100%;
      margin-top: 8px;
      padding: 6px 9px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 4px;
      cursor: pointer;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 2px;
    }

    details.disclosure {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }

    details.disclosure > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      color: var(--vscode-foreground);
      cursor: pointer;
      list-style: none;
      font-weight: 650;
    }

    details.disclosure > summary::-webkit-details-marker {
      display: none;
    }

    .disclosure-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0 10px 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 22px;
    }

    .section-label {
      font-weight: 650;
    }

    .section-count {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      background: var(--vscode-editor-background);
    }

    .file-button {
      width: 100%;
      text-align: left;
      cursor: pointer;
      color: var(--vscode-foreground);
      font: inherit;
    }

    .item-trash {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      padding: 0;
      margin-left: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
    }

    .item-trash:hover {
      color: var(--vscode-errorForeground, var(--vscode-foreground));
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
      border-color: var(--vscode-panel-border);
    }

    .item-optimize {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #ffffff;
      background: #E85420;
      border: 1px solid #C24315;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      padding: 5px 9px;
      white-space: nowrap;
      cursor: pointer;
      align-self: flex-start;
      margin: 4px 8px 8px 8px;
    }

    .item-optimize:hover {
      background: #FF6A36;
      border-color: #E85420;
      color: #ffffff;
    }

    .item-optimize .optimize-mark {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      object-fit: cover;
      display: inline-block;
    }

    .file-path {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-tag {
      flex: 0 0 auto;
      padding: 1px 5px;
      border-radius: 999px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 0.8em;
    }

    .file-group {
      margin-bottom: 6px;
    }

    .file-group-header {
      color: var(--vscode-descriptionForeground);
      font-size: 0.82em;
      letter-spacing: 0.04em;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    .item-stack {
      display: flex;
      min-width: 0;
      flex: 1;
      flex-direction: column;
      gap: 2px;
    }

    .item-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
    }

    .item-meta {
      min-width: 0;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.82em;
    }

    .selection-hint {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .action-row {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      color: var(--vscode-foreground);
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      cursor: pointer;
    }

    .action-btn.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
    }

    .group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      background: var(--vscode-editor-background);
    }

    .group-label {
      font-weight: 500;
    }

    .platform-tags {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .group-count {
      color: var(--vscode-descriptionForeground);
    }

    .session-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }

    .session-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }

    .session-meta, .phase-row {
      color: var(--vscode-descriptionForeground);
      font-size: 0.88em;
      line-height: 1.35;
    }

    .phase-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding-top: 7px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .phase-agent {
      color: var(--vscode-button-background);
      white-space: nowrap;
    }

    .actions-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .big-action {
      width: 100%;
      min-height: 34px;
      padding: 8px 10px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      cursor: pointer;
      text-align: left;
    }

    .big-action.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
    }

    .big-action.locked {
      color: var(--vscode-descriptionForeground);
    }

    .lock-icon {
      float: right;
      color: var(--vscode-descriptionForeground);
    }

    .connect-cta {
      display: flex;
      min-height: 180px;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      padding: 18px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
      text-align: center;
    }

    .connect-title {
      font-weight: 700;
      font-size: 1.08em;
    }

    .connect-subtitle {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .empty-state {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .more-line {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const vscode = acquireVsCodeApi();
    const XUPRA_MARK_DATA_URI = ${JSON.stringify(XUPRA_MARK_DATA_URI)};

    function uuid() {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }

    const categoryTags = {
      instruction: "Instructions",
      skill: "Skills",
      subagent: "Agents",
      rule: "Rules",
      agent_config: "Config",
      source: "Source"
    };
    let latestState = { connected: false, detectedFiles: [], importedWorkspace: null, selection: {}, isLoading: true };
    let pendingAction = null;

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function accountInitial(email) {
      return escapeHtml((email || "X").slice(0, 1));
    }

    function renderAvatar(state) {
      const imageUrl = state.userAvatarUrl ? String(state.userAvatarUrl) : "";
      if (!imageUrl) {
        return '<div class="avatar"><span class="avatar-initial">' + accountInitial(state.userEmail) + '</span></div>';
      }

      return '<div class="avatar"><span class="avatar-initial">' + accountInitial(state.userEmail) + '</span><img src="' + escapeHtml(imageUrl) + '" alt="" onerror="this.remove()"></div>';
    }

    function planClass(tier) {
      const normalized = String(tier || "free").toLowerCase();
      return normalized === "pro" || normalized === "enterprise" ? "plan-badge pro" : "plan-badge";
    }

    function renderDetectedFiles(state) {
      const files = Array.isArray(state.detectedFiles) ? state.detectedFiles : [];
      const count = files.length;
      let html = '<details class="disclosure"><summary><span>Detected Agent Files</span><span class="section-count">' + count + '</span></summary><div class="disclosure-body">';

      if (count === 0) {
        html += '<div class="empty-state">No supported files detected yet.</div>';
        return html + '</div></details>';
      }

      const categoryOrder = ["instruction", "skill", "subagent", "rule", "agent_config", "source"];
      const groupedFiles = files.reduce(function(groups, file) {
        const category = file.category;
        if (!groups[category]) {
          groups[category] = [];
        }

        groups[category].push(file);
        return groups;
      }, {});

      categoryOrder.forEach(function(category) {
        const groupFiles = groupedFiles[category] || [];
        if (groupFiles.length === 0) {
          return;
        }

        const label = categoryTags[category] || "Files";
        html += '<div class="file-group">';
        html += '<div class="file-group-header">&#9472;&#9472; ' + escapeHtml(label) + ' (' + groupFiles.length + ') &#9472;&#9472;</div>';
        html += groupFiles.map(function(file) {
          return '<div class="file-item"><span class="file-path" title="' + escapeHtml(file.logicalPath) + '">' + escapeHtml(file.logicalPath) + '</span></div>';
        }).join("");
        html += '</div>';
      });

      return html + '</div></details>';
    }

    function renderBuildSession(state) {
      const runbook = state.runbook || {};
      let html = '<div class="section"><div class="section-header"><span class="section-label">BUILD SESSION</span></div>';

      if (!runbook.path && !runbook.sessionName) {
        html += '<div class="session-card"><div class="session-name">No active Build Session</div><div class="session-meta">Paste a ticket, bug, or feature request to create a guided coding plan.</div><button class="big-action primary" data-action="startBuildSession">Start Build Session</button></div></div>';
        return html;
      }

      const sessionName = runbook.sessionName || runbook.path || 'drylake.xu';
      const status = runbook.status || runbook.approvalStatus || 'draft';
      const phaseLabel = runbook.activePhaseId ? runbook.activePhaseId + (runbook.activePhaseTitle ? ': ' + runbook.activePhaseTitle : '') : (runbook.phase || 'none');
      html += '<div class="session-card">';
      html += '<div class="session-name" title="' + escapeHtml(sessionName) + '">' + escapeHtml(sessionName) + '</div>';
      html += '<div class="session-meta">' + escapeHtml(status) + ' \xB7 ' + escapeHtml(runbook.path || 'drylake.xu') + ' \xB7 ' + escapeHtml(runbook.providerStatus || 'User IDE AI / External AI Prompt') + '</div>';
      html += '<div class="phase-row"><span>Active phase: ' + escapeHtml(phaseLabel) + '</span><span class="phase-agent">' + escapeHtml(runbook.activePhaseAgent || 'session default') + '</span></div>';
      html += '<div class="action-row"><button class="action-btn primary" data-action="openControlRoom">Open Control Room</button><button class="action-btn" data-action="exportHandoffPrompt">Run Next Phase</button></div>';
      html += '<button class="big-action" data-action="startBuildSession">Start New Session</button>';
      html += '</div></div>';
      return html;
    }

    function formatPlatform(slug) {
      const labels = {
        claude_code: "Claude Code",
        claude_agents: "Claude Agents",
        codex: "Codex",
        cursor: "Cursor",
        windsurf: "Windsurf",
        cline: "Cline",
        roo: "Roo Code",
        copilot: "GitHub Copilot",
        gemini: "Gemini CLI",
        junie: "JetBrains Junie",
        warp: "Warp",
        generic: "Generic"
      };
      const normalized = String(slug || "");
      return labels[normalized] || (normalized ? normalized.slice(0, 1).toUpperCase() + normalized.slice(1) : "");
    }

    function renderPlatformTags(platforms) {
      const visiblePlatforms = (Array.isArray(platforms) ? platforms : []).filter(function(platform) {
        return platform && String(platform).toLowerCase() !== "generic";
      });

      if (visiblePlatforms.length === 0) {
        return "";
      }

      return '<span class="platform-tags">' + visiblePlatforms.map(function(platform) {
        return '<span class="file-tag">' + escapeHtml(formatPlatform(platform)) + '</span>';
      }).join("") + '</span>';
    }

    function uniquePlatforms(items, readPlatform) {
      const seen = new Set();
      return items.reduce(function(platforms, item) {
        const platform = String(readPlatform(item) || "").toLowerCase();

        if (!platform || platform === "generic" || seen.has(platform)) {
          return platforms;
        }

        seen.add(platform);
        platforms.push(platform);
        return platforms;
      }, []);
    }

    function renderImportedEntries(entries, options) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return "";
      }

      const limit = options.limit || 5;
      const visibleEntries = entries.slice(0, limit);
      const platforms = uniquePlatforms(entries, options.readPlatform);
      let html = '<div class="file-group">';
      html += '<div class="section-header"><span class="section-label">' + escapeHtml(options.label) + '</span><span class="section-count">' + entries.length + '</span></div>';

      if (platforms.length > 0) {
        html += renderPlatformTags(platforms);
      }

      html += visibleEntries.map(function(entry) {
        const title = options.readTitle(entry);
        const meta = options.readMeta(entry);
        const tag = options.readTag(entry);
        const openId = options.readId ? options.readId(entry) : "";
        const optimizePath = options.readOptimizePath ? options.readOptimizePath(entry) : "";
        const itemHtml = '<div class="item-stack"><span class="item-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>' + (meta ? '<span class="item-meta" title="' + escapeHtml(meta) + '">' + escapeHtml(meta) + '</span>' : '') + '</div>' + (tag ? '<span class="file-tag">' + escapeHtml(tag) + '</span>' : '');
        const optimizeHtml = optimizePath
          ? '<button type="button" class="item-optimize" title="Optimize with Xupra AI (Pro)" data-optimize-path="' + escapeHtml(optimizePath) + '" aria-label="Improve with Xupra AI">' + (XUPRA_MARK_DATA_URI ? '<img class="optimize-mark" src="' + XUPRA_MARK_DATA_URI + '" alt="" />' : '') + '<span>improve w/ Xupra AI</span></button>'
          : '';

        if (options.actionType === 'openImportedSkill' && openId) {
          const trashHtml = '<button type="button" class="item-trash" title="Uninstall (delete runtime file)" data-uninstall-imported-skill-id="' + escapeHtml(openId) + '" aria-label="Uninstall imported skill">\u{1F5D1}</button>';
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><div style="display:flex;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-imported-skill-id="' + escapeHtml(openId) + '">' + itemHtml + '</button>' + trashHtml + '</div>' + optimizeHtml + '</div>';
        }

        if (options.actionType === 'openImportedAgent' && openId) {
          const trashHtml = '<button type="button" class="item-trash" title="Uninstall (delete runtime file)" data-uninstall-imported-agent-id="' + escapeHtml(openId) + '" aria-label="Uninstall imported agent">\u{1F5D1}</button>';
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><div style="display:flex;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-imported-agent-id="' + escapeHtml(openId) + '">' + itemHtml + '</button>' + trashHtml + '</div>' + optimizeHtml + '</div>';
        }

        if (options.actionType === 'openRawFile' && optimizePath) {
          return '<div class="file-item" style="padding:0;border:none;background:transparent;display:flex;flex-direction:column;align-items:stretch;gap:0;"><button type="button" class="file-item file-button" style="flex:1;min-width:0;" data-open-raw-path="' + escapeHtml(optimizePath) + '">' + itemHtml + '</button>' + optimizeHtml + '</div>';
        }

        return '<div class="file-item">' + itemHtml + '</div>';
      }).join("");

      if (entries.length > visibleEntries.length) {
        html += '<div class="more-line">+' + (entries.length - visibleEntries.length) + ' more</div>';
      }

      return html + '</div>';
    }

    function renderImportedWorkspace(state) {
      const workspace = state.importedWorkspace;
      let html = '<div class="section"><div class="section-header"><span class="section-label">Imported skills &amp; agents</span></div>';

      if (!workspace) {
        if (!state.selection || !state.selection.versionId) {
          html += '<div class="selection-hint">Choose a target version, then import a workspace to review imported agents, skills, rules, and source files.</div>';
        } else {
          html += '<div class="empty-state">No imported workspace is loaded for the selected version yet. Run an import or refresh after the import job completes.</div>';
        }
        return html + '</div>';
      }

      const skills = (workspace.skillRules || []).filter(function(rule) {
        return String(rule.kind || "").toLowerCase() === "skill";
      });
      const rules = (workspace.skillRules || []).filter(function(rule) {
        return String(rule.kind || "").toLowerCase() === "rule";
      });
      const promptFragments = (workspace.skillRules || []).filter(function(rule) {
        const kind = String(rule.kind || "").toLowerCase();
        return kind && kind !== "skill" && kind !== "rule";
      });

      if ((workspace.subagents || []).length === 0 && skills.length === 0 && rules.length === 0 && promptFragments.length === 0 && (workspace.files || []).length === 0) {
        html += '<div class="empty-state">The selected version has no imported agents, skills, rules, or raw files yet.</div>';
        return html + '</div>';
      }

      html += renderImportedEntries(workspace.subagents || [], {
        label: 'Agents',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || entry.slug || 'Imported agent'; },
        readMeta: function(entry) { return entry.sourcePath || entry.slug || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readId: function(entry) { return entry.id || ''; },
        readOptimizePath: function(entry) { return entry.sourcePath || ''; },
        actionType: 'openImportedAgent',
      });

      html += renderImportedEntries(skills, {
        label: 'Skills',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported skill'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readId: function(entry) { return entry.id || ''; },
        readOptimizePath: function(entry) { return entry.sourcePath || ''; },
        actionType: 'openImportedSkill',
      });

      html += renderImportedEntries(rules, {
        label: 'Rules',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported rule'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
      });

      html += renderImportedEntries(promptFragments, {
        label: 'Prompt Fragments',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.name || 'Imported prompt'; },
        readMeta: function(entry) { return entry.sourcePath || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
      });

      html += renderImportedEntries(workspace.files || [], {
        label: 'Raw Files',
        readPlatform: function(entry) { return entry.sourcePlatform; },
        readTitle: function(entry) { return entry.logicalPath || 'Raw file'; },
        readMeta: function(entry) { return entry.sourceFormat || ''; },
        readTag: function(entry) { return formatPlatform(entry.sourcePlatform); },
        readOptimizePath: function(entry) { return entry.logicalPath || ''; },
        actionType: 'openRawFile',
      });

      return html + '</div>';
    }

    function renderActions(state) {
      const tier = String(state.orgTier || "").toLowerCase();
      const isPro = tier === "pro" || tier === "enterprise";
      const exportClass = isPro ? "big-action" : "big-action locked";
      const lockSuffix = '<span class="lock-icon">\u{1F512} Pro</span>';

      return '<details class="disclosure"><summary><span>Advanced</span><span class="section-count">tools</span></summary><div class="disclosure-body actions-section">'
        + '<button class="big-action" data-action="importWorkspace">Import Agent Configs</button>'
        + '<button class="big-action" data-action="importDefaultLocations">Import Default Agent Configs</button>'
        + '<button class="big-action" data-action="importFolder">Import Agent Configs From Folder</button>'
        + '<button class="big-action" data-action="checkCompatibility">Validate Agent Configs</button>'
        + '<button class="' + exportClass + '" data-action="exportPreview">Preview Agent Config Changes' + (isPro ? "" : lockSuffix) + '</button>'
        + '<button class="' + exportClass + '" data-action="installToRuntime">Sync Agent Configs' + (isPro ? "" : lockSuffix) + '</button>'
        + '<button class="big-action" data-action="pullPackage">Pull Generated Agent Files</button>'
        + '<button class="big-action" data-action="generateAgentFiles">Preview Build Session Files</button>'
        + '<button class="big-action" data-action="validateXuRunbook">Validate drylake.xu</button>'
        + renderImportedWorkspace(state)
        + '</div></details>';
    }

    function renderConnected(state) {
      const tier = state.orgTier || "free";
      const org = state.orgName || "Xupra";
      let html = '<div class="panel">';
      html += renderBuildSession(state);
      html += '<div><div class="account-bar">' + renderAvatar(state) + '<div class="account-info"><div class="account-email">' + escapeHtml(state.userEmail || "") + '</div><div class="account-org">' + escapeHtml(org) + '</div></div><button class="' + planClass(tier) + '" data-action="refreshPlan">' + escapeHtml(tier) + '</button></div>';
      if (String(tier).toLowerCase() !== "pro" && String(tier).toLowerCase() !== "enterprise") {
        html += '<button class="upgrade-btn" data-action="openBilling">Upgrade</button>';
      }
      html += '</div>';
      html += renderDetectedFiles(state);
      html += renderActions(state);
      html += '<div class="action-row"><button class="action-btn" data-action="openDashboard">Dashboard</button><button class="action-btn" data-action="openSettings">Settings</button><button class="action-btn" data-action="signOut">Sign Out</button></div>';
      html += '</div>';
      return html;
    }

    function renderDisconnected(state) {
      const loading = state && state.isLoading ? "Loading workspace..." : "Connect Xupra for Pro AI. Local runbooks work without an account.";
      let html = '<div class="panel">';
      html += renderBuildSession(state || {});
      html += '<div class="section"><div class="section-header"><span class="section-label">XUPRA ACCOUNT</span></div><div class="connect-cta"><div class="connect-title">Signed out</div><div class="connect-subtitle">' + escapeHtml(loading) + '</div><button class="action-btn" data-action="connect">Connect Xupra for Pro AI</button></div></div>';
      html += renderDetectedFiles(state || {});
      html += renderActions(state || {});
      html += '</div>';
      return html;
    }

    function render(state) {
      const root = document.getElementById("root");
      if (!root) {
        return;
      }

      latestState = state || latestState;
      root.innerHTML = state && state.connected ? renderConnected(state) : renderDisconnected(state || {});
    }

    window.addEventListener("message", function(event) {
      if (event.data.type === "stateUpdate") {
        render(event.data.state);
      }

      if (event.data.type === "result" || event.data.type === "error") {
        pendingAction = null;
        render(latestState);
      }
    });

    document.addEventListener("click", function(event) {
      const optimizeBtn = event.target.closest("[data-optimize-path]");
      if (optimizeBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "optimizeFile",
          requestId: uuid(),
          logicalPath: optimizeBtn.dataset.optimizePath,
        });
        return;
      }

      const uninstallAgentBtn = event.target.closest("[data-uninstall-imported-agent-id]");
      if (uninstallAgentBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "uninstallImportedAgent",
          requestId: uuid(),
          subagentId: uninstallAgentBtn.dataset.uninstallImportedAgentId,
        });
        return;
      }

      const uninstallSkillBtn = event.target.closest("[data-uninstall-imported-skill-id]");
      if (uninstallSkillBtn) {
        event.stopPropagation();
        vscode.postMessage({
          type: "uninstallImportedSkill",
          requestId: uuid(),
          skillRuleId: uninstallSkillBtn.dataset.uninstallImportedSkillId,
        });
        return;
      }

      const rawFileBtn = event.target.closest("[data-open-raw-path]");
      if (rawFileBtn) {
        vscode.postMessage({
          type: "openRawFile",
          requestId: uuid(),
          logicalPath: rawFileBtn.dataset.openRawPath,
        });
        return;
      }

      const agentBtn = event.target.closest("[data-open-imported-agent-id]");
      if (agentBtn) {
        vscode.postMessage({
          type: "openImportedAgent",
          requestId: uuid(),
          subagentId: agentBtn.dataset.openImportedAgentId,
        });
        return;
      }

      const skillBtn = event.target.closest("[data-open-imported-skill-id]");
      if (skillBtn) {
        vscode.postMessage({
          type: "openImportedSkill",
          requestId: uuid(),
          skillRuleId: skillBtn.dataset.openImportedSkillId,
        });
        return;
      }

      const btn = event.target.closest("[data-action]");
      if (!btn || btn.disabled) {
        return;
      }

      pendingAction = btn.dataset.action;
      render(latestState);
      vscode.postMessage({ type: btn.dataset.action, requestId: uuid() });
    });

    render({ connected: false, detectedFiles: [], importedWorkspace: null, selection: {}, isLoading: true });
  </script>
</body>
</html>`;
  }
};

// src/webview/controlRoomProvider.ts
var vscode29 = __toESM(require("vscode"));
var CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
var MODE_CARDS = [
  ["Build App", "build-app", "Turn an app idea into purpose, architecture, steps, and a ship plan."],
  ["Break Into Steps", "phases", "Clarify intent, then split the task into safe coding steps."],
  ["Create Plan", "plan", "Generate a file-aware plan for a complex repo change."],
  ["Review / Repair", "review", "Review existing code and produce a correction plan."]
];
var AGENT_LABELS = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  cline: "Cline",
  continue: "Continue.dev",
  aider: "Aider",
  windsurf: "Windsurf",
  copilot: "GitHub Copilot",
  "roo-code": "Roo Code",
  "augment-code": "Augment Code",
  "external-ai-prompt": "External AI Prompt"
};
var STATUS_LABELS = {
  pending: "pending",
  active: "active",
  approved: "approved",
  "needs-revision": "needs revision",
  complete: "complete"
};
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
function controlRoomViewFrom(value) {
  return value === "kanban" ? "kanban" : "pipeline";
}
function phaseAgentFrom(value) {
  return typeof value === "string" && XU_PHASE_AGENTS.includes(value) ? value : void 0;
}
function defaultAgent(runbook) {
  return phaseAgentFrom(runbook?.handoff.defaultAgent) ?? "external-ai-prompt";
}
function statusClass(status) {
  return status === "needs-revision" ? "pending" : status;
}
function statusForKanban(status) {
  if (status === "active") {
    return "active";
  }
  if (status === "complete" || status === "approved") {
    return "complete";
  }
  return "pending";
}
function renderAgentSelect(phase, fallbackAgent) {
  const selected = phase.agent ?? fallbackAgent;
  return `<label class="agent-label">Agent<select class="agent-select" data-phase-agent="${escapeHtml(phase.id)}">
    ${XU_PHASE_AGENTS.map((agent) => {
    const isSelected = agent === selected ? " selected" : "";
    return `<option value="${agent}"${isSelected}>${escapeHtml(AGENT_LABELS[agent])}</option>`;
  }).join("")}
  </select></label>`;
}
function renderPhaseSteps(phase) {
  if (phase.steps.length === 0) {
    return `<div class="step-count">No steps yet.</div>`;
  }
  const items = phase.steps.map((step) => {
    const done = step.status === "complete" || step.status === "approved";
    const checked = done ? " checked" : "";
    const stateClass = done ? " done" : "";
    return `<li class="step-item${stateClass}">
        <label>
          <input type="checkbox" class="step-toggle" data-phase-id="${escapeHtml(phase.id)}" data-step-id="${escapeHtml(step.id)}"${checked} />
          <span>${escapeHtml(step.text)}</span>
        </label>
      </li>`;
  }).join("");
  const completed = phase.steps.filter((step) => step.status === "complete" || step.status === "approved").length;
  return `<div class="step-list-wrap">
    <div class="step-count">${completed} / ${phase.steps.length} complete</div>
    <ul class="step-list">${items}</ul>
  </div>`;
}
function renderPhaseCard(phase, fallbackAgent, options) {
  const draggable = options.draggable ? ' draggable="true"' : "";
  const cardClass = `phase-card ${statusClass(phase.status)}${phase.status === "active" ? " active-phase" : ""}`;
  return `<article class="${cardClass}" data-phase-id="${escapeHtml(phase.id)}" data-phase-status="${statusForKanban(phase.status)}"${draggable}>
    <div class="phase-id">${escapeHtml(phase.id)}</div>
    <h3 class="phase-title">${escapeHtml(phase.title)}</h3>
    <span class="badge ${statusClass(phase.status)}">${escapeHtml(STATUS_LABELS[phase.status])}</span>
    <p class="objective" title="${escapeHtml(phase.objective)}">${escapeHtml(phase.objective || "No objective recorded.")}</p>
    ${renderAgentSelect(phase, fallbackAgent)}
    ${renderPhaseSteps(phase)}
    <div class="phase-actions">
      <button class="primary handoff-btn" data-handoff-phase="${escapeHtml(phase.id)}">Handoff to agent</button>
    </div>
  </article>`;
}
function renderPipeline(runbook) {
  const fallbackAgent = defaultAgent(runbook);
  return `<section class="pipeline" aria-label="Build Session pipeline">
    ${runbook.phases.map((phase, index) => {
    const card = renderPhaseCard(phase, fallbackAgent, { draggable: true });
    return index < runbook.phases.length - 1 ? `${card}<div class="arrow" aria-hidden="true">&rarr;</div>` : card;
  }).join("")}
  </section>`;
}
function renderKanbanColumn(title, status, phases, fallbackAgent) {
  return `<section class="kanban-column" data-drop-status="${status}">
    <div class="column-header"><span>${escapeHtml(title)}</span><span class="count">${phases.length}</span></div>
    <div class="column-body">
      ${phases.map((phase) => renderPhaseCard(phase, fallbackAgent, { draggable: true })).join("")}
      <div class="drop-zone">Drop phase here</div>
    </div>
  </section>`;
}
function renderKanban(runbook) {
  const fallbackAgent = defaultAgent(runbook);
  const pending = runbook.phases.filter((phase) => statusForKanban(phase.status) === "pending");
  const active = runbook.phases.filter((phase) => statusForKanban(phase.status) === "active");
  const complete = runbook.phases.filter((phase) => statusForKanban(phase.status) === "complete");
  return `<section class="kanban" aria-label="Build Session kanban">
    ${renderKanbanColumn("To Do", "pending", pending, fallbackAgent)}
    ${renderKanbanColumn("In Progress", "active", active, fallbackAgent)}
    ${renderKanbanColumn("Done", "complete", complete, fallbackAgent)}
  </section>`;
}
function renderEmptyState() {
  return `<section class="empty-state">
    <div class="eyebrow">Build Session</div>
    <h2>Start with a ticket, bug, or feature request.</h2>
    <p>DryLake will turn the task into a clear coding plan you can review and run with your AI tool.</p>
    <div class="prompt-panel">
      <div class="mode-grid">
        ${MODE_CARDS.map(([title, mode, description], index) => `<button class="mode-card${index === 0 ? " selected" : ""}" data-mode="${mode}"><strong>${escapeHtml(title)}</strong>${escapeHtml(description)}</button>`).join("")}
      </div>
      <textarea id="promptText" placeholder="Paste the full task here. Include constraints, must-haves, non-goals, and anything the agent should avoid."></textarea>
      <button id="submitPrompt" class="primary">Start Build Session</button>
    </div>
  </section>`;
}
function renderPlanningProviderBanner(info) {
  if (!info) {
    return "";
  }
  const reason = info.reason ? `<span class="planning-banner-reason">${escapeHtml(info.reason)}</span>` : "";
  const tone = info.id === "external-ai-prompt" ? "fallback" : info.id === "xupra-pro-ai" ? "pro" : "ide";
  return `<section class="planning-banner ${tone}" aria-label="Planning AI">
    <span class="planning-banner-eyebrow">Planning AI</span>
    <strong class="planning-banner-label">${escapeHtml(info.label)}</strong>
    ${reason}
  </section>`;
}
function formatChatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
function renderChatPanel(state, planningProviderLabel) {
  const messages = state.messages.length ? state.messages.map((message) => {
    const roleClass = message.role === "user" ? "user" : message.role === "system" ? "system" : "ai";
    const senderLabel = message.role === "user" ? "You" : message.role === "system" ? "DryLake" : planningProviderLabel;
    return `<div class="chat-message ${roleClass}">
            <div class="chat-meta"><span class="chat-sender">${escapeHtml(senderLabel)}</span><span class="chat-time">${escapeHtml(formatChatTime(message.ts))}</span></div>
            <div class="chat-body">${escapeHtml(message.text).replace(/\n/g, "<br />")}</div>
          </div>`;
  }).join("") : `<div class="chat-empty">Chat with the planning AI here. As you discuss the plan, the kanban below will update.</div>`;
  return `<section class="chat-panel" aria-label="Planning chat">
    <div class="chat-header">
      <span class="chat-eyebrow">Planning Chat</span>
      <button type="button" class="chat-clear secondary" data-command="drylake.clearChat">Clear</button>
    </div>
    <div class="chat-messages" id="chatMessages">${messages}</div>
    <form class="chat-form" id="chatForm">
      <textarea id="chatInput" rows="2" placeholder="Tell the planning AI what you want, or answer its questions. Shift+Enter for a new line."></textarea>
      <div class="chat-form-row">
        <span class="chat-hint muted">Enter to send</span>
        <button type="submit">Send</button>
      </div>
    </form>
  </section>`;
}
var ControlRoomProvider = class {
  constructor(sessionStore, readPlanningProvider = () => null, readChatState = () => ({ messages: [] })) {
    this.sessionStore = sessionStore;
    this.readPlanningProvider = readPlanningProvider;
    this.readChatState = readChatState;
  }
  panel;
  context;
  async createOrShow(context) {
    this.context = context;
    if (this.panel) {
      this.panel.reveal(vscode29.ViewColumn.One);
      await this.refresh();
      return;
    }
    this.panel = vscode29.window.createWebviewPanel(
      "drylake.controlRoom",
      "DryLake Control Room",
      vscode29.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.onDidDispose(() => {
      this.panel = void 0;
    }, null, context.subscriptions);
    this.panel.webview.onDidReceiveMessage(async (message) => {
      if (message.copy) {
        await vscode29.env.clipboard.writeText(message.copy);
        void vscode29.window.showInformationMessage("Copied.");
        return;
      }
      if (message.command === "drylake.setControlRoomView") {
        const view = controlRoomViewFrom(message.view ?? message.args?.[0]);
        await context.workspaceState?.update(CONTROL_ROOM_VIEW_KEY, view);
        await this.refresh();
        return;
      }
      if (message.command === "drylake.updatePhaseAgent") {
        await vscode29.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.agent ?? message.args?.[1]);
        return;
      }
      if (message.command === "drylake.updatePhaseStatus") {
        await vscode29.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.status ?? message.args?.[1]);
        return;
      }
      if (message.command === "drylake.handoffPhase") {
        await vscode29.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0]);
        return;
      }
      if (message.command === "drylake.chatSendMessage") {
        await vscode29.commands.executeCommand(message.command, message.text ?? message.args?.[0]);
        return;
      }
      if (message.command === "drylake.clearChat") {
        await vscode29.commands.executeCommand(message.command);
        return;
      }
      if (message.command === "drylake.toggleStep") {
        await vscode29.commands.executeCommand(
          message.command,
          message.phaseId ?? message.args?.[0],
          message.stepId ?? message.args?.[1],
          message.status ?? message.args?.[2]
        );
        return;
      }
      if (message.command === "drylake.reorderPhase") {
        await vscode29.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.afterPhaseId ?? message.args?.[1] ?? null);
        return;
      }
      if (message.command) {
        await vscode29.commands.executeCommand(message.command, ...message.args ?? []);
      }
    });
    await this.refresh();
  }
  async refresh() {
    if (!this.panel) {
      return;
    }
    let runbook = null;
    try {
      runbook = (await this.sessionStore.readRunbook())?.runbook ?? null;
    } catch {
      runbook = null;
    }
    this.panel.webview.html = this.renderHtml(runbook);
  }
  currentView() {
    return controlRoomViewFrom(this.context?.workspaceState?.get(CONTROL_ROOM_VIEW_KEY));
  }
  renderHtml(runbook) {
    const view = this.currentView();
    const planningProvider = this.readPlanningProvider();
    const banner = renderPlanningProviderBanner(planningProvider);
    const chatState = this.readChatState();
    const planningProviderLabel = planningProvider?.label ?? "Planning AI";
    const chatPanel = renderChatPanel(chatState, planningProviderLabel);
    const body = runbook ? view === "kanban" ? renderKanban(runbook) : renderPipeline(runbook) : renderEmptyState();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 8px 0; font-size: 20px; }
    h3, p { margin: 0; }
    button, select, textarea { font: inherit; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid var(--vscode-button-background); border-radius: 4px; padding: 7px 11px; cursor: pointer; }
    button.secondary, .toggle-btn { color: var(--vscode-foreground); background: var(--vscode-editor-background); border-color: var(--vscode-panel-border); }
    .eyebrow { color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; }
    .muted { color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .actions, .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggle-btn.active { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: var(--vscode-button-background); }
    .pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 10px; }
    .arrow { display: flex; align-items: center; padding: 0 8px; color: var(--vscode-descriptionForeground); font-size: 18px; flex: 0 0 auto; }
    .phase-card { min-width: 190px; max-width: 220px; flex: 0 0 210px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .phase-card.active, .phase-card.active-phase { border-color: var(--vscode-button-background); }
    .phase-card.approved, .phase-card.complete { border-color: var(--vscode-testing-iconPassed, #4ec9b0); }
    .phase-card.complete { opacity: 0.78; }
    .phase-card[draggable="true"] { cursor: grab; }
    .phase-card.dragging { opacity: 0.5; border-style: dashed; }
    .pipeline .phase-card.drop-before { border-left: 4px solid var(--vscode-button-background); }
    .pipeline .phase-card.drop-after { border-right: 4px solid var(--vscode-button-background); }
    .kanban .phase-card.drop-before { border-top: 4px solid var(--vscode-button-background); }
    .kanban .phase-card.drop-after { border-bottom: 4px solid var(--vscode-button-background); }
    .phase-id { color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
    .phase-title { margin: 5px 0 8px; font-size: 13px; line-height: 1.25; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border: 1px solid var(--vscode-panel-border); border-radius: 999px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .badge.active { border-color: var(--vscode-button-background); color: var(--vscode-button-background); }
    .badge.approved, .badge.complete { border-color: var(--vscode-testing-iconPassed, #4ec9b0); color: var(--vscode-testing-iconPassed, #4ec9b0); }
    .objective { min-height: 32px; margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .agent-label { display: block; color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
    .agent-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border)); border-radius: 4px; font-size: 11px; }
    .step-count { margin-top: 8px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border-radius: 999px; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; margin-bottom: 8px; }
    .drop-zone { padding: 10px; border: 1px dashed var(--vscode-panel-border); border-radius: 6px; color: var(--vscode-descriptionForeground); text-align: center; font-size: 11px; }
    .kanban-column.drag-over .drop-zone { border-color: var(--vscode-button-background); color: var(--vscode-button-background); }
    .empty-state { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 18px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .prompt-panel { margin-top: 14px; display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 170px; resize: vertical; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 12px; line-height: 1.45; }
    .mode-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .mode-card { min-height: 92px; color: var(--vscode-foreground); background: var(--vscode-editor-background); border-color: var(--vscode-panel-border); text-align: left; }
    .mode-card.selected { border-color: var(--vscode-button-background); }
    .mode-card strong { display: block; margin-bottom: 6px; }
    .planning-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin: 0 0 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); font-size: 12px; }
    .planning-banner.pro { border-color: var(--vscode-button-background); }
    .planning-banner.fallback { border-color: var(--vscode-editorWarning-foreground, var(--vscode-panel-border)); }
    .planning-banner-eyebrow { color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 10px; letter-spacing: 0.14em; }
    .planning-banner-label { color: var(--vscode-foreground); }
    .planning-banner-reason { color: var(--vscode-descriptionForeground); flex-basis: 100%; }
    .step-list-wrap { margin-top: 8px; }
    .step-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
    .step-item label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 12px; line-height: 1.4; color: var(--vscode-foreground); }
    .step-item input[type="checkbox"] { margin-top: 2px; }
    .step-item.done span { text-decoration: line-through; color: var(--vscode-descriptionForeground); }
    .phase-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
    .handoff-btn { font-size: 12px; padding: 6px 10px; }
    .chat-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; margin: 0 0 18px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); }
    .chat-header { display: flex; align-items: center; justify-content: space-between; }
    .chat-eyebrow { color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 10px; letter-spacing: 0.14em; }
    .chat-clear { padding: 4px 8px; font-size: 11px; }
    .chat-messages { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
    .chat-message { padding: 8px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); }
    .chat-message.user { border-color: var(--vscode-button-background); }
    .chat-message.system { border-style: dashed; opacity: 0.85; }
    .chat-meta { display: flex; justify-content: space-between; color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .chat-body { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .chat-empty { padding: 8px 4px; color: var(--vscode-descriptionForeground); font-size: 12px; }
    .chat-form textarea { min-height: 56px; }
    .chat-form-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
    .chat-hint { font-size: 11px; }
    @media (max-width: 860px) { header { flex-direction: column; } .kanban, .mode-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">DryLake Build Session</div>
        <h1>DryLake Control Room</h1>
        <p class="muted">Plan the work, assign the right AI tool, and move each coding step toward validation.</p>
      </div>
      <div class="actions">
        <div class="toggle-group" role="group" aria-label="Control Room view">
          <button class="toggle-btn${view === "pipeline" ? " active" : ""}" data-view="pipeline">Pipeline</button>
          <button class="toggle-btn${view === "kanban" ? " active" : ""}" data-view="kanban">Kanban</button>
        </div>
        <button class="secondary" data-command="drylake.runNextPhase">Run Next Phase</button>
      </div>
    </header>
    ${banner}
    ${chatPanel}
    ${body}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    let selectedMode = "build-app";

    const chatMessagesEl = document.getElementById("chatMessages");
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    function sendChat() {
      if (!chatInput) {
        return;
      }
      const text = chatInput.value.trim();
      if (!text) {
        return;
      }
      vscode.postMessage({ command: "drylake.chatSendMessage", text: text });
      chatInput.value = "";
    }
    chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChat();
    });
    chatInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChat();
      }
    });

    function clearDropIndicators() {
      document.querySelectorAll(".drag-over, .drop-before, .drop-after").forEach((item) => {
        item.classList.remove("drag-over", "drop-before", "drop-after");
      });
    }

    function insertionSide(card, event, orientation) {
      const rect = card.getBoundingClientRect();
      if (orientation === "horizontal") {
        return event.clientX < rect.left + rect.width / 2 ? "before" : "after";
      }

      return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    }

    function previousPhaseId(card) {
      let previous = card.previousElementSibling;
      while (previous && !previous.matches(".phase-card[data-phase-id]")) {
        previous = previous.previousElementSibling;
      }

      return previous?.dataset.phaseId || null;
    }

    function afterPhaseIdForCardDrop(card, event, orientation) {
      return insertionSide(card, event, orientation) === "before" ? previousPhaseId(card) : card.dataset.phaseId;
    }

    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        vscode.postMessage({ command: "drylake.setControlRoomView", view: viewButton.dataset.view });
        return;
      }

      const modeCard = event.target.closest(".mode-card[data-mode]");
      if (modeCard) {
        selectedMode = modeCard.dataset.mode || "build-app";
        document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("selected", card === modeCard));
        document.getElementById("promptText")?.focus();
        return;
      }

      const commandEl = event.target.closest("[data-command]");
      if (commandEl) {
        vscode.postMessage({ command: commandEl.dataset.command, args: [] });
        return;
      }

      const handoffBtn = event.target.closest("[data-handoff-phase]");
      if (handoffBtn) {
        vscode.postMessage({ command: "drylake.handoffPhase", phaseId: handoffBtn.dataset.handoffPhase });
      }
    });

    document.addEventListener("change", (event) => {
      const select = event.target.closest("[data-phase-agent]");
      if (select) {
        vscode.postMessage({
          command: "drylake.updatePhaseAgent",
          phaseId: select.dataset.phaseAgent,
          agent: select.value
        });
        return;
      }

      const stepToggle = event.target.closest(".step-toggle");
      if (stepToggle) {
        vscode.postMessage({
          command: "drylake.toggleStep",
          phaseId: stepToggle.dataset.phaseId,
          stepId: stepToggle.dataset.stepId,
          status: stepToggle.checked ? "complete" : "pending",
        });
      }
    });

    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".phase-card[draggable='true']");
      if (!card) {
        return;
      }

      card.classList.add("dragging");
      event.dataTransfer.setData("text/plain", card.dataset.phaseId || "");
      event.dataTransfer.setData("application/x-drylake-phase-status", card.dataset.phaseStatus || "");
      event.dataTransfer.effectAllowed = "move";
    });

    document.addEventListener("dragend", (event) => {
      event.target.closest(".phase-card")?.classList.remove("dragging");
      clearDropIndicators();
    });

    document.addEventListener("dragover", (event) => {
      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.classList.contains("dragging")) {
        event.preventDefault();
        clearDropIndicators();
        const orientation = card.closest(".pipeline") ? "horizontal" : "vertical";
        card.classList.add(insertionSide(card, event, orientation) === "before" ? "drop-before" : "drop-after");
        return;
      }

      const column = event.target.closest("[data-drop-status]");
      if (!column) {
        return;
      }

      event.preventDefault();
      clearDropIndicators();
      column.classList.add("drag-over");
    });

    document.addEventListener("dragleave", (event) => {
      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.contains(event.relatedTarget)) {
        card.classList.remove("drop-before", "drop-after");
      }

      const column = event.target.closest("[data-drop-status]");
      if (column && !column.contains(event.relatedTarget)) {
        column.classList.remove("drag-over");
      }
    });

    document.addEventListener("drop", (event) => {
      const phaseId = event.dataTransfer.getData("text/plain");
      if (!phaseId) {
        return;
      }

      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.classList.contains("dragging")) {
        event.preventDefault();
        const pipeline = card.closest(".pipeline");
        const column = card.closest("[data-drop-status]");
        const draggedStatus = event.dataTransfer.getData("application/x-drylake-phase-status");

        if (pipeline || (column && draggedStatus === column.dataset.dropStatus)) {
          const orientation = pipeline ? "horizontal" : "vertical";
          vscode.postMessage({ command: "drylake.reorderPhase", phaseId, afterPhaseId: afterPhaseIdForCardDrop(card, event, orientation) });
          clearDropIndicators();
          return;
        }

        if (column) {
          vscode.postMessage({ command: "drylake.updatePhaseStatus", phaseId, status: column.dataset.dropStatus });
          clearDropIndicators();
          return;
        }
      }

      const column = event.target.closest("[data-drop-status]");
      if (!column) {
        return;
      }

      event.preventDefault();
      clearDropIndicators();

      vscode.postMessage({ command: "drylake.updatePhaseStatus", phaseId, status: column.dataset.dropStatus });
    });

    document.getElementById("submitPrompt")?.addEventListener("click", () => {
      const prompt = document.getElementById("promptText")?.value.trim() || "";
      if (!prompt) {
        document.getElementById("promptText")?.focus();
        return;
      }

      vscode.postMessage({ command: "drylake.startBuildSession", args: [selectedMode, prompt] });
    });
  </script>
</body>
</html>`;
  }
};

// src/xu/sessionStore.ts
var vscode30 = __toESM(require("vscode"));
var RUNBOOK_CANDIDATES = ["drylake.xu", ".xupra/app.xu", ".drylake/app.xu"];
function timestampId(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}
function workspaceRoot2() {
  const root = vscode30.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake build session.");
  }
  return root;
}
async function exists(uri) {
  try {
    await vscode30.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
async function readUtf8(uri) {
  const bytes = await vscode30.workspace.fs.readFile(uri);
  return new TextDecoder("utf-8").decode(bytes);
}
async function writeUtf82(uri, content) {
  const directoryPath = uri.path.includes("/") ? uri.path.slice(0, uri.path.lastIndexOf("/")) : uri.path;
  const directory = uri.with({ path: directoryPath || "/" });
  await vscode30.workspace.fs.createDirectory(directory);
  await vscode30.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}
var XuSessionStore = class {
  async findRunbookUri() {
    const root = workspaceRoot2();
    for (const candidate of RUNBOOK_CANDIDATES) {
      const uri = vscode30.Uri.joinPath(root, ...candidate.split("/"));
      if (await exists(uri)) {
        return uri;
      }
    }
    return null;
  }
  getDefaultRunbookUri() {
    return vscode30.Uri.joinPath(workspaceRoot2(), "drylake.xu");
  }
  async readRunbook() {
    const uri = await this.findRunbookUri();
    if (!uri) {
      return null;
    }
    const parsed = parseXu(await readUtf8(uri));
    if (!parsed.runbook) {
      throw new Error(parsed.validation.diagnostics.map((item) => item.message).join("\n"));
    }
    return { uri, runbook: parsed.runbook };
  }
  async writeRunbook(uri, runbook) {
    await writeUtf82(uri, renderXu(runbook));
  }
  async ensureRunbook(params) {
    const existing = await this.readRunbook();
    if (existing) {
      return existing;
    }
    const uri = this.getDefaultRunbookUri();
    const runbook = createStarterXu(params);
    await this.writeRunbook(uri, runbook);
    return { uri, runbook };
  }
  async createSession(params) {
    const id = timestampId();
    const session = {
      id,
      mode: params.mode,
      prompt: params.prompt,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      runbookPath: params.runbookPath,
      providerId: params.providerId,
      providerLabel: params.providerLabel
    };
    const uri = vscode30.Uri.joinPath(workspaceRoot2(), ".drylake", "sessions", id, "session.json");
    await writeUtf82(uri, `${JSON.stringify(session, null, 2)}
`);
    return session;
  }
  async writeApproval(type2, runbook) {
    const record = buildApprovalRecord({ type: type2, runbook });
    const uri = vscode30.Uri.joinPath(
      workspaceRoot2(),
      ".drylake",
      "approvals",
      `${timestampId(new Date(record.approvedAt))}-${type2}.json`
    );
    await writeUtf82(uri, `${JSON.stringify(record, null, 2)}
`);
    return record;
  }
};

// src/extension.ts
var DEFAULT_BASE_URL2 = "https://drylake.xupracorp.com";
var LEGACY_BASE_URL_HOSTS = /* @__PURE__ */ new Set(["52.196.86.96"]);
var SOURCE_PLATFORM_ALIASES = {
  claude: "claude_code"
};
function asRecord2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
function formatTierLabel(tier) {
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase() : "Free";
}
function inferSourcePlatformFromPath(logicalPath) {
  if (!logicalPath) {
    return "generic";
  }
  const normalized = logicalPath.replace(/\\/g, "/").toLowerCase();
  if (normalized === "claude.md" || normalized.startsWith(".claude/")) {
    return "claude_code";
  }
  if (normalized === "agents.md" || normalized.startsWith(".codex/") || normalized.startsWith(".agents/")) {
    return "codex";
  }
  if (normalized.startsWith(".cursor/")) {
    return "cursor";
  }
  if (normalized.startsWith(".windsurf/")) {
    return "windsurf";
  }
  if (normalized === ".clinerules" || normalized.startsWith(".clinerules/")) {
    return "cline";
  }
  if (normalized === ".roorules" || normalized.startsWith(".roo/")) {
    return "roo";
  }
  if (normalized === ".github/copilot-instructions.md" || normalized.startsWith(".github/instructions/")) {
    return "copilot";
  }
  if (normalized === "gemini.md") {
    return "gemini";
  }
  if (normalized === ".junie/guidelines.md") {
    return "junie";
  }
  if (normalized === "warp.md") {
    return "warp";
  }
  if (normalized === ".rules") {
    return "generic";
  }
  return "generic";
}
function normalizeSourcePlatform(platform, sourcePath) {
  if (typeof platform === "string" && platform.trim()) {
    const normalized = platform.trim().toLowerCase();
    return SOURCE_PLATFORM_ALIASES[normalized] ?? normalized;
  }
  return inferSourcePlatformFromPath(sourcePath);
}
function stringifyFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return `[${value.filter((item) => item !== void 0 && item !== null).map((item) => stringifyFrontmatterValue(item)).join(", ")}]`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '\\"')}"`;
}
function stringifyFrontmatterMarkdown(frontmatter, body) {
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== void 0 && value !== null);
  const trimmedBody = body.trim();
  if (entries.length === 0) {
    return trimmedBody;
  }
  return [
    "---",
    ...entries.map(([key, value]) => `${key}: ${stringifyFrontmatterValue(value)}`),
    "---",
    "",
    trimmedBody
  ].join("\n");
}
function buildImportedSkillSourceContent(rule) {
  const metadata = asRecord2(rule.metadataJson);
  const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : void 0;
  const storedFrontmatter = asRecord2(metadata?.frontmatter);
  const body = typeof rule.bodyMd === "string" ? rule.bodyMd : "";
  if (storedFrontmatter) {
    return stringifyFrontmatterMarkdown(storedFrontmatter, body);
  }
  const fallbackFrontmatter = {
    name: rule.name,
    targetPlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath)
  };
  if (typeof metadata?.description === "string" && metadata.description.trim()) {
    fallbackFrontmatter.description = metadata.description;
  }
  return stringifyFrontmatterMarkdown(fallbackFrontmatter, body);
}
function readStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function stringifyCodexAgentToml(subagent) {
  const metadata = asRecord2(subagent.metadataJson);
  const tools = readStringArray(subagent.toolsJson);
  const instructions = subagent.instructionsMd.replace(/"""/g, '\\"\\"\\"');
  const model = typeof metadata?.model === "string" && metadata.model.trim() ? metadata.model : subagent.modelHint ?? void 0;
  const reasoning = typeof metadata?.modelReasoningEffort === "string" && metadata.modelReasoningEffort.trim() ? metadata.modelReasoningEffort : void 0;
  const sandbox = typeof metadata?.sandboxMode === "string" && metadata.sandboxMode.trim() ? metadata.sandboxMode : subagent.permissionMode ?? void 0;
  return [
    `name = "${subagent.slug.replace(/"/g, '\\"')}"`,
    `description = "${subagent.description.replace(/"/g, '\\"')}"`,
    `developer_instructions = """${instructions}"""`,
    `tools = [${tools.map((tool) => `"${tool.replace(/"/g, '\\"')}"`).join(", ")}]`,
    model ? `model = "${model.replace(/"/g, '\\"')}"` : "",
    reasoning ? `model_reasoning_effort = "${reasoning.replace(/"/g, '\\"')}"` : "",
    sandbox ? `sandbox_mode = "${sandbox.replace(/"/g, '\\"')}"` : ""
  ].filter(Boolean).join("\n");
}
function buildImportedAgentSourceContent(subagent) {
  const metadata = asRecord2(subagent.metadataJson);
  const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : void 0;
  if (sourcePath?.toLowerCase().endsWith(".toml")) {
    return stringifyCodexAgentToml(subagent);
  }
  const storedFrontmatter = asRecord2(metadata?.frontmatter);
  return stringifyFrontmatterMarkdown(
    {
      ...storedFrontmatter ?? {},
      name: typeof storedFrontmatter?.name === "string" && storedFrontmatter.name.trim() ? storedFrontmatter.name : subagent.slug,
      description: typeof storedFrontmatter?.description === "string" && storedFrontmatter.description.trim() ? storedFrontmatter.description : subagent.description,
      tools: storedFrontmatter?.tools ?? (readStringArray(subagent.toolsJson).length > 0 ? readStringArray(subagent.toolsJson) : void 0),
      model: typeof storedFrontmatter?.model === "string" && storedFrontmatter.model.trim() ? storedFrontmatter.model : subagent.modelHint ?? void 0,
      permissionMode: typeof storedFrontmatter?.permissionMode === "string" && storedFrontmatter.permissionMode.trim() ? storedFrontmatter.permissionMode : subagent.permissionMode ?? void 0
    },
    subagent.instructionsMd
  );
}
function mapImportedWorkspace(version) {
  return {
    versionId: version.id,
    files: (version.files ?? []).map((file) => ({
      id: file.id,
      logicalPath: file.logicalPath,
      kind: file.kind,
      sourceFormat: file.sourceFormat,
      sourcePlatform: inferSourcePlatformFromPath(file.logicalPath)
    })),
    subagents: (version.subagents ?? []).map((subagent) => {
      const metadata = asRecord2(subagent.metadataJson);
      const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : void 0;
      return {
        id: subagent.id,
        name: subagent.name,
        slug: subagent.slug,
        sourcePlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath),
        sourcePath,
        sourceContent: buildImportedAgentSourceContent(subagent)
      };
    }),
    skillRules: (version.skillRules ?? []).map((rule) => {
      const metadata = asRecord2(rule.metadataJson);
      const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : void 0;
      return {
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        sourcePlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath),
        sourcePath,
        sourceContent: buildImportedSkillSourceContent(rule)
      };
    })
  };
}
function isLegacyBaseUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return LEGACY_BASE_URL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
async function migrateLegacyBaseUrl(configuration) {
  const inspected = configuration.inspect("baseUrl");
  if (!inspected) {
    return false;
  }
  let migrated = false;
  if (typeof inspected.globalValue === "string" && isLegacyBaseUrl(inspected.globalValue)) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL2, vscode31.ConfigurationTarget.Global);
    migrated = true;
  }
  if (typeof inspected.workspaceValue === "string" && isLegacyBaseUrl(inspected.workspaceValue)) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL2, vscode31.ConfigurationTarget.Workspace);
    migrated = true;
  }
  if (typeof inspected.workspaceFolderValue === "string" && isLegacyBaseUrl(inspected.workspaceFolderValue) && vscode31.workspace.workspaceFolders && vscode31.workspace.workspaceFolders.length > 0) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL2, vscode31.ConfigurationTarget.WorkspaceFolder);
    migrated = true;
  }
  if (migrated) {
    void vscode31.window.showInformationMessage(
      `Xupra updated xupra.baseUrl to ${DEFAULT_BASE_URL2} from a legacy IP value.`
    );
  }
  return migrated;
}
async function activate(context) {
  let configuration = vscode31.workspace.getConfiguration("xupra");
  const migratedBaseUrl = await migrateLegacyBaseUrl(configuration);
  if (migratedBaseUrl) {
    configuration = vscode31.workspace.getConfiguration("xupra");
  }
  const apiClient = new ApiClient(configuration);
  const stateStore = new StateStore(context);
  const xuSessionStore = new XuSessionStore();
  const controlRoom = new ControlRoomProvider(
    xuSessionStore,
    () => stateStore.getPlanningProvider(),
    () => stateStore.getChatHistory()
  );
  const browserConnect = new BrowserConnectCoordinator(context, apiClient, stateStore);
  const workspaceSidebar = new WorkspaceSidebarProvider(stateStore, apiClient);
  const importedSkillEditor = new ImportedSkillEditorManager(context, apiClient, async () => {
    await syncWorkspaceView();
  });
  const optimizationContentProvider = new OptimizationContentProvider();
  context.subscriptions.push(
    vscode31.workspace.registerTextDocumentContentProvider(
      OptimizationContentProvider.scheme,
      optimizationContentProvider
    )
  );
  const importedContentProvider = new ImportedContentProvider(async (versionId, logicalPath) => {
    const result = await apiClient.fetchVersionFile(versionId, logicalPath);
    return result.content ?? "";
  });
  context.subscriptions.push(
    vscode31.workspace.registerTextDocumentContentProvider(
      ImportedContentProvider.scheme,
      importedContentProvider
    )
  );
  const jobsView = new JobTreeProvider();
  const helpView = new HelpTreeProvider();
  const logger3 = getLogger();
  const statusBar = createStatusBar();
  const storedAccessToken = await stateStore.getAccessToken();
  apiClient.setAccessToken(storedAccessToken);
  if (storedAccessToken) {
    try {
      const result = await apiClient.connect(void 0, void 0, storedAccessToken);
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
    } catch (error) {
      apiClient.setAccessToken(void 0);
      await stateStore.clearAccessToken();
      await stateStore.clearConnection();
      logger3.error(`Stored Xupra extension token is no longer valid: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    await stateStore.clearConnection();
  }
  const syncContexts = async (input) => {
    await vscode31.commands.executeCommand("setContext", "xupra.connected", input.connected);
    await vscode31.commands.executeCommand("setContext", "xupra.hasDetectedFiles", input.hasDetectedFiles);
    await vscode31.commands.executeCommand("setContext", "xupra.hasProjects", input.hasProjects);
    await vscode31.commands.executeCommand("setContext", "xupra.hasVersionSelection", input.hasVersionSelection);
  };
  const syncWorkspaceView = async (projects) => {
    const detectedFiles = stateStore.getDetectedFiles();
    const selection = stateStore.getSelection();
    const connection = stateStore.getConnection();
    let projectList = projects;
    if (!projectList) {
      if (connection.userEmail) {
        try {
          projectList = (await apiClient.listProjects()).projects;
        } catch (error) {
          logger3.error(`Failed to list projects for sidebar sync: ${error instanceof Error ? error.message : String(error)}`);
          projectList = [];
        }
      } else {
        projectList = [];
      }
    }
    const selectedProject = projectList.find((project) => project.id === selection.projectId);
    const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === selection.packageId);
    const selectedVersion = selectedPackage?.versions.find((version) => version.id === selection.versionId);
    let importedWorkspace = null;
    if (connection.userEmail && selection.versionId) {
      try {
        const versionResponse = await apiClient.getVersion(selection.versionId);
        importedWorkspace = mapImportedWorkspace(versionResponse.version);
      } catch (error) {
        logger3.error(
          `Failed to load imported workspace snapshot for ${selection.versionId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    let currentRunbookPath;
    let currentPhase;
    let currentRunbookName;
    let currentRunbookStatus;
    let activePhaseId;
    let activePhaseTitle;
    let activePhaseAgent;
    let approvalStatus = "No runbook";
    try {
      const currentRunbook = await xuSessionStore.readRunbook();
      if (currentRunbook) {
        currentRunbookPath = vscode31.workspace.asRelativePath(currentRunbook.uri, false).replace(/\\/g, "/");
        currentRunbookName = currentRunbook.runbook.metadata.name;
        currentRunbookStatus = currentRunbook.runbook.metadata.status;
        const activeSummary = stateStore.getActivePhaseSummary(currentRunbook.runbook);
        activePhaseId = activeSummary?.phaseId;
        activePhaseTitle = activeSummary?.phaseTitle;
        activePhaseAgent = activeSummary?.agent ?? currentRunbook.runbook.handoff.defaultAgent;
        currentPhase = activePhaseTitle;
        approvalStatus = [
          currentRunbook.runbook.confirmation.userApprovedIntent ? "Purpose approved" : "Purpose pending",
          currentRunbook.runbook.confirmation.userApprovedArchitecture ? "Architecture approved" : "Architecture pending"
        ].join(" / ");
      }
    } catch {
      currentRunbookPath = void 0;
      approvalStatus = "Runbook has diagnostics";
    }
    const currentSession = stateStore.getBuildSession();
    workspaceSidebar.postState({
      connected: Boolean(connection.userEmail),
      userEmail: connection.userEmail,
      userAvatarUrl: connection.userAvatarUrl,
      orgName: connection.organizationName,
      orgTier: connection.organizationTier,
      entitlements: connection.entitlements,
      detectedFiles,
      importedWorkspace,
      selection,
      runbook: {
        sessionName: currentRunbookName ?? currentSession?.id,
        path: currentRunbookPath,
        status: currentRunbookStatus,
        phase: currentPhase,
        activePhaseId,
        activePhaseTitle,
        activePhaseAgent,
        approvalStatus,
        providerStatus: currentSession?.providerLabel ?? (connection.userEmail ? "User IDE AI / External AI Prompt" : "User IDE AI / External AI Prompt"),
        generatedFiles: [
          "RUNBOOK.md",
          "phase prompts",
          "AGENTS.md",
          "CLAUDE.md",
          "Copilot instructions",
          "Cursor rules",
          "Agent skills"
        ]
      },
      isLoading: false
    });
    statusBar.update({
      connected: Boolean(connection.userEmail),
      organizationSlug: connection.organizationSlug,
      versionLabel: selectedVersion ? `v${selectedVersion.versionNumber} ${selectedPackage?.name ?? ""}`.trim() : void 0
    });
    await syncContexts({
      connected: Boolean(connection.userEmail),
      hasDetectedFiles: detectedFiles.length > 0,
      hasProjects: projectList.length > 0,
      hasVersionSelection: Boolean(selection.versionId)
    });
  };
  const refreshProjectsSafely = async (reason) => {
    try {
      return await refreshProjectsCommand(apiClient);
    } catch (error) {
      logger3.error(`Failed to refresh projects during ${reason}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };
  context.subscriptions.push(statusBar);
  context.subscriptions.push(browserConnect.register());
  context.subscriptions.push(importedSkillEditor);
  context.subscriptions.push(vscode31.window.registerWebviewViewProvider("xupra.projects", workspaceSidebar, {
    webviewOptions: { retainContextWhenHidden: true }
  }));
  context.subscriptions.push(vscode31.window.registerTreeDataProvider("xupra.jobs", jobsView));
  context.subscriptions.push(vscode31.window.registerTreeDataProvider("xupra.help", helpView));
  let isRefreshingPlan = false;
  context.subscriptions.push(
    vscode31.window.onDidChangeWindowState(async (windowState) => {
      if (!windowState.focused) {
        return;
      }
      const storedToken = await stateStore.getAccessToken();
      if (!storedToken) {
        return;
      }
      const awaitingUntil = stateStore.getAwaitingPlanRefreshUntil();
      if (awaitingUntil && Date.now() < new Date(awaitingUntil).getTime()) {
        if (isRefreshingPlan) {
          return;
        }
        isRefreshingPlan = true;
        try {
          try {
            const result = await apiClient.connect(void 0, void 0, storedToken);
            const newConnection = connectionStateFromExtensionConnection(result);
            await stateStore.setConnection(newConnection);
            const tier = newConnection.organizationTier?.toLowerCase();
            if (tier === "pro" || tier === "enterprise") {
              await stateStore.setAwaitingPlanRefreshUntil(null);
              await syncWorkspaceView();
              return;
            }
          } catch {
          }
          for (const delay of [5e3, 15e3, 3e4]) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            try {
              const result = await apiClient.connect(void 0, void 0, storedToken);
              const newConnection = connectionStateFromExtensionConnection(result);
              await stateStore.setConnection(newConnection);
              const tier = newConnection.organizationTier?.toLowerCase();
              if (tier === "pro" || tier === "enterprise") {
                await stateStore.setAwaitingPlanRefreshUntil(null);
                await syncWorkspaceView();
                return;
              }
            } catch {
            }
          }
          return;
        } finally {
          isRefreshingPlan = false;
        }
      }
      try {
        const result = await apiClient.connect(void 0, void 0, storedToken);
        const newConnection = connectionStateFromExtensionConnection(result);
        await stateStore.setConnection(newConnection);
        await syncWorkspaceView();
      } catch {
      }
    })
  );
  await syncContexts({
    connected: false,
    hasDetectedFiles: false,
    hasProjects: false,
    hasVersionSelection: false
  });
  const register = (command, callback) => {
    context.subscriptions.push(vscode31.commands.registerCommand(command, callback));
  };
  const runbookDeps = {
    apiClient,
    stateStore,
    sessionStore: xuSessionStore,
    controlRoom,
    refreshSidebar: async () => {
      await syncWorkspaceView();
    }
  };
  register("drylake.startBuildSession", async (...args) => {
    await startBuildSessionCommand(runbookDeps, context, args[0], args[1]);
  });
  register("drylake.openControlRoom", async () => {
    await openControlRoomCommand(runbookDeps, context);
  });
  register("drylake.generateDraftRunbook", async () => {
    await generateDraftRunbookCommand(runbookDeps);
  });
  register("drylake.validateXuRunbook", async () => {
    await validateXuRunbookCommand(runbookDeps);
  });
  register("drylake.approvePurpose", async () => {
    await approvePurposeCommand(runbookDeps);
  });
  register("drylake.approveArchitecture", async () => {
    await approveArchitectureCommand(runbookDeps);
  });
  register("drylake.previewProvisioningPlan", async () => {
    await previewProvisioningPlanCommand(runbookDeps);
  });
  register("drylake.generateAgentFiles", async () => {
    await generateAgentFilesCommand(runbookDeps);
  });
  register("drylake.exportHandoffPrompt", async () => {
    await exportHandoffPromptCommand(runbookDeps);
  });
  register("drylake.runNextPhase", async () => {
    await runNextPhaseCommand(runbookDeps);
  });
  register("drylake.updatePhaseAgent", async (...args) => {
    await updatePhaseAgentCommand(runbookDeps, args[0], args[1]);
  });
  register("drylake.updatePhaseStatus", async (...args) => {
    await updatePhaseStatusCommand(runbookDeps, args[0], args[1]);
  });
  register("drylake.reorderPhase", async (...args) => {
    await reorderPhaseCommand(runbookDeps, args[0], args[1]);
  });
  register("drylake.toggleStep", async (...args) => {
    await toggleStepCommand(runbookDeps, args[0], args[1], args[2]);
  });
  register("drylake.handoffPhase", async (...args) => {
    await handoffPhaseCommand(runbookDeps, args[0]);
  });
  register("drylake.chatSendMessage", async (...args) => {
    await chatSendMessageCommand(runbookDeps, args[0]);
  });
  register("drylake.clearChat", async () => {
    await clearChatCommand(runbookDeps);
  });
  register("xupra.connect", async () => {
    await vscode31.commands.executeCommand("xupra.projects.focus");
    const connected = await connectCommand(apiClient, configuration, stateStore, browserConnect);
    if (!connected) {
      return;
    }
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    const projects = await refreshProjectsSafely("connect");
    await syncWorkspaceView(projects);
    const connection = stateStore.getConnection();
    void vscode31.window.showInformationMessage(
      `Connected as ${connection.userEmail} (${formatTierLabel(connection.organizationTier)} plan).${files.length > 0 ? ` Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.` : " No supported files found yet. Import can still check global folders, or you can add custom file patterns."}`
    );
    if (configuration.get("openDashboardAfterConnect", true)) {
      await openWebAppCommand(apiClient);
    }
  });
  register("xupra.pasteToken", async () => {
    await vscode31.commands.executeCommand("xupra.projects.focus");
    const accessToken = await vscode31.window.showInputBox({
      title: "Paste Xupra Extension Token",
      prompt: "Paste the token from the extension connect page.",
      ignoreFocusOut: true,
      password: true,
      validateInput(value) {
        return value.trim().length > 20 ? null : "Paste the full token from the website.";
      }
    });
    if (!accessToken) {
      return;
    }
    const trimmedToken = accessToken.trim();
    try {
      apiClient.setAccessToken(trimmedToken);
      const result = await apiClient.connect(void 0, void 0, trimmedToken);
      await stateStore.setAccessToken(trimmedToken);
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
      await stateStore.clearLastImport();
      if (!result.auth.configured) {
        void vscode31.window.showWarningMessage(
          `Xupra DryLake auth is set to ${result.auth.mode}, but it still needs ${result.auth.pendingKeys.join(", ")}.`
        );
        await syncWorkspaceView();
        return;
      }
      const files = await scanWorkspaceFiles(configuration);
      await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
      const projects = await refreshProjectsSafely("token paste");
      await syncWorkspaceView(projects);
      const connection = stateStore.getConnection();
      void vscode31.window.showInformationMessage(
        `Connected as ${connection.userEmail} (${formatTierLabel(connection.organizationTier)} plan).${files.length > 0 ? ` Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.` : " No supported files found yet. Import can still check global folders, or you can add custom file patterns."}`
      );
      if (configuration.get("openDashboardAfterConnect", true)) {
        await openWebAppCommand(apiClient);
      }
    } catch (error) {
      apiClient.setAccessToken(void 0);
      await stateStore.clearAccessToken();
      await stateStore.clearConnection();
      void vscode31.window.showErrorMessage(
        error instanceof Error ? error.message : "Failed to connect with extension token."
      );
      await syncWorkspaceView();
    }
  });
  register("xupra.openWebApp", async () => {
    await openWebAppCommand(apiClient);
  });
  register("xupra.refreshPlan", async () => {
    const storedToken = await stateStore.getAccessToken();
    if (!storedToken) {
      void vscode31.window.showInformationMessage("Not connected");
      return;
    }
    const result = await apiClient.connect(void 0, void 0, storedToken);
    const newConnection = connectionStateFromExtensionConnection(result);
    await stateStore.setConnection(newConnection);
    const tier = newConnection.organizationTier?.toLowerCase();
    if (tier === "pro" || tier === "enterprise") {
      await stateStore.setAwaitingPlanRefreshUntil(null);
    }
    await syncWorkspaceView();
  });
  register("xupra.refreshProjects", async () => {
    const projects = await refreshProjectsSafely("manual refresh");
    await syncWorkspaceView(projects);
  });
  register("xupra.signOut", async () => {
    const signedOut = await signOutCommand(apiClient, stateStore);
    if (signedOut) {
      await syncWorkspaceView([]);
    }
  });
  register("xupra.scanWorkspace", async () => {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    await syncWorkspaceView();
    void vscode31.window.showInformationMessage(
      files.length > 0 ? `Found ${files.length} supported workspace files for import.` : "No supported workspace files were found."
    );
  });
  register("xupra.importWorkspace", async () => {
    await importWorkspaceCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });
  register("xupra.importDefaultLocations", async () => {
    await importDefaultLocationsCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });
  register("xupra.importFolder", async () => {
    await importFolderCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });
  register("xupra.resetWorkspaceState", async () => {
    await stateStore.resetWorkspaceState();
    await syncWorkspaceView();
    void vscode31.window.showInformationMessage(
      "Xupra workspace state reset. Your account connection is still active."
    );
  });
  register("xupra.checkCompatibility", async () => {
    await checkCompatibilityCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });
  register("xupra.exportPreview", async () => {
    const hasEntitlement = await requireXupraProAiEntitlement(apiClient, stateStore, "Preview Generated Files");
    if (!hasEntitlement) {
      return;
    }
    await exportPreviewCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });
  register("xupra.installToRuntime", async () => {
    const hasEntitlement = await requireXupraProAiEntitlement(
      apiClient,
      stateStore,
      "Install to platforms"
    );
    if (!hasEntitlement) {
      return;
    }
    const selection = stateStore.getSelection();
    if (!selection.versionId) {
      void vscode31.window.showWarningMessage(
        "Pick a target version in the sidebar first, then run Install to platforms."
      );
      return;
    }
    const items = [
      { label: "Install to all platforms", description: "Codex, Claude Code, Claude Agents, Cursor", value: "all" },
      { label: "Codex", description: "~/.codex/agents/*.toml, ~/.codex/AGENTS.md, ~/.codex/skills/*", value: "codex" },
      { label: "Claude Code", description: "~/.claude/CLAUDE.md, ~/.claude/skills/*", value: "claude_code" },
      { label: "Claude Agents", description: "~/.claude/agents/*.md", value: "claude_agents" },
      { label: "Cursor", description: "~/.cursor/rules/*.mdc, ~/.cursor/skills/*", value: "cursor" }
    ];
    const picked = await vscode31.window.showQuickPick(items, {
      placeHolder: "Where should Xupra install the canonicalized agent files?",
      ignoreFocusOut: true
    });
    if (!picked) return;
    const targets = picked.value === "all" ? ["codex", "claude_code", "claude_agents", "cursor"] : [picked.value];
    const filesByKey = /* @__PURE__ */ new Map();
    try {
      await vscode31.window.withProgress(
        {
          location: vscode31.ProgressLocation.Notification,
          title: "Building canonicalized files...",
          cancellable: false
        },
        async () => {
          for (const target of targets) {
            const preview = await apiClient.exportPreview(selection.versionId, target);
            const generatedFiles2 = preview.generatedFiles?.length ? preview.generatedFiles : (await apiClient.listGeneratedExports(selection.versionId, target, true)).generatedFiles;
            for (const file of generatedFiles2) {
              filesByKey.set(`${target}:${file.logicalPath}`, {
                logicalPath: file.logicalPath,
                preview: file.preview,
                targetPlatform: target
              });
            }
          }
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode31.window.showErrorMessage(`Failed to build canonicalized files: ${message}`);
      return;
    }
    const generatedFiles = Array.from(filesByKey.values());
    if (generatedFiles.length === 0) {
      void vscode31.window.showWarningMessage(
        "No generated files were produced. Canonicalize the version on the web first, then try again."
      );
      return;
    }
    let summary;
    try {
      summary = await installGeneratedFilesToRuntimeHome(generatedFiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode31.window.showErrorMessage(`Install failed: ${message}`);
      return;
    }
    if (!summary) {
      return;
    }
    const lines = [];
    if (summary.codexAgents.length > 0) {
      lines.push(`Codex agents: ${summary.codexAgents.join(", ")}`);
    }
    if (summary.claudeAgents.length > 0) {
      lines.push(`Claude agents: ${summary.claudeAgents.join(", ")}`);
    }
    if (summary.cursorRules.length > 0) {
      lines.push(`Cursor rules: ${summary.cursorRules.join(", ")}`);
    }
    if (summary.cursorSkills.length > 0) {
      lines.push(`Cursor skills: ${summary.cursorSkills.join(", ")}`);
    }
    void vscode31.window.showInformationMessage(
      `Installed ${summary.writtenCount} files into ${summary.installRoot} (.codex / .claude / .cursor). ${lines.join(" | ")}`
    );
  });
  register("xupra.pullPackage", async () => {
    await pullPackageCommand(apiClient, configuration, stateStore);
  });
  register("xupra.showRecentJobs", async () => {
    await vscode31.commands.executeCommand("xupra.jobs.focus");
  });
  register("xupra.createAgent", () => {
    SkillCreationPanel.createOrShow(context, apiClient, stateStore, configuration);
  });
  register("xupra.openImportedSkill", async (...args) => {
    const skillRuleId = typeof args[0] === "string" ? args[0] : void 0;
    const selection = stateStore.getSelection();
    if (!selection.versionId || typeof skillRuleId !== "string" || !skillRuleId.trim()) {
      return;
    }
    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const skill = importedWorkspace.skillRules.find(
      (item) => item.id === skillRuleId && String(item.kind).toLowerCase() === "skill"
    );
    if (!skill) {
      void vscode31.window.showWarningMessage("That imported skill is no longer available for the selected version.");
      return;
    }
    await importedSkillEditor.openImportedSkill(selection.versionId, skill);
  });
  register("xupra.openImportedAgent", async (...args) => {
    const subagentId = typeof args[0] === "string" ? args[0] : void 0;
    const selection = stateStore.getSelection();
    if (!selection.versionId || typeof subagentId !== "string" || !subagentId.trim()) {
      return;
    }
    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const agent = importedWorkspace.subagents.find((item) => item.id === subagentId);
    if (!agent) {
      void vscode31.window.showWarningMessage("That imported agent is no longer available for the selected version.");
      return;
    }
    await importedSkillEditor.openImportedAgent(selection.versionId, agent);
  });
  register("xupra.uninstallImportedAgent", async (...args) => {
    const subagentId = typeof args[0] === "string" ? args[0] : void 0;
    const selection = stateStore.getSelection();
    if (!selection.versionId || typeof subagentId !== "string" || !subagentId.trim()) {
      return;
    }
    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const agent = importedWorkspace.subagents.find((item) => item.id === subagentId);
    if (!agent) {
      void vscode31.window.showWarningMessage("That imported agent is no longer available for the selected version.");
      return;
    }
    await importedSkillEditor.uninstallImportedAgent(agent);
  });
  register("xupra.uninstallImportedSkill", async (...args) => {
    const skillRuleId = typeof args[0] === "string" ? args[0] : void 0;
    const selection = stateStore.getSelection();
    if (!selection.versionId || typeof skillRuleId !== "string" || !skillRuleId.trim()) {
      return;
    }
    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const skill = importedWorkspace.skillRules.find(
      (item) => item.id === skillRuleId && String(item.kind).toLowerCase() === "skill"
    );
    if (!skill) {
      void vscode31.window.showWarningMessage("That imported skill is no longer available for the selected version.");
      return;
    }
    await importedSkillEditor.uninstallImportedSkill(skill);
  });
  register("xupra.clearImportCache", async () => {
    const cacheRoot = vscode31.Uri.joinPath(context.globalStorageUri, "editable-imports");
    try {
      await vscode31.workspace.fs.delete(cacheRoot, { recursive: true, useTrash: false });
      void vscode31.window.showInformationMessage(
        `Cleared Xupra import cache: ${cacheRoot.fsPath}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not\s*found|ENOENT|FileNotFound/i.test(message)) {
        void vscode31.window.showInformationMessage("No Xupra import cache to clear.");
        return;
      }
      void vscode31.window.showErrorMessage(`Failed to clear import cache: ${message}`);
    }
  });
  register("xupra.optimizeFile", async (...args) => {
    let targetUri;
    const first = args[0];
    if (first instanceof vscode31.Uri) {
      targetUri = first;
    } else if (typeof first === "string") {
      try {
        targetUri = vscode31.Uri.parse(first);
      } catch {
        targetUri = void 0;
      }
    } else if (first && typeof first === "object" && "fsPath" in first) {
      const maybe = first.fsPath;
      if (typeof maybe === "string") {
        targetUri = vscode31.Uri.file(maybe);
      }
    }
    if (!targetUri) {
      const active = vscode31.window.activeTextEditor?.document.uri;
      if (active && active.scheme !== "xupra-optimized") {
        targetUri = active;
      }
    }
    if (!targetUri) {
      void vscode31.window.showWarningMessage("Open a file first, then run Optimize with Xupra AI.");
      return;
    }
    const hasEntitlement = await requireXupraProAiEntitlement(
      apiClient,
      stateStore,
      "Xupra AI optimization"
    );
    if (!hasEntitlement) {
      return;
    }
    let targetPlatform = inferTargetPlatformFromUri(targetUri);
    if (!targetPlatform) {
      const picked = await pickTargetPlatform(null);
      if (!picked) {
        return;
      }
      targetPlatform = picked;
    }
    const fileName = targetUri.path.split("/").pop() ?? "file";
    let originalContent;
    try {
      if (targetUri.scheme === ImportedContentProvider.scheme) {
        const document = await vscode31.workspace.openTextDocument(targetUri);
        originalContent = document.getText();
      } else {
        const bytes = await vscode31.workspace.fs.readFile(targetUri);
        originalContent = new TextDecoder("utf-8").decode(bytes);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode31.window.showErrorMessage(`Could not read file: ${message}`);
      return;
    }
    if (!originalContent.trim()) {
      void vscode31.window.showWarningMessage("File is empty \u2014 nothing to optimize.");
      return;
    }
    const repoContext = await collectRepoContext();
    let optimizedContent;
    try {
      const result = await vscode31.window.withProgress(
        {
          location: vscode31.ProgressLocation.Notification,
          title: `Optimizing ${fileName} with Xupra AI...`,
          cancellable: false
        },
        () => apiClient.optimizeAgent({
          content: originalContent,
          targetPlatform,
          fileName,
          repoContext
        })
      );
      optimizedContent = result.optimized.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode31.window.showErrorMessage(`Optimization failed: ${message}`);
      return;
    }
    if (optimizedContent.trim() === originalContent.trim()) {
      void vscode31.window.showInformationMessage("Xupra AI did not suggest changes for this file.");
      return;
    }
    const optimizedUri = optimizationContentProvider.register(targetUri, optimizedContent);
    await vscode31.commands.executeCommand(
      "vscode.diff",
      targetUri,
      optimizedUri,
      `${fileName} \u2194 Xupra AI optimization`,
      { preview: true }
    );
    const choice = await vscode31.window.showInformationMessage(
      `Apply Xupra AI optimization to ${fileName}? A backup will be saved next to the file.`,
      { modal: true },
      "Apply",
      "Discard"
    );
    if (choice !== "Apply") {
      return;
    }
    if (targetUri.scheme === ImportedContentProvider.scheme) {
      void vscode31.window.showInformationMessage(
        "This file was loaded from your imported snapshot, so Xupra cannot write back to disk. Use 'Install to platforms' from the sidebar to materialize agents into ~/.codex, ~/.claude, or ~/.cursor."
      );
      return;
    }
    try {
      const backupUri = targetUri.with({ path: `${targetUri.path}.bak` });
      await vscode31.workspace.fs.writeFile(backupUri, new TextEncoder().encode(originalContent));
      await vscode31.workspace.fs.writeFile(targetUri, new TextEncoder().encode(optimizedContent));
      void vscode31.window.showInformationMessage(
        `Applied optimization to ${fileName}. Backup at ${backupUri.path.split("/").pop()}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode31.window.showErrorMessage(`Failed to write optimized file: ${message}`);
    }
  });
  register("xupra.openSettings", async () => {
    await vscode31.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:xupra.drylake xupra"
    );
  });
  register("xupra.openAccountSettings", async () => {
    await vscode31.env.openExternal(apiClient.openWebUrl("/settings"));
  });
  register("xupra.openBilling", async () => {
    await vscode31.env.openExternal(apiClient.openWebUrl("/billing?source=extension"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 12e4).toISOString());
  });
  register("xupra.contactSupport", async () => {
    await vscode31.env.openExternal(vscode31.Uri.parse("mailto:support@xupracorp.com"));
  });
  register("xupra.openHowItWorks", () => {
    HowItWorksPanel.createOrShow(context, "workflow");
  });
  register("xupra.openInstallGuide", async () => {
    await vscode31.env.openExternal(apiClient.openWebUrl("/extensions/install"));
  });
  register("xupra.openConnectPage", async () => {
    await vscode31.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  });
  register("xupra.openGetStarted", async () => {
    await vscode31.env.openExternal(apiClient.openWebUrl("/app"));
  });
  try {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
  } catch (error) {
    logger3.error(`Failed to scan initial workspace files: ${error instanceof Error ? error.message : String(error)}`);
  }
  const startupToken = await stateStore.getAccessToken();
  if (startupToken) {
    try {
      apiClient.setAccessToken(startupToken);
      const result = await apiClient.connect(void 0, void 0, startupToken);
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
    } catch (error) {
      logger3.error(`Failed to refresh connection during startup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const initialProjects = stateStore.getConnection().userEmail ? await refreshProjectsSafely("startup") : [];
  await syncWorkspaceView(initialProjects);
  if (configuration.get("autoScanOnOpen")) {
    void vscode31.commands.executeCommand("xupra.importWorkspace");
  }
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
/*! Bundled license information:

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT *)
*/
//# sourceMappingURL=extension.js.map
