import { loadEnvConfig } from "@next/env";
import {
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import fs from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ses = new SESv2Client({ region });
const emailManifestPath = path.join(process.cwd(), "storage", "staging", "email-manifest.json");

function getDomain() {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is required.");
  }

  const host = new URL(baseUrl).host;
  return host.startsWith("drylake.") ? host.slice("drylake.".length) : host;
}

async function ensureIdentity(domain: string) {
  try {
    return await ses.send(
      new GetEmailIdentityCommand({
        EmailIdentity: domain,
      }),
    );
  } catch {
    await ses.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
      }),
    );

    return ses.send(
      new GetEmailIdentityCommand({
        EmailIdentity: domain,
      }),
    );
  }
}

async function main() {
  const domain = getDomain();
  const mailFromDomain = `mail.${domain}`;

  await ensureIdentity(domain);
  await ses.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain,
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    }),
  );

  const identity = await ses.send(
    new GetEmailIdentityCommand({
      EmailIdentity: domain,
    }),
  );

  const dkimTokens = identity.DkimAttributes?.Tokens ?? [];
  const manifest = {
    region,
    domain,
    verifiedForSending: identity.VerifiedForSendingStatus ?? false,
    verificationStatus: identity.VerificationStatus ?? null,
    mailFrom: {
      domain: identity.MailFromAttributes?.MailFromDomain ?? mailFromDomain,
      status: identity.MailFromAttributes?.MailFromDomainStatus ?? null,
      behaviorOnMxFailure: identity.MailFromAttributes?.BehaviorOnMxFailure ?? null,
    },
    dnsRecords: [
      ...dkimTokens.map((token) => ({
        type: "CNAME",
        name: `${token}._domainkey.${domain}`,
        value: `${token}.dkim.amazonses.com`,
      })),
      {
        type: "MX",
        name: mailFromDomain,
        value: `10 feedback-smtp.${region}.amazonses.com`,
      },
      {
        type: "TXT",
        name: mailFromDomain,
        value: "\"v=spf1 include:amazonses.com -all\"",
      },
    ],
    note: "SES gives you transactional/domain email sending. It does not replace a human mailbox product.",
  };

  await fs.writeFile(emailManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
