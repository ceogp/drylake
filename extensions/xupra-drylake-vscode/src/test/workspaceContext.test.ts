import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceState = vi.hoisted(() => ({
  workspaceFolders: [{ uri: { fsPath: "C:/repo", path: "/repo" } }] as Array<{ uri: { fsPath: string; path: string } }> | undefined,
  activeEditorUri: undefined as { fsPath?: string; path?: string; scheme?: string; with?: (parts: { path: string }) => unknown } | undefined,
}));

vi.mock("vscode", () => ({
  workspace: {
    get workspaceFolders() {
      return workspaceState.workspaceFolders;
    },
  },
  window: {
    get activeTextEditor() {
      return workspaceState.activeEditorUri
        ? { document: { uri: workspaceState.activeEditorUri } }
        : undefined;
    },
  },
}));

import { resolveWorkspaceRoot } from "../services/workspaceContext";

describe("workspace context", () => {
  beforeEach(() => {
    workspaceState.workspaceFolders = [{ uri: { fsPath: "C:/repo", path: "/repo" } }];
    workspaceState.activeEditorUri = undefined;
  });

  it("prefers the opened workspace folder", () => {
    expect(resolveWorkspaceRoot()).toEqual({ fsPath: "C:/repo", path: "/repo" });
  });

  it("falls back to the active file directory when no folder is open", () => {
    workspaceState.workspaceFolders = undefined;
    workspaceState.activeEditorUri = {
      scheme: "file",
      fsPath: "C:/repo/src/app.ts",
      path: "/C:/repo/src/app.ts",
      with: ({ path }) => ({ fsPath: "C:/repo/src", path }),
    };

    expect(resolveWorkspaceRoot()).toEqual({ fsPath: "C:/repo/src", path: "/C:/repo/src" });
  });

  it("throws a precise error when neither a folder nor file is open", () => {
    workspaceState.workspaceFolders = undefined;
    workspaceState.activeEditorUri = undefined;

    expect(() => resolveWorkspaceRoot()).toThrow(
      "Open a workspace folder or a file from your repo before starting a DryLake build session.",
    );
  });
});
