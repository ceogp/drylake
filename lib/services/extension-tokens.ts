import { z } from "zod";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/prisma";

const EXTENSION_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const EXTENSION_TOKEN_HEADER = "x-xupra-extension-token";

const tokenPayloadSchema = z.object({
  type: z.literal("extension_access_token"),
  version: z.literal(1),
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  email: z.string().email(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type ExtensionTokenSession = {
  userId: string;
  email: string;
  organizationId: string;
  expiresAt: string;
};

export async function createExtensionAccessToken(input: {
  userId: string;
  email: string;
  organizationId: string;
}) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + EXTENSION_ACCESS_TOKEN_TTL_MS);
  const payload = {
    type: "extension_access_token" as const,
    version: 1 as const,
    userId: input.userId,
    organizationId: input.organizationId,
    email: input.email,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const encrypted = await encryptSecret(JSON.stringify(payload), "extension-access-v1");

  return {
    token: encrypted.ciphertext,
    expiresAt: payload.expiresAt,
  };
}

export async function verifyExtensionAccessToken(token: string): Promise<ExtensionTokenSession | null> {
  if (!token.trim()) {
    return null;
  }

  try {
    const decrypted = await decryptSecret(token);
    const parsed = tokenPayloadSchema.safeParse(JSON.parse(decrypted.plaintext));

    if (!parsed.success) {
      return null;
    }

    if (new Date(parsed.data.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: parsed.data.organizationId,
        userId: parsed.data.userId,
      },
      include: {
        user: true,
      },
    });

    if (!membership || membership.user.email !== parsed.data.email) {
      return null;
    }

    return {
      userId: parsed.data.userId,
      email: parsed.data.email,
      organizationId: parsed.data.organizationId,
      expiresAt: parsed.data.expiresAt,
    };
  } catch {
    return null;
  }
}
