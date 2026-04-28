import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/services/audit";
import { readCredentialForJob } from "@/lib/services/credentials";

function asJsonObject(value: Record<string, unknown> | null | undefined) {
  return (value ?? {}) as Prisma.InputJsonObject;
}

function twilioBundle(secret: string) {
  const parsed = JSON.parse(secret) as { accountSid: string; authToken: string };
  if (!parsed.accountSid || !parsed.authToken) {
    throw new Error("Twilio credential must be a JSON bundle with accountSid and authToken");
  }
  return parsed;
}

async function verifySlack(credentialId: string) {
  const { secret } = await readCredentialForJob({ credentialId });
  const response = await fetch("https://slack.com/api/auth.test", {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const payload = (await response.json()) as Record<string, unknown>;

  return {
    ok: response.ok && payload.ok === true,
    details: payload,
  };
}

async function verifyTwilioWhatsApp(credentialId: string) {
  const { secret } = await readCredentialForJob({ credentialId });
  const bundle = twilioBundle(secret);
  const auth = Buffer.from(`${bundle.accountSid}:${bundle.authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${bundle.accountSid}.json`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    },
  );

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    ok: response.ok,
    details: payload,
  };
}

export async function createIntegration(params: {
  organizationId: string;
  actorUserId: string;
  provider: string;
  credentialId?: string;
  config: Record<string, unknown>;
}) {
  const integration = await prisma.integration.upsert({
    where: {
      organizationId_provider: {
        organizationId: params.organizationId,
        provider: params.provider,
      },
    },
    update: {
      credentialId: params.credentialId ?? null,
      configJson: asJsonObject(params.config),
      status: "pending",
    },
    create: {
      organizationId: params.organizationId,
      provider: params.provider,
      credentialId: params.credentialId ?? null,
      configJson: asJsonObject(params.config),
      status: "pending",
    },
  });

  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    entityType: "integration",
    entityId: integration.id,
    action: "integration.upsert",
    metadata: {
      provider: params.provider,
    },
  });

  return integration;
}

export async function verifyIntegration(params: {
  integrationId: string;
  actorUserId: string;
}) {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: params.integrationId },
  });

  if (!integration.credentialId) {
    throw new Error("Integration is missing a credential");
  }

  const result =
    integration.provider === "slack"
      ? await verifySlack(integration.credentialId)
      : integration.provider === "twilio_whatsapp"
        ? await verifyTwilioWhatsApp(integration.credentialId)
        : { ok: true, details: { message: "No remote verification implemented for this provider" } };

  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: result.ok ? "active" : "error",
      lastVerifiedAt: result.ok ? new Date() : null,
      configJson: asJsonObject({
        ...((integration.configJson as Record<string, unknown> | null) ?? {}),
        lastVerification: result.details,
      }),
    },
  });

  await recordAuditEvent({
    organizationId: integration.organizationId,
    actorUserId: params.actorUserId,
    entityType: "integration",
    entityId: integration.id,
    action: "integration.verify",
    metadata: {
      provider: integration.provider,
      ok: result.ok,
    },
  });

  return {
    integration: updated,
    verification: result,
  };
}

async function sendSlackMessage(params: {
  credentialId: string;
  channel: string;
  text: string;
}) {
  const { secret } = await readCredentialForJob({ credentialId: params.credentialId });
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: params.channel,
      text: params.text,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    ok: response.ok && payload.ok === true,
    payload,
  };
}

async function sendWhatsAppMessage(params: {
  credentialId: string;
  fromNumber: string;
  toNumber: string;
  body: string;
}) {
  const { secret } = await readCredentialForJob({ credentialId: params.credentialId });
  const bundle = twilioBundle(secret);
  const auth = Buffer.from(`${bundle.accountSid}:${bundle.authToken}`).toString("base64");
  const body = new URLSearchParams({
    From: params.fromNumber,
    To: params.toNumber,
    Body: params.body,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${bundle.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;

  return {
    ok: response.ok,
    payload,
  };
}

export async function sendTestIntegrationMessage(params: {
  integrationId: string;
  actorUserId: string;
}) {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: params.integrationId },
  });

  if (!integration.credentialId) {
    throw new Error("Integration is missing a credential");
  }

  const config = ((integration.configJson as Record<string, unknown> | null) ?? {});
  const text = "Xupra DryLake test notification";

  const result =
    integration.provider === "slack"
      ? await sendSlackMessage({
          credentialId: integration.credentialId,
          channel: String(config.channelId ?? ""),
          text,
        })
      : integration.provider === "twilio_whatsapp"
        ? await sendWhatsAppMessage({
            credentialId: integration.credentialId,
            fromNumber: String(config.fromNumber ?? ""),
            toNumber: String(config.toNumber ?? ""),
            body: text,
          })
        : { ok: true, payload: { message: "No outbound test implemented for this provider" } };

  await recordAuditEvent({
    organizationId: integration.organizationId,
    actorUserId: params.actorUserId,
    entityType: "integration",
    entityId: integration.id,
    action: "integration.test_message",
    metadata: {
      provider: integration.provider,
      ok: result.ok,
    },
  });

  return result;
}

export async function notifyOrganizationIntegrations(params: {
  organizationId: string;
  event: string;
  text: string;
}) {
  const integrations = await prisma.integration.findMany({
    where: {
      organizationId: params.organizationId,
      status: "active",
    },
  });

  for (const integration of integrations) {
    try {
      if (!integration.credentialId) {
        continue;
      }

      const config = ((integration.configJson as Record<string, unknown> | null) ?? {});

      if (integration.provider === "slack" && config.channelId) {
        await sendSlackMessage({
          credentialId: integration.credentialId,
          channel: String(config.channelId),
          text: `[${params.event}] ${params.text}`,
        });
      }

      if (integration.provider === "twilio_whatsapp" && config.fromNumber && config.toNumber) {
        await sendWhatsAppMessage({
          credentialId: integration.credentialId,
          fromNumber: String(config.fromNumber),
          toNumber: String(config.toNumber),
          body: `[${params.event}] ${params.text}`,
        });
      }
    } catch (error) {
      console.error("Failed to send integration notification", error);
    }
  }
}
