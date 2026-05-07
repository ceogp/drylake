import { randomUUID } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
import { normalizeEntitlements } from "./connectionState";
import { writeGeneratedFilesToWorkspace } from "./fileSync";
import { StateStore } from "./stateStore";
import { getLogger } from "../utils/logging";

type BrowserConnectResult =
  | {
      kind: "approved";
      session: {
        token: {
          token: string;
          expiresAt: string;
        };
        user: {
          id: string;
          email: string;
          imageUrl?: string | null;
        };
        organization: {
          id: string;
          name: string;
          slug: string;
          tier: string;
        };
        entitlements?: Record<string, boolean>;
        subscription?: {
          status: string;
        };
        editor: "vscode" | "cursor";
      };
    }
  | {
      kind: "error";
      message: string;
    };

type PendingRequest = {
  state: string;
  requestId: string;
  pollToken: string;
  resolve: (result: BrowserConnectResult | null) => void;
  timeout: NodeJS.Timeout;
};

const CONNECT_TIMEOUT_MS = 1000 * 60 * 3;
const CONNECT_POLL_INTERVAL_MS = 1500;
const SUPPORTED_INSTALL_TARGETS = new Set(["codex", "claude_code", "claude_agents", "cursor"]);
const ALL_INSTALL_TARGETS = ["codex", "claude_agents", "cursor"];
const logger = getLogger();

function logConnectStage(stage: string, details?: Record<string, unknown>) {
  logger.info(
    `Browser connect ${stage}${details ? ` ${JSON.stringify(details)}` : ""}`,
  );
}

function buildExternalConnectUrl(
  apiClient: ApiClient,
  callbackUri: vscode.Uri,
  requestId: string,
  state: string,
) {
  const url = new URL(apiClient.openWebUrl("/extensions/connect").toString());
  url.searchParams.set("callback", callbackUri.toString());
  url.searchParams.set("editor", vscode.env.uriScheme === "cursor" ? "cursor" : "vscode");
  url.searchParams.set("requestId", requestId);
  url.searchParams.set("state", state);
  url.searchParams.set("request", Date.now().toString());
  return vscode.Uri.parse(url.toString());
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeInstallTarget(rawValue: string | null) {
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

  private async applyConnectedSession(exchanged: NonNullable<BrowserConnectResult & { kind: "approved" }> ["session"]) {
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
      userAvatarUrl: exchanged.user.imageUrl ?? undefined,
      authMode: "clerk",
    });
    logConnectStage("exchange_succeeded", {
      organizationId: exchanged.organization.id,
      editor: exchanged.editor,
    });
    const tierLabel = exchanged.organization.tier
      ? exchanged.organization.tier.charAt(0).toUpperCase() + exchanged.organization.tier.slice(1).toLowerCase()
      : "Free";
    void vscode.window.showInformationMessage(
      `Connected to Xupra DryLake as ${exchanged.user.email} (${tierLabel} plan).`,
    );
    void vscode.commands.executeCommand("xupra.refreshProjects");
  }

  private async pollPendingRequest(pendingRequest: PendingRequest) {
    while (this.pending === pendingRequest) {
      try {
        const pollResult = await this.apiClient.pollBrowserConnect(
          pendingRequest.requestId,
          pendingRequest.pollToken,
        );

        if (this.pending !== pendingRequest) {
          return;
        }

        if (pollResult.status === "pending") {
          await sleep(CONNECT_POLL_INTERVAL_MS);
          continue;
        }

        clearTimeout(pendingRequest.timeout);
        this.pending = undefined;

        if (pollResult.status === "approved") {
          logConnectStage("poll_approved", { requestId: pendingRequest.requestId });
          pendingRequest.resolve({
            kind: "approved",
            session: pollResult,
          });
          return;
        }

        const messages: Record<"denied" | "expired" | "consumed", string> = {
          denied: "The browser denied the Xupra connection request. Start Connect again from the editor.",
          expired:
            "The Xupra browser approval request expired. Start Connect again from the editor.",
          consumed:
            "This Xupra browser approval request was already completed. Start Connect again if this editor is still disconnected.",
        };

        logConnectStage("poll_finished_without_session", {
          requestId: pendingRequest.requestId,
          status: pollResult.status,
        });
        pendingRequest.resolve({
          kind: "error",
          message: messages[pollResult.status],
        });
        return;
      } catch (error) {
        logConnectStage("poll_retry", {
          requestId: pendingRequest.requestId,
          message: error instanceof Error ? error.message : String(error),
        });
        await sleep(CONNECT_POLL_INTERVAL_MS);
      }
    }
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
    const approved = query.get("approved") === "1" || query.get("connected") === "1";
    const matchesPendingState = Boolean(this.pending && state === this.pending.state);

    logConnectStage("callback_received", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      approved,
      matchesPendingState,
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
          message: message ?? error ?? "The browser callback did not include a connect code.",
        });
        this.pending = undefined;
      }
      return;
    }

    if (this.pending && state === this.pending.state) {
      const pendingRequest = this.pending;
      clearTimeout(pendingRequest.timeout);
      this.pending = undefined;
      logConnectStage("legacy_code_received");

      const exchanged = await this.apiClient.exchangeBrowserConnectCode(code).catch(() => null);

      if (!exchanged) {
        logConnectStage("exchange_failed");
        pendingRequest.resolve({
          kind: "error",
          message:
            "Xupra DryLake received a browser callback, but the connection code could not be exchanged. Run Connect again.",
        });
        return;
      }

      pendingRequest.resolve({
        kind: "approved",
        session: exchanged,
      });
      return;
    }

    logConnectStage("state_mismatch_or_unsolicited_callback", {
      hasPendingRequest: Boolean(this.pending),
    });
    const exchanged = await this.apiClient.exchangeBrowserConnectCode(code).catch(() => null);

    if (!exchanged) {
      logConnectStage("exchange_failed");
      void vscode.window.showWarningMessage(
        "Xupra DryLake received a browser callback, but the connection code could not be exchanged. Run Connect again.",
      );
      return;
    }

    await this.applyConnectedSession(exchanged);
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
      const installTargets = targetPlatform === "all" ? ALL_INSTALL_TARGETS : [targetPlatform];
      const generatedFilesByPath = new Map<string, { logicalPath: string; preview: string }>();

      for (const installTarget of installTargets) {
        const preview = await this.apiClient.exportPreview(versionId, installTarget);
        const generatedFiles = preview.generatedFiles?.length
          ? preview.generatedFiles
          : (await this.apiClient.listGeneratedExports(versionId, installTarget, true)).generatedFiles;

        for (const file of generatedFiles) {
          generatedFilesByPath.set(file.logicalPath, {
            logicalPath: file.logicalPath,
            preview: file.preview,
          });
        }
      }

      const generatedFiles = Array.from(generatedFilesByPath.values());

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
        if (writtenCount > 0) {
          void vscode.window.showInformationMessage(`Installed ${writtenCount} files.`);
        }
        return;
      }

      const writtenCount = await writeGeneratedFilesToWorkspace(generatedFiles, {
        confirmBeforeWrite: true,
      });
      if (writtenCount > 0) {
        void vscode.window.showInformationMessage(`Installed ${writtenCount} files.`);
      }
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
    const editor = vscode.env.uriScheme === "cursor" ? "cursor" : "vscode";
    const connectRequest = await this.apiClient.startBrowserConnect(editor);
    const connectUrl = buildExternalConnectUrl(
      this.apiClient,
      externalCallbackUri,
      connectRequest.requestId,
      state,
    );
    let pendingRequest: PendingRequest | undefined;

    const resultPromise = new Promise<BrowserConnectResult | null>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pending?.state === state) {
          this.pending = undefined;
          logConnectStage("timeout");
          void vscode.window.showWarningMessage(
            "Xupra did not receive browser approval before the request expired. Start Connect again or use the manual token fallback.",
          );
          resolve(null);
        }
      }, CONNECT_TIMEOUT_MS);

      pendingRequest = {
        state,
        requestId: connectRequest.requestId,
        pollToken: connectRequest.pollToken,
        resolve,
        timeout,
      };
      this.pending = pendingRequest;
      void this.pollPendingRequest(pendingRequest);
    });

    try {
      const opened = await vscode.env.openExternal(connectUrl);
      logConnectStage("browser_opened", { opened });

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
