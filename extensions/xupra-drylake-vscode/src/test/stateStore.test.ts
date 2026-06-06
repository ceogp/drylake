import { describe, expect, it, vi } from "vitest";

import { StateStore } from "../services/stateStore";

vi.mock("vscode", () => ({}));

describe("StateStore", () => {
  it("clears all active planning session state without touching local plan files", async () => {
    const updates: Array<[string, unknown]> = [];
    const store = new StateStore({
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(async (key: string, value: unknown) => {
          updates.push([key, value]);
        }),
      },
    } as never);

    await store.clearPlanningSessionState();

    expect(updates).toEqual([
      ["drylake.buildSession", null],
      ["drylake.pendingPlanDraft", null],
      ["drylake.planningProvider", null],
      ["drylake.lastModelTier", null],
      ["drylake.planningLoading", false],
      ["drylake.chatHistory", { messages: [] }],
      ["xupra.awaitingPlanRefreshUntil", null],
    ]);
  });
});
