import { randomUUID } from "node:crypto";

import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
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

function buildExternalConnectUrl(apiClient: ApiClient, callbackUri: vscode.Uri) {
  const url = new URL(apiClient.openWebUrl("/extensions/connect").toString());
  url.searchParams.set("callback", callbackUri.toString());
  url.searchParams.set("editor", vscode.env.uriScheme === "cursor" ? "cursor" : "vscode");
  return vscode.Uri.parse(url.toString());
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
    void vscode.window.showInformationMessage(
      `Connected to Xupra DryLake as ${exchanged.user.email}.`,
    );
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
