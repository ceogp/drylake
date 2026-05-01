import { randomUUID } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
import { writeGeneratedFilesToWorkspace } from "./fileSync";
import { StateStore } from "./stateStore";

type BrowserConnectResult =
  | {
      kind: "success";
      code: string;
    }
  | {
      kind: "error";
      message: string;
    };

type PendingRequest = {
  state: string;
  resolve: (result: BrowserConnectResult | null) => void;
  timeout: NodeJS.Timeout;
};

const CONNECT_TIMEOUT_MS = 1000 * 60 * 3;
const SUPPORTED_INSTALL_TARGETS = new Set(["codex", "claude_code", "claude_agents", "cursor"]);

function buildExternalConnectUrl(apiClient: ApiClient, callbackUri: vscode.Uri) {
  const url = new URL(apiClient.openWebUrl("/extensions/connect").toString());
  url.searchParams.set("callback", callbackUri.toString());
  url.searchParams.set("editor", vscode.env.uriScheme === "cursor" ? "cursor" : "vscode");
  return vscode.Uri.parse(url.toString());
}

function normalizeInstallTarget(rawValue: string | null) {
  const value = rawValue?.trim();

  if (!value) {
    return null;
  }

  if (value === "claude") {
    return "claude_agents";
  }

  return SUPPORTED_INSTALL_TARGETS.has(value) ? value : null;
}

function normalizeInstallMode(rawValue: string | null) {
  if (!rawValue || rawValue === "workspace-root") {
    return "workspace-root";
  }

  if (rawValue === "custom-path") {
    return "custom-path";
  }

  return null;
}

function isInsideWorkspace(uri: vscode.Uri) {
  const roots = vscode.workspace.workspaceFolders ?? [];

  return roots.some((root) => {
    const relative = path.relative(root.uri.fsPath, uri.fsPath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });
}

export class BrowserConnectCoordinator implements vscode.UriHandler {
  private pending: PendingRequest | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: ApiClient,
    private readonly stateStore: StateStore,
  ) {}

  register() {
    return vscode.window.registerUriHandler(this);
  }

  async handleUri(uri: vscode.Uri): Promise<void> {
    if (uri.path === "/import") {
      await vscode.commands.executeCommand("xupra.projects.focus");

      if (!(await this.stateStore.getAccessToken())) {
        void vscode.window.showInformationMessage(
          "Connect Xupra first, then the import will run from this editor.",
        );
        await vscode.commands.executeCommand("xupra.connect");
      }

      if (await this.stateStore.getAccessToken()) {
        await vscode.commands.executeCommand("xupra.importWorkspace");
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

    if (!code) {
      if (this.pending && state === this.pending.state) {
        clearTimeout(this.pending.timeout);
        this.pending.resolve({
          kind: "error",
          message: message ?? error ?? "The browser callback did not include a connect code.",
        });
        this.pending = undefined;
      }
      return;
    }

    if (this.pending && state === this.pending.state) {
      clearTimeout(this.pending.timeout);
      this.pending.resolve({
        kind: "success",
        code,
      });
      this.pending = undefined;
      return;
    }

    const exchanged = await this.apiClient.exchangeBrowserConnectCode(code).catch(() => null);

    if (!exchanged) {
      void vscode.window.showWarningMessage(
        "Xupra DryLake received a browser callback, but the connection code could not be exchanged. Run Connect again.",
      );
      return;
    }

    this.apiClient.setAccessToken(exchanged.token.token);
    await this.stateStore.setAccessToken(exchanged.token.token);
    await this.stateStore.setConnection({
      organizationId: exchanged.organization.id,
      organizationSlug: exchanged.organization.slug,
      userEmail: exchanged.user.email,
      authMode: "clerk",
    });
    void vscode.window.showInformationMessage(
      `Connected to Xupra DryLake as ${exchanged.user.email}.`,
    );
  }

  private async handleInstallUri(uri: vscode.Uri) {
    const query = new URLSearchParams(uri.query);
    const versionId = query.get("versionId")?.trim();
    const targetPlatform = normalizeInstallTarget(
      query.get("targetPlatform") ?? query.get("platform") ?? query.get("format"),
    );
    const mode = normalizeInstallMode(query.get("mode"));

    if (!versionId) {
      void vscode.window.showErrorMessage("Xupra install link is missing a package version.");
      return;
    }

    if (!targetPlatform) {
      void vscode.window.showErrorMessage("Xupra install link has an unsupported target format.");
      return;
    }

    if (!mode) {
      void vscode.window.showErrorMessage("Xupra install link has an unsupported install mode.");
      return;
    }

    await vscode.commands.executeCommand("xupra.projects.focus");

    if (!(await this.stateStore.getAccessToken())) {
      void vscode.window.showInformationMessage(
        "Connect Xupra first, then the install will run from this editor.",
      );
      await vscode.commands.executeCommand("xupra.connect");
    }

    if (!(await this.stateStore.getAccessToken())) {
      return;
    }

    await this.stateStore.setSelection({ versionId });

    try {
      const preview = await this.apiClient.exportPreview(versionId, targetPlatform);
      const generatedFiles = preview.generatedFiles?.length
        ? preview.generatedFiles
        : (await this.apiClient.listGeneratedExports(versionId, targetPlatform, true)).generatedFiles;

      if (generatedFiles.length === 0) {
        void vscode.window.showWarningMessage(`No generated files are available for ${targetPlatform}.`);
        return;
      }

      if (mode === "custom-path") {
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
          openLabel: "Choose Install Folder",
          title: "Choose where Xupra should write generated files",
        });
        const targetFolder = picked?.[0];

        if (!targetFolder) {
          return;
        }

        if (!isInsideWorkspace(targetFolder)) {
          void vscode.window.showErrorMessage("Choose a folder inside the current workspace.");
          return;
        }

        const writtenCount = await writeGeneratedFilesToWorkspace(generatedFiles, {
          confirmBeforeWrite: true,
          rootUri: targetFolder,
          confirmationLabel: "the selected folder",
        });
        void vscode.window.showInformationMessage(`Installed ${writtenCount} files.`);
        return;
      }

      const writtenCount = await writeGeneratedFilesToWorkspace(generatedFiles, {
        confirmBeforeWrite: true,
      });
      void vscode.window.showInformationMessage(`Installed ${writtenCount} files.`);
    } catch (error) {
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : "Xupra install failed.",
      );
    }
  }

  async start() {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.resolve(null);
      this.pending = undefined;
    }

    const state = randomUUID();
    const internalCallbackUri = vscode.Uri.parse(
      `${vscode.env.uriScheme}://${this.context.extension.id}/auth-complete?state=${encodeURIComponent(state)}`,
    );
    const externalCallbackUri = await vscode.env.asExternalUri(internalCallbackUri);
    const connectUrl = buildExternalConnectUrl(this.apiClient, externalCallbackUri);
    let pendingRequest: PendingRequest | undefined;

    const resultPromise = new Promise<BrowserConnectResult | null>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pending?.state === state) {
          this.pending = undefined;
          resolve(null);
        }
      }, CONNECT_TIMEOUT_MS);

      pendingRequest = {
        state,
        resolve,
        timeout,
      };
      this.pending = pendingRequest;
    });

    try {
      const opened = await vscode.env.openExternal(connectUrl);

      if (!opened && pendingRequest?.state === state) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve({
          kind: "error",
          message: `Xupra could not open your browser automatically. Open ${this.apiClient.baseUrl}/extensions/connect and continue from there.`,
        });
        if (this.pending === pendingRequest) {
          this.pending = undefined;
        }
      }
    } catch (error) {
      if (pendingRequest?.state === state) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve({
          kind: "error",
          message:
            error instanceof Error
              ? `Xupra could not open your browser: ${error.message}`
              : "Xupra could not open your browser automatically.",
        });
        if (this.pending === pendingRequest) {
          this.pending = undefined;
        }
      }
    }

    return resultPromise;
  }
}
