import { beforeEach, describe, expect, it, vi } from "vitest";

import { signOutCommand } from "../commands/signOut";

const mocks = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}));

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: mocks.showInformationMessage,
    showWarningMessage: mocks.showWarningMessage,
  },
}));

function apiClient() {
  return {
    setAccessToken: vi.fn(),
  };
}

function stateStore(input: { token?: string; userEmail?: string } = {}) {
  return {
    getAccessToken: vi.fn(async () => input.token),
    getConnection: vi.fn(() => ({ userEmail: input.userEmail })),
    clearAccessToken: vi.fn(async () => undefined),
    clearConnection: vi.fn(async () => undefined),
    clearPlanningSessionState: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  mocks.showInformationMessage.mockReset();
  mocks.showWarningMessage.mockReset();
});

describe("signOutCommand", () => {
  it("clears auth and active planning state after confirmation", async () => {
    const client = apiClient();
    const store = stateStore({ token: "token", userEmail: "pro@example.com" });
    mocks.showWarningMessage.mockResolvedValueOnce("Sign Out");

    const signedOut = await signOutCommand(client as never, store as never);

    expect(signedOut).toBe(true);
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Sign out of Xupra DryLake in this editor?",
      { modal: true },
      "Sign Out",
    );
    expect(client.setAccessToken).toHaveBeenCalledWith(undefined);
    expect(store.clearAccessToken).toHaveBeenCalledOnce();
    expect(store.clearConnection).toHaveBeenCalledOnce();
    expect(store.clearPlanningSessionState).toHaveBeenCalledOnce();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith("Signed out of Xupra DryLake.");
  });

  it("still clears stale planning state when already signed out", async () => {
    const client = apiClient();
    const store = stateStore();

    const signedOut = await signOutCommand(client as never, store as never);

    expect(signedOut).toBe(true);
    expect(mocks.showWarningMessage).not.toHaveBeenCalled();
    expect(client.setAccessToken).toHaveBeenCalledWith(undefined);
    expect(store.clearAccessToken).toHaveBeenCalledOnce();
    expect(store.clearConnection).toHaveBeenCalledOnce();
    expect(store.clearPlanningSessionState).toHaveBeenCalledOnce();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith("Xupra DryLake is already signed out.");
  });

  it("does not clear anything when connected sign-out is canceled", async () => {
    const client = apiClient();
    const store = stateStore({ token: "token", userEmail: "pro@example.com" });
    mocks.showWarningMessage.mockResolvedValueOnce(undefined);

    const signedOut = await signOutCommand(client as never, store as never);

    expect(signedOut).toBe(false);
    expect(client.setAccessToken).not.toHaveBeenCalled();
    expect(store.clearAccessToken).not.toHaveBeenCalled();
    expect(store.clearConnection).not.toHaveBeenCalled();
    expect(store.clearPlanningSessionState).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });
});
