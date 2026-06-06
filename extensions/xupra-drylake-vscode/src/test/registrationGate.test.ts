import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasRegisteredUser, requireRegisteredUser } from "../services/registrationGate";

const mocks = vi.hoisted(() => ({
  showWarningMessage: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock("vscode", () => ({
  window: {
    showWarningMessage: mocks.showWarningMessage,
  },
  commands: {
    executeCommand: mocks.executeCommand,
  },
}));

function makeStateStore(token: string | undefined) {
  return {
    getAccessToken: vi.fn(async () => token),
    setConnection: vi.fn(async () => undefined),
    clearAccessToken: vi.fn(async () => undefined),
    clearConnection: vi.fn(async () => undefined),
  };
}

function makeApiClient() {
  return {
    setAccessToken: vi.fn(),
    connect: vi.fn(),
  };
}

const connectedPayload = {
  editor: "vscode",
  auth: {
    mode: "clerk",
    provider: "clerk",
    configured: true,
    pendingKeys: [],
    session: {
      status: "active",
      organizationId: "org-1",
      user: {
        id: "user-1",
        email: "dev@example.com",
        imageUrl: null,
      },
    },
  },
  user: {
    id: "user-1",
    email: "dev@example.com",
    imageUrl: null,
  },
  organization: {
    id: "org-1",
    name: "Dev Org",
    slug: "dev-org",
    tier: "free",
  },
  entitlements: {
    xupra_pro_ai: false,
    session_cloud_sync: false,
    pr_summary_generation: false,
  },
  subscription: {
    status: "free",
  },
} as const;

describe("registration gate", () => {
  beforeEach(() => {
    mocks.showWarningMessage.mockReset();
    mocks.executeCommand.mockReset();
  });

  it("does not treat stale local connection state as registration when there is no token", async () => {
    const stateStore = makeStateStore(undefined);
    const apiClient = makeApiClient();

    await expect(hasRegisteredUser(stateStore as never, apiClient as never)).resolves.toBe(false);

    expect(apiClient.connect).not.toHaveBeenCalled();
    expect(stateStore.setConnection).not.toHaveBeenCalled();
  });

  it("clears stale tokens when backend validation fails", async () => {
    const stateStore = makeStateStore("stale-token");
    const apiClient = makeApiClient();
    apiClient.connect.mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(hasRegisteredUser(stateStore as never, apiClient as never)).resolves.toBe(false);

    expect(apiClient.setAccessToken).toHaveBeenCalledWith("stale-token");
    expect(apiClient.connect).toHaveBeenCalledWith(undefined, undefined, "stale-token");
    expect(apiClient.setAccessToken).toHaveBeenLastCalledWith(undefined);
    expect(stateStore.clearAccessToken).toHaveBeenCalledOnce();
    expect(stateStore.clearConnection).toHaveBeenCalledOnce();
    expect(stateStore.setConnection).not.toHaveBeenCalled();
  });

  it("requires a live backend registration before allowing planning", async () => {
    const stateStore = makeStateStore("valid-token");
    const apiClient = makeApiClient();
    apiClient.connect.mockResolvedValueOnce(connectedPayload);

    await expect(requireRegisteredUser(stateStore as never, apiClient as never)).resolves.toBe(true);

    expect(mocks.showWarningMessage).not.toHaveBeenCalled();
    expect(stateStore.setConnection).toHaveBeenCalledWith(expect.objectContaining({
      userEmail: "dev@example.com",
      organizationSlug: "dev-org",
      organizationTier: "free",
    }));
  });

  it("shows the registration prompt and opens connect when validation fails", async () => {
    const stateStore = makeStateStore("stale-token");
    const apiClient = makeApiClient();
    apiClient.connect.mockRejectedValue(new Error("Unauthorized"));
    mocks.showWarningMessage.mockResolvedValueOnce("Register Free");

    await expect(requireRegisteredUser(stateStore as never, apiClient as never)).resolves.toBe(false);

    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "You must register as a free user to use DryLake.",
      { modal: true },
      "Register Free",
    );
    expect(mocks.executeCommand).toHaveBeenCalledWith("xupra.connect");
    expect(stateStore.clearAccessToken).toHaveBeenCalled();
    expect(stateStore.clearConnection).toHaveBeenCalled();
  });
});
