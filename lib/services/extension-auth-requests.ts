import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createExtensionAccessToken } from "@/lib/services/extension-tokens";

const EXTENSION_AUTH_REQUEST_TTL_MS = 1000 * 60 * 5;
const POLL_TOKEN_HEADER_BYTES = 32;

export const EXTENSION_AUTH_REQUEST_STATUS = {
  pending: "pending",
  approved: "approved",
  denied: "denied",
  expired: "expired",
  consumed: "consumed",
} as const;

export type ExtensionAuthRequestStatus =
  (typeof EXTENSION_AUTH_REQUEST_STATUS)[keyof typeof EXTENSION_AUTH_REQUEST_STATUS];

type LoadedExtensionAuthRequest = Awaited<ReturnType<typeof loadExtensionAuthRequestById>>;

function generateCode() {
  return randomBytes(24).toString("hex");
}

function generatePollToken() {
  return randomBytes(POLL_TOKEN_HEADER_BYTES).toString("hex");
}

function hashPollToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadExtensionAuthRequestById(requestId: string) {
  return prisma.extensionAuthRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      organization: true,
    },
  });
}

async function loadExtensionAuthRequestByCode(code: string) {
  return prisma.extensionAuthRequest.findUnique({
    where: { code },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      organization: true,
    },
  });
}

function computeRequestStatus(
  request: Pick<
    NonNullable<LoadedExtensionAuthRequest>,
    "status" | "expiresAt" | "exchangedAt"
  >,
): ExtensionAuthRequestStatus {
  if (request.exchangedAt) {
    return EXTENSION_AUTH_REQUEST_STATUS.consumed;
  }

  if (request.expiresAt.getTime() <= Date.now()) {
    return EXTENSION_AUTH_REQUEST_STATUS.expired;
  }

  if (request.status === EXTENSION_AUTH_REQUEST_STATUS.approved) {
    return EXTENSION_AUTH_REQUEST_STATUS.approved;
  }

  if (request.status === EXTENSION_AUTH_REQUEST_STATUS.denied) {
    return EXTENSION_AUTH_REQUEST_STATUS.denied;
  }

  return EXTENSION_AUTH_REQUEST_STATUS.pending;
}

async function persistExpiredStatusIfNeeded(request: NonNullable<LoadedExtensionAuthRequest>) {
  const computedStatus = computeRequestStatus(request);

  if (
    computedStatus === EXTENSION_AUTH_REQUEST_STATUS.expired &&
    request.status !== EXTENSION_AUTH_REQUEST_STATUS.expired
  ) {
    await prisma.extensionAuthRequest
      .updateMany({
        where: {
          id: request.id,
          exchangedAt: null,
          expiresAt: {
            lte: new Date(),
          },
        },
        data: {
          status: EXTENSION_AUTH_REQUEST_STATUS.expired,
        },
      })
      .catch(() => null);
  }

  return computedStatus;
}

function isLegacyImmediateExchangeRequest(request: NonNullable<LoadedExtensionAuthRequest>) {
  return Boolean(request.userId && request.organizationId && !request.pollTokenHash);
}

export async function getExtensionAuthRequestStatus(requestId: string) {
  const request = await loadExtensionAuthRequestById(requestId);

  if (!request) {
    return null;
  }

  const status = await persistExpiredStatusIfNeeded(request);

  return {
    id: request.id,
    editor: request.editor as "vscode" | "cursor",
    status,
    expiresAt: request.expiresAt.toISOString(),
    approvedAt: request.approvedAt?.toISOString() ?? null,
    userId: request.userId,
    organizationId: request.organizationId,
  };
}

export async function createExtensionAuthRequest(input: {
  userId: string;
  organizationId: string;
  editor: "vscode" | "cursor";
}) {
  const request = await prisma.extensionAuthRequest.create({
    data: {
      code: generateCode(),
      userId: input.userId,
      organizationId: input.organizationId,
      editor: input.editor,
      status: EXTENSION_AUTH_REQUEST_STATUS.approved,
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + EXTENSION_AUTH_REQUEST_TTL_MS),
    },
  });

  console.info("[extension-auth] code_created", {
    requestId: request.id,
    userId: input.userId,
    organizationId: input.organizationId,
    editor: input.editor,
    expiresAt: request.expiresAt.toISOString(),
  });

  return {
    code: request.code,
    expiresAt: request.expiresAt.toISOString(),
  };
}

export async function startExtensionAuthRequest(input: {
  editor: "vscode" | "cursor";
}) {
  const pollToken = generatePollToken();
  const request = await prisma.extensionAuthRequest.create({
    data: {
      code: generateCode(),
      editor: input.editor,
      status: EXTENSION_AUTH_REQUEST_STATUS.pending,
      expiresAt: new Date(Date.now() + EXTENSION_AUTH_REQUEST_TTL_MS),
      pollTokenHash: hashPollToken(pollToken),
    },
  });

  console.info("[extension-auth] request_started", {
    requestId: request.id,
    editor: input.editor,
    expiresAt: request.expiresAt.toISOString(),
  });

  return {
    requestId: request.id,
    pollToken,
    expiresAt: request.expiresAt.toISOString(),
    editor: input.editor,
  };
}

export async function approveExtensionAuthRequest(input: {
  requestId: string;
  userId: string;
  organizationId: string;
}) {
  const request = await loadExtensionAuthRequestById(input.requestId);

  if (!request) {
    return { kind: "not_found" as const };
  }

  const status = await persistExpiredStatusIfNeeded(request);

  if (status === EXTENSION_AUTH_REQUEST_STATUS.expired) {
    return { kind: "expired" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.consumed) {
    return { kind: "consumed" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.denied) {
    return { kind: "denied" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.approved) {
    if (request.userId === input.userId && request.organizationId === input.organizationId) {
      return {
        kind: "approved" as const,
        approvedAt: request.approvedAt?.toISOString() ?? new Date().toISOString(),
        editor: request.editor as "vscode" | "cursor",
      };
    }

    return {
      kind: "forbidden" as const,
      message: "This extension connection was already approved by a different account.",
    };
  }

  const approvedAt = new Date();
  const updateResult = await prisma.extensionAuthRequest.updateMany({
    where: {
      id: request.id,
      status: EXTENSION_AUTH_REQUEST_STATUS.pending,
      exchangedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      status: EXTENSION_AUTH_REQUEST_STATUS.approved,
      approvedAt,
      deniedAt: null,
      userId: input.userId,
      organizationId: input.organizationId,
    },
  });

  if (updateResult.count !== 1) {
    const refreshed = await loadExtensionAuthRequestById(input.requestId);

    if (!refreshed) {
      return { kind: "not_found" as const };
    }

    const refreshedStatus = await persistExpiredStatusIfNeeded(refreshed);

    if (
      refreshedStatus === EXTENSION_AUTH_REQUEST_STATUS.approved &&
      refreshed.userId === input.userId &&
      refreshed.organizationId === input.organizationId
    ) {
      return {
        kind: "approved" as const,
        approvedAt: refreshed.approvedAt?.toISOString() ?? approvedAt.toISOString(),
        editor: refreshed.editor as "vscode" | "cursor",
      };
    }

    if (refreshedStatus === EXTENSION_AUTH_REQUEST_STATUS.consumed) {
      return { kind: "consumed" as const };
    }

    if (refreshedStatus === EXTENSION_AUTH_REQUEST_STATUS.expired) {
      return { kind: "expired" as const };
    }

    return {
      kind: "forbidden" as const,
      message: "This extension connection changed while approval was in progress. Start again from the editor.",
    };
  }

  console.info("[extension-auth] request_approved", {
    requestId: request.id,
    userId: input.userId,
    organizationId: input.organizationId,
    editor: request.editor,
  });

  return {
    kind: "approved" as const,
    approvedAt: approvedAt.toISOString(),
    editor: request.editor as "vscode" | "cursor",
  };
}

export async function pollExtensionAuthRequest(input: {
  requestId: string;
  pollToken: string;
}) {
  const request = await loadExtensionAuthRequestById(input.requestId);

  if (!request) {
    return { kind: "not_found" as const };
  }

  if (!request.pollTokenHash || request.pollTokenHash !== hashPollToken(input.pollToken)) {
    return { kind: "invalid_secret" as const };
  }

  const status = await persistExpiredStatusIfNeeded(request);

  if (status === EXTENSION_AUTH_REQUEST_STATUS.pending) {
    return { kind: "pending" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.denied) {
    return { kind: "denied" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.expired) {
    return { kind: "expired" as const };
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.consumed) {
    return { kind: "consumed" as const };
  }

  if (!request.user || !request.organization) {
    return { kind: "pending" as const };
  }

  const token = await createExtensionAccessToken({
    userId: request.user.id,
    email: request.user.email,
    organizationId: request.organization.id,
  });

  const exchangeResult = await prisma.extensionAuthRequest.updateMany({
    where: {
      id: request.id,
      status: EXTENSION_AUTH_REQUEST_STATUS.approved,
      exchangedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      pollTokenHash: request.pollTokenHash,
    },
    data: {
      exchangedAt: new Date(),
      status: EXTENSION_AUTH_REQUEST_STATUS.consumed,
    },
  });

  if (exchangeResult.count !== 1) {
    return { kind: "consumed" as const };
  }

  console.info("[extension-auth] request_consumed", {
    requestId: request.id,
    userId: request.user.id,
    organizationId: request.organization.id,
    editor: request.editor,
  });

  return {
    kind: "approved" as const,
    token,
    user: request.user,
    organization: request.organization,
    editor: request.editor as "vscode" | "cursor",
  };
}

export async function exchangeExtensionAuthRequest(code: string) {
  const request = await loadExtensionAuthRequestByCode(code);

  if (!request) {
    console.info("[extension-auth] exchange_failed", { reason: "not_found" });
    return null;
  }

  if (request.exchangedAt) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "already_used",
    });
    return null;
  }

  const status = await persistExpiredStatusIfNeeded(request);

  if (status === EXTENSION_AUTH_REQUEST_STATUS.expired) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "expired",
    });
    return null;
  }

  if (status === EXTENSION_AUTH_REQUEST_STATUS.denied) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "denied",
    });
    return null;
  }

  if (
    status !== EXTENSION_AUTH_REQUEST_STATUS.approved &&
    !isLegacyImmediateExchangeRequest(request)
  ) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "not_approved",
      status,
    });
    return null;
  }

  if (!request.user || !request.organization) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "missing_subject",
    });
    return null;
  }

  const exchangeResult = await prisma.extensionAuthRequest.updateMany({
    where: {
      id: request.id,
      exchangedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      exchangedAt: new Date(),
      status: EXTENSION_AUTH_REQUEST_STATUS.consumed,
      approvedAt: request.approvedAt ?? new Date(),
    },
  });

  if (exchangeResult.count !== 1) {
    console.info("[extension-auth] exchange_failed", {
      requestId: request.id,
      reason: "race_lost",
    });
    return null;
  }

  const token = await createExtensionAccessToken({
    userId: request.user.id,
    email: request.user.email,
    organizationId: request.organization.id,
  });

  console.info("[extension-auth] code_exchanged", {
    requestId: request.id,
    userId: request.user.id,
    organizationId: request.organization.id,
    editor: request.editor,
  });

  return {
    token,
    user: request.user,
    organization: request.organization,
    editor: request.editor,
  };
}
