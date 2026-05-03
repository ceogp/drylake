import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createExtensionAccessToken } from "@/lib/services/extension-tokens";

const EXTENSION_AUTH_REQUEST_TTL_MS = 1000 * 60 * 5;

function generateCode() {
  return randomBytes(24).toString("hex");
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
      expiresAt: new Date(Date.now() + EXTENSION_AUTH_REQUEST_TTL_MS),
    },
  });

  return {
    code: request.code,
    expiresAt: request.expiresAt.toISOString(),
  };
}

export async function exchangeExtensionAuthRequest(code: string) {
  const request = await prisma.extensionAuthRequest.findUnique({
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

  if (!request) {
    return null;
  }

  if (request.exchangedAt || request.expiresAt.getTime() <= Date.now()) {
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
    },
  });

  if (exchangeResult.count !== 1) {
    return null;
  }

  const token = await createExtensionAccessToken({
    userId: request.user.id,
    email: request.user.email,
    organizationId: request.organization.id,
  });

  return {
    token,
    user: request.user,
    organization: request.organization,
    editor: request.editor,
  };
}
