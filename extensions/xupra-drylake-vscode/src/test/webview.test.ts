import { describe, expect, it, vi } from "vitest";

import { ControlRoomProvider } from "../webview/controlRoomProvider";

let messageHandler: ((message: { command?: string; args?: unknown[]; copy?: string }) => Promise<void>) | undefined;
const executed: Array<{ command: string; args: unknown[] }> = [];

vi.mock("vscode", () => ({
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: vi.fn(() => ({
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      webview: {
        html: "",
        onDidReceiveMessage: vi.fn((handler) => {
          messageHandler = handler;
        }),
      },
    })),
    showInformationMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(async (command: string, ...args: unknown[]) => {
      executed.push({ command, args });
    }),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
}));

describe("Control Room webview", () => {
  it("routes purpose approval messages to the command handler", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow({ subscriptions: [] } as never);

    await messageHandler?.({ command: "drylake.approvePurpose" });

    expect(executed).toContainEqual({ command: "drylake.approvePurpose", args: [] });
  });

  it("routes architecture approval messages to the command handler", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow({ subscriptions: [] } as never);

    await messageHandler?.({ command: "drylake.approveArchitecture" });

    expect(executed).toContainEqual({ command: "drylake.approveArchitecture", args: [] });
  });
});

