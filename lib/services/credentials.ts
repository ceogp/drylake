import type { Prisma } from "@prisma/client";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/services/audit";
import { assertEntitlement } from "@/lib/services/entitlements";

type CredentialMetadata = Record<string, unknown>;

function safeMetadata(value: CredentialMetadata | null | undefined) {
  return (value ?? {}) as Prisma.InputJsonObject;
}

async function verifyWithProvider(provider: string, secret: string) {
  switch (provider) {
    case "github": {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "xupra-drylake",
        },
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: response.ok,
        provider,
        checkedAt: new Date().toISOString(),
        status: response.ok ? "verified" : "failed",
        details: response.ok
          ? { login: payload.login, id: payload.id }
          : { message: payload.message ?? "GitHub token verification failed" },
      };
    }
    case "openai": {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: response.ok,
        provider,
        checkedAt: new Date().toISOString(),
        status: response.ok ? "verified" : "failed",
        details: response.ok
          ? { object: payload.object }
          : { message: payload.error ?? "OpenAI key verification failed" },
      };
    }
    case "slack": {
      const response = await fetch("https://slack.com/api/auth.test", {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: response.ok && payload.ok === true,
        provider,
        checkedAt: new Date().toISOString(),
        status: response.ok && payload.ok === true ? "verified" : "failed",
        details:
          response.ok && payload.ok === true
            ? { team: payload.team, user: payload.user }
            : { message: payload.error ?? "Slack token verification failed" },
      };
    }
    default:
      return {
        ok: true,
        provider,
        checkedAt: new Date().toISOString(),
        status: "recorded",
        details: {
          message: "Provider-specific remote verification is not implemented for this credential type yet.",
        },
      };
  }
}

export async function createCredential(params: {
  organizationId: string;
  createdByUserId: string;
  name: string;
  provider: string;
  kind: string;
  secret: string;
  metadata?: CredentialMetadata;
}) {
  await assertEntitlement(params.organizationId, "credential_vault");

  const encrypted = await encryptSecret(params.secret);

  const credential = await prisma.credential.create({
    data: {
      organizationId: params.organizationId,
      createdByUserId: params.createdByUserId,
      name: params.name,
      provider: params.provider,
      kind: params.kind,
      ciphertext: encrypted.ciphertext,
      keyVersion: encrypted.keyVersion,
      metadataJson: safeMetadata(params.metadata),
    },
  });

  await prisma.credentialAccessLog.create({
    data: {
      credentialId: credential.id,
      actorUserId: params.createdByUserId,
      action: "create",
    },
  });

  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.createdByUserId,
    entityType: "credential",
    entityId: credential.id,
    action: "credential.create",
    metadata: {
      provider: params.provider,
      kind: params.kind,
      name: params.name,
    },
  });

  return credential;
}

export async function updateCredential(params: {
  credentialId: string;
  actorUserId: string;
  name: string;
  provider: string;
  kind: string;
  secret?: string;
  metadata?: CredentialMetadata;
}) {
  const existing = await prisma.credential.findUniqueOrThrow({
    where: { id: params.credentialId },
  });

  await assertEntitlement(existing.organizationId, "credential_vault");

  const nextCiphertext =
    typeof params.secret === "string" && params.secret.trim().length > 0
      ? await encryptSecret(params.secret.trim())
      : null;

  const credential = await prisma.credential.update({
    where: { id: params.credentialId },
    data: {
      name: params.name,
      provider: params.provider,
      kind: params.kind,
      ciphertext: nextCiphertext?.ciphertext ?? existing.ciphertext,
      keyVersion: nextCiphertext?.keyVersion ?? existing.keyVersion,
      metadataJson: safeMetadata(params.metadata),
    },
  });

  await prisma.credentialAccessLog.create({
    data: {
      credentialId: credential.id,
      actorUserId: params.actorUserId,
      action: "update",
    },
  });

  await recordAuditEvent({
    organizationId: credential.organizationId,
    actorUserId: params.actorUserId,
    entityType: "credential",
    entityId: credential.id,
    action: "credential.update",
    metadata: {
      provider: params.provider,
      kind: params.kind,
      name: params.name,
      secretRotated: Boolean(nextCiphertext),
    },
  });

  return credential;
}

export async function deleteCredential(params: {
  credentialId: string;
  actorUserId: string;
}) {
  const credential = await prisma.credential.findUniqueOrThrow({
    where: { id: params.credentialId },
  });

  await assertEntitlement(credential.organizationId, "credential_vault");

  await prisma.credentialAccessLog.create({
    data: {
      credentialId: credential.id,
      actorUserId: params.actorUserId,
      action: "delete",
    },
  });

  await recordAuditEvent({
    organizationId: credential.organizationId,
    actorUserId: params.actorUserId,
    entityType: "credential",
    entityId: credential.id,
    action: "credential.delete",
    metadata: {
      provider: credential.provider,
      kind: credential.kind,
      name: credential.name,
    },
  });

  await prisma.credential.delete({
    where: { id: params.credentialId },
  });
}

export async function verifyCredential(params: {
  credentialId: string;
  actorUserId: string;
}) {
  const credential = await prisma.credential.findUniqueOrThrow({
    where: { id: params.credentialId },
  });

  await assertEntitlement(credential.organizationId, "credential_vault");

  const decrypted = await decryptSecret(credential.ciphertext);
  const result = await verifyWithProvider(credential.provider, decrypted.plaintext);

  if (result.ok) {
    await prisma.credential.update({
      where: { id: credential.id },
      data: {
        lastVerifiedAt: new Date(),
        metadataJson: safeMetadata({
          ...((credential.metadataJson as Record<string, unknown> | null) ?? {}),
          lastVerification: result,
        }),
      },
    });
  }

  await prisma.credentialAccessLog.create({
    data: {
      credentialId: credential.id,
      actorUserId: params.actorUserId,
      action: "verify",
    },
  });

  await recordAuditEvent({
    organizationId: credential.organizationId,
    actorUserId: params.actorUserId,
    entityType: "credential",
    entityId: credential.id,
    action: "credential.verify",
    metadata: result as Prisma.InputJsonObject,
  });

  return result;
}

export async function readCredentialForJob(params: {
  credentialId: string;
  actorUserId?: string | null;
  jobId?: string | null;
}) {
  const credential = await prisma.credential.findUniqueOrThrow({
    where: { id: params.credentialId },
  });

  await prisma.credentialAccessLog.create({
    data: {
      credentialId: credential.id,
      actorUserId: params.actorUserId ?? null,
      action: "read_for_job",
      jobId: params.jobId ?? null,
    },
  });

  return {
    credential,
    secret: (await decryptSecret(credential.ciphertext)).plaintext,
  };
}
