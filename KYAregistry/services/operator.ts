import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createAndSendTrustInvoice,
  isTrustInvoicePaid,
  onboardingScanInvoiceLineItems,
  type TrustInvoiceLineItem,
} from "@/KYAregistry/services/billing";
import {
  createSignedTrustCertificate,
  type CertificateSigner,
} from "@/KYAregistry/services/certificates";
import { getCertifiedOperationalBindingForAsset } from "@/KYAregistry/services/handshake";
import { publishTrustCertificateArtifacts } from "@/KYAregistry/services/publication";
import {
  TRUST_REGISTRY_STANDARD_LABEL,
  TRUST_REGISTRY_STANDARD_VERSION,
  formatCertificateId,
} from "@/KYAregistry/services/registry";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils/slug";

const registryCaseStatusSchema = z.enum([
  "discovered",
  "contacted",
  "interested",
  "invoiced",
  "paid",
  "testing",
  "remediation",
  "certified",
  "listed",
  "declined",
]);

const registryAssetTypeSchema = z.enum([
  "mcp_server",
  "agent",
  "agent_card",
  "tool_gateway",
  "package",
  "repository",
]);

const registryTestProviderSchema = z.enum([
  "manual_review",
  "aws_codeguru_security",
  "drylake_mcp_agent",
  "drylake_agent_transaction",
  "external_lab",
]);

const registryTestTypeSchema = z.enum([
  "mcp_capability_scan",
  "agent_identity_scan",
  "agent_to_agent_transaction_check",
  "code_security_scan",
  "package_integrity_scan",
  "kya_controls_review",
]);

const testRunStatusSchema = z.enum(["queued", "running", "passed", "failed", "needs_remediation"]);
const certificateStatusSchema = z.enum(["active", "suspended", "revoked", "expired"]);

export const registryAssetInputSchema = z.object({
  assetType: registryAssetTypeSchema.default("mcp_server"),
  name: z.string().trim().min(1).max(200),
  sourceUrl: z.url().optional(),
  packageName: z.string().trim().max(240).optional(),
  repositoryUrl: z.url().optional(),
  endpointUrl: z.url().optional(),
  agentCardUrl: z.url().optional(),
  did: z.string().trim().max(240).optional(),
  protocol: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const createRegistryCaseInputSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  websiteUrl: z.url(),
  country: z.string().trim().min(2).max(80).default("Unknown"),
  primaryContactEmail: z.email().optional(),
  discoveredSource: z.string().trim().max(160).optional(),
  discoveredUrl: z.url().optional(),
  rippleEcosystemScope: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(4000).optional(),
  asset: registryAssetInputSchema.optional(),
}).strict();

export const createRegistryInvoiceInputSchema = z.object({
  registryCaseId: z.string().trim().min(1),
  customerEmail: z.email().optional(),
  amountUsdCents: z.number().int().min(100).max(1_000_000).optional(),
  description: z.string().trim().min(1).max(240).optional(),
  daysUntilDue: z.number().int().min(1).max(90).optional(),
}).strict();

export const recordRegistryEventInputSchema = z.object({
  registryCaseId: z.string().trim().min(1),
  eventType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(4000).optional(),
  actor: z.string().trim().max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const recordRegistryTestRunInputSchema = z.object({
  registryCaseId: z.string().trim().min(1),
  registryAssetId: z.string().trim().min(1).optional(),
  provider: registryTestProviderSchema,
  testType: registryTestTypeSchema,
  status: testRunStatusSchema.default("queued"),
  externalJobId: z.string().trim().max(240).optional(),
  recommendation: z.string().trim().max(2000).optional(),
  riskClass: z.string().trim().max(40).optional(),
  kyaLevel: z.string().trim().max(40).optional(),
  criticalFindings: z.number().int().min(0).default(0),
  highFindings: z.number().int().min(0).default(0),
  mediumFindings: z.number().int().min(0).default(0),
  lowFindings: z.number().int().min(0).default(0),
  summary: z.record(z.string(), z.unknown()).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const issueRegistryCertificateInputSchema = z.object({
  registryCaseId: z.string().trim().min(1),
  registryAssetId: z.string().trim().min(1).optional(),
  riskClass: z.string().trim().max(40).optional(),
  kyaLevel: z.string().trim().max(40).optional(),
  expiresInDays: z.number().int().min(30).max(1095).default(365),
  reviewer: z.string().trim().max(160).optional(),
}).strict();

export const updateRegistryCertificateStatusInputSchema = z.object({
  certificateId: z.string().trim().min(1),
  status: certificateStatusSchema,
  reason: z.string().trim().max(4000).optional(),
  actor: z.string().trim().max(160).optional(),
}).strict();

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function newCaseNumber() {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `KYA-${year}-${suffix}`;
}

function companySlug(input: { companyName: string; caseNumber: string }) {
  return `${toSlug(input.companyName) || "company"}-${input.caseNumber.toLowerCase()}`;
}

function certificateDomain(websiteUrl: string | null | undefined) {
  if (!websiteUrl) {
    return "unverified";
  }

  try {
    return new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unverified";
  }
}

function latestCompletedTestRun<
  T extends {
    createdAt: Date;
    riskClass: string | null;
    kyaLevel: string | null;
    criticalFindings: number;
    highFindings: number;
  },
>(testRuns: T[]) {
  return [...testRuns]
    .filter((run) => run.riskClass || run.kyaLevel || run.criticalFindings || run.highFindings)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

function registryCaseHasConfirmedPayment(input: {
  paymentStatus: string;
  billingInvoices: Array<{
    status: string;
    paidAt: Date | null;
  }>;
}) {
  return input.paymentStatus === "paid" || input.billingInvoices.some((invoice) => isTrustInvoicePaid(invoice));
}

export function isUsableRegistryCertificate(
  input: { status: string; expiresAt: Date },
  referenceTime = new Date(),
) {
  return input.status === "active" && input.expiresAt.getTime() > referenceTime.getTime();
}

export function isRegistryCertificateExpiringWithinDays(
  input: { expiresAt: Date },
  days: number,
  referenceTime = new Date(),
) {
  const msUntilExpiry = input.expiresAt.getTime() - referenceTime.getTime();
  return msUntilExpiry > 0 && msUntilExpiry <= days * 24 * 60 * 60 * 1000;
}

export function canActivateRegistryCertificate(
  input: { expiresAt: Date },
  referenceTime = new Date(),
) {
  return input.expiresAt.getTime() > referenceTime.getTime();
}

export async function ensureDefaultAgentTransactionStandard() {
  return prisma.trustRegistryStandard.upsert({
    where: {
      slug_version: {
        slug: "kya-agent-transaction-standard",
        version: TRUST_REGISTRY_STANDARD_VERSION,
      },
    },
    update: {
      title: TRUST_REGISTRY_STANDARD_LABEL,
      status: "active",
      ecosystem: "agent_to_agent",
    },
    create: {
      slug: "kya-agent-transaction-standard",
      version: TRUST_REGISTRY_STANDARD_VERSION,
      title: TRUST_REGISTRY_STANDARD_LABEL,
      status: "active",
      summary: "Baseline hosted credential standard for MCP servers and agents participating in agent-to-agent transactions.",
      ecosystem: "agent_to_agent",
      controlsJson: toJson({
        identity: [
          "Stable agent or server identity",
          "Accountable company identity",
          "Public endpoint, package, repository, or agent card binding",
        ],
        safety: [
          "Declared MCP tools/resources/prompts",
          "Credential and private-key boundary review",
          "No hidden shell, payment, wallet, production, or exfiltration behavior",
        ],
        transactions: [
          "Agent-to-agent verification URL",
          "Revocation-aware hosted certificate status",
          "Certificate subject maps to the reviewed company and asset",
        ],
      }),
      credentialSchemaJson: toJson({
        type: "XupraKnowYourAgentCertificate",
        hostedVerification: true,
        embeddableFields: ["certificateId", "publicUrl", "issuer.did", "subject", "review"],
      }),
    },
  });
}

export async function createRegistryCase(input: unknown) {
  const parsed = createRegistryCaseInputSchema.parse(input);
  const standard = await ensureDefaultAgentTransactionStandard();
  const caseNumber = newCaseNumber();

  return prisma.$transaction(async (tx) => {
    const company = await tx.trustCompany.create({
      data: {
        organizationId: null,
        legalName: parsed.companyName,
        displayName: parsed.companyName,
        slug: companySlug({ companyName: parsed.companyName, caseNumber }),
        country: parsed.country,
        websiteUrl: parsed.websiteUrl,
        businessContactEmail: parsed.primaryContactEmail ?? null,
        categoriesJson: toJson(["mcp_server", "ai_agent_platform"]),
        status: "lead",
      },
    });

    const registryCase = await tx.trustRegistryCase.create({
      data: {
        caseNumber,
        companyId: company.id,
        standardId: standard.id,
        status: "discovered",
        companyName: parsed.companyName,
        websiteUrl: parsed.websiteUrl,
        primaryContactEmail: parsed.primaryContactEmail ?? null,
        discoveredSource: parsed.discoveredSource ?? null,
        discoveredUrl: parsed.discoveredUrl ?? null,
        rippleEcosystemScope: parsed.rippleEcosystemScope ?? null,
        notes: parsed.notes ?? null,
      },
    });

    const asset = parsed.asset
      ? await tx.trustRegistryAsset.create({
        data: {
          registryCaseId: registryCase.id,
          companyId: company.id,
          assetType: parsed.asset.assetType,
          name: parsed.asset.name,
          sourceUrl: parsed.asset.sourceUrl ?? null,
          packageName: parsed.asset.packageName ?? null,
          repositoryUrl: parsed.asset.repositoryUrl ?? null,
          endpointUrl: parsed.asset.endpointUrl ?? null,
          agentCardUrl: parsed.asset.agentCardUrl ?? null,
          did: parsed.asset.did ?? null,
          protocol: parsed.asset.protocol ?? null,
          description: parsed.asset.description ?? null,
          metadataJson: parsed.asset.metadata ? toJson(parsed.asset.metadata) : undefined,
        },
      })
      : null;

    await tx.trustRegistryEvent.create({
      data: {
        registryCaseId: registryCase.id,
        eventType: "discovered",
        title: "Company and agent asset discovered",
        detail: parsed.discoveredUrl ?? parsed.websiteUrl,
      },
    });

    return { case: registryCase, company, asset };
  });
}

export async function recordRegistryEvent(input: unknown) {
  const parsed = recordRegistryEventInputSchema.parse(input);

  return prisma.trustRegistryEvent.create({
    data: {
      registryCaseId: parsed.registryCaseId,
      eventType: parsed.eventType,
      title: parsed.title,
      detail: parsed.detail ?? null,
      actor: parsed.actor ?? null,
      metadataJson: parsed.metadata ? toJson(parsed.metadata) : undefined,
    },
  });
}

export async function createRegistryCaseInvoice(input: unknown) {
  const parsed = createRegistryInvoiceInputSchema.parse(input);
  const registryCase = await prisma.trustRegistryCase.findUnique({
    where: { id: parsed.registryCaseId },
    include: { company: true },
  });

  if (!registryCase) {
    throw new Error("KYA registry case not found.");
  }

  const customerEmail = parsed.customerEmail ?? registryCase.primaryContactEmail ?? registryCase.company?.businessContactEmail;
  if (!customerEmail) {
    throw new Error("A customer email is required before sending a KYA registry invoice.");
  }

  const lineItems: TrustInvoiceLineItem[] = parsed.amountUsdCents
    ? [{
      description: parsed.description ?? "Xupra KYA hosted agent certificate review",
      amountUsdCents: parsed.amountUsdCents,
      quantity: 1,
    }]
    : onboardingScanInvoiceLineItems();

  const invoice = await createAndSendTrustInvoice({
    organizationId: registryCase.organizationId,
    companyId: registryCase.companyId,
    registryCaseId: registryCase.id,
    purpose: "onboarding_scan",
    customerEmail,
    customerName: registryCase.companyName,
    lineItems,
    daysUntilDue: parsed.daysUntilDue,
  });

  if (invoice.configured) {
    await prisma.$transaction([
      prisma.trustRegistryCase.update({
        where: { id: registryCase.id },
        data: {
          status: "invoiced",
          paymentStatus: "invoiced",
          outreachStatus: "responded",
        },
      }),
      prisma.trustRegistryEvent.create({
        data: {
          registryCaseId: registryCase.id,
          eventType: "invoice_sent",
          title: "Stripe invoice sent",
          detail: invoice.hostedInvoiceUrl ?? undefined,
          metadataJson: toJson({
            invoiceId: invoice.invoice.id,
            hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          }),
        },
      }),
    ]);
  }

  return invoice;
}

export async function recordRegistryTestRun(input: unknown) {
  const parsed = recordRegistryTestRunInputSchema.parse(input);
  const registryCase = await prisma.trustRegistryCase.findUnique({
    where: { id: parsed.registryCaseId },
    select: {
      id: true,
      paymentStatus: true,
      billingInvoices: {
        select: {
          status: true,
          paidAt: true,
        },
      },
    },
  });

  if (!registryCase) {
    throw new Error("KYA registry case not found.");
  }

  if (!registryCaseHasConfirmedPayment(registryCase)) {
    throw new Error("KYA testing requires a paid invoice. Wait for Stripe payment confirmation before recording test runs.");
  }

  if (parsed.registryAssetId) {
    const asset = await prisma.trustRegistryAsset.findFirst({
      where: {
        id: parsed.registryAssetId,
        registryCaseId: parsed.registryCaseId,
      },
      select: { id: true },
    });

    if (!asset) {
      throw new Error("KYA registry asset does not belong to this case.");
    }
  }

  const result = await prisma.trustRegistryTestRun.create({
    data: {
      registryCaseId: parsed.registryCaseId,
      registryAssetId: parsed.registryAssetId ?? null,
      provider: parsed.provider,
      testType: parsed.testType,
      status: parsed.status,
      externalJobId: parsed.externalJobId ?? null,
      recommendation: parsed.recommendation ?? null,
      riskClass: parsed.riskClass ?? null,
      kyaLevel: parsed.kyaLevel ?? null,
      criticalFindings: parsed.criticalFindings,
      highFindings: parsed.highFindings,
      mediumFindings: parsed.mediumFindings,
      lowFindings: parsed.lowFindings,
      summaryJson: parsed.summary ? toJson(parsed.summary) : undefined,
      evidenceJson: parsed.evidence ? toJson(parsed.evidence) : undefined,
      startedAt: parsed.status === "running" ? new Date() : null,
      finishedAt: ["passed", "failed", "needs_remediation"].includes(parsed.status) ? new Date() : null,
    },
  });

  await prisma.trustRegistryCase.update({
    where: { id: parsed.registryCaseId },
    data: {
      status: parsed.status === "needs_remediation" ? "remediation" : "testing",
      reviewStatus: parsed.status,
    },
  });

  return result;
}

export async function issueHostedAgentCertificate(input: unknown, signer?: CertificateSigner) {
  const parsed = issueRegistryCertificateInputSchema.parse(input);
  const registryCase = await prisma.trustRegistryCase.findUnique({
    where: { id: parsed.registryCaseId },
    include: {
      company: true,
      standard: true,
      assets: true,
      testRuns: true,
      billingInvoices: {
        select: {
          status: true,
          paidAt: true,
        },
      },
    },
  });

  if (!registryCase?.company) {
    throw new Error("A KYA registry case requires a company before a certificate can be issued.");
  }

  if (!registryCaseHasConfirmedPayment(registryCase)) {
    throw new Error("KYA certificate issuance requires a paid invoice. Wait for Stripe payment confirmation before issuing a certificate.");
  }

  const company = registryCase.company;
  const asset = parsed.registryAssetId
    ? registryCase.assets.find((item) => item.id === parsed.registryAssetId)
    : registryCase.assets[0];

  if (!asset) {
    throw new Error("A KYA registry case requires an agent or MCP asset before a certificate can be issued.");
  }

  const latestRun = latestCompletedTestRun(registryCase.testRuns);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + parsed.expiresInDays * 24 * 60 * 60 * 1000);
  const sequence = await prisma.trustCertificate.count({
    where: {
      issuedAt: {
        gte: new Date(Date.UTC(issuedAt.getUTCFullYear(), 0, 1)),
      },
    },
  }) + 1;
  const certificateId = formatCertificateId({
    scope: "XMKS-KYA",
    issuedAt,
    sequence,
  });
  const riskClass = parsed.riskClass ?? latestRun?.riskClass ?? "MCP-R0";
  const kyaLevel = parsed.kyaLevel ?? latestRun?.kyaLevel ?? "KYA-L1";
  const operationalBinding = getCertifiedOperationalBindingForAsset(asset);
  const signed = await createSignedTrustCertificate({
    certificateId,
    subject: {
      companyName: company.displayName,
      domain: certificateDomain(company.websiteUrl),
      country: company.country,
    },
    reviewedProduct: {
      name: asset.name,
      category: [asset.assetType],
      repository: asset.repositoryUrl,
      package: asset.packageName,
      url: asset.endpointUrl ?? asset.agentCardUrl ?? asset.sourceUrl,
    },
    subjectBinding: operationalBinding ?? undefined,
    review: {
      scanType: registryCase.standard?.title ?? TRUST_REGISTRY_STANDARD_LABEL,
      riskClass,
      kyaLevel,
      criticalFindings: latestRun?.criticalFindings ?? 0,
      highFindings: latestRun?.highFindings ?? 0,
      reviewedAt: issuedAt.toISOString(),
    },
    evidence: {
      registryCaseId: registryCase.id,
      registryAssetId: asset.id,
      standard: registryCase.standard?.version ?? TRUST_REGISTRY_STANDARD_VERSION,
      testRuns: registryCase.testRuns.map((run) => ({
        id: run.id,
        provider: run.provider,
        testType: run.testType,
        status: run.status,
        riskClass: run.riskClass,
        kyaLevel: run.kyaLevel,
        criticalFindings: run.criticalFindings,
        highFindings: run.highFindings,
      })),
    },
    issuedAt,
    expiresAt,
  }, signer);
  const publication = await publishTrustCertificateArtifacts({
    certificateId,
    publicUrl: signed.publicUrl,
    badgeUrl: signed.badgeUrl,
    signedCertificateJson: signed.certificate,
    canonicalJson: signed.canonicalJson,
    manifest: {
      issuer: signed.certificate.issuer,
      companyName: company.displayName,
      assetName: asset.name,
      assetType: asset.assetType,
      standardVersion: registryCase.standard?.version ?? TRUST_REGISTRY_STANDARD_VERSION,
      riskClass,
      kyaLevel,
      signatureAlgorithm: signed.signatureAlgorithm,
      evidenceHash: signed.evidenceHash,
    },
  });

  const certificate = await prisma.$transaction(async (tx) => {
    const created = await tx.trustCertificate.create({
      data: {
        certificateId,
        companyId: company.id,
        registryCaseId: registryCase.id,
        registryAssetId: asset.id,
        status: "active",
        scopeJson: toJson({
          type: "agent_to_agent_hosted_certificate",
          assetType: asset.assetType,
          verificationMode: "online_status_and_signature",
          embeddableUrl: signed.publicUrl,
          publication: publication
            ? {
              backend: publication.driver === "s3" ? "aws_s3" : "local_filesystem",
              publishedAt: publication.publishedAt,
              signedCertificateObjectKey: publication.signedCertificateObjectKey,
              canonicalObjectKey: publication.canonicalObjectKey,
              manifestObjectKey: publication.manifestObjectKey,
              checksums: publication.checksums,
            }
            : null,
          handshake: operationalBinding
            ? {
              supported: true,
              subjectBinding: operationalBinding,
            }
            : {
              supported: false,
            },
        }),
        standardVersion: registryCase.standard?.version ?? TRUST_REGISTRY_STANDARD_VERSION,
        riskClass,
        kyaLevel,
        issuedAt,
        expiresAt,
        evidenceHash: signed.evidenceHash,
        canonicalJson: toJson(signed.canonicalJson),
        signedCertificateJson: toJson(signed.certificate),
        signature: signed.signature,
        signatureAlgorithm: signed.signatureAlgorithm,
        publicUrl: signed.publicUrl,
        badgeUrl: signed.badgeUrl,
      },
    });

    await tx.trustCertificateStatusEvent.create({
      data: {
        certificateDbId: created.id,
        status: "active",
        reason: "Initial KYA hosted certificate issuance.",
      },
    });

    await tx.trustBadge.create({
      data: {
        certificateDbId: created.id,
        certificateId: created.certificateId,
        status: "active",
        lastRenderedAt: new Date(),
      },
    });

    await tx.trustRegistryCase.update({
      where: { id: registryCase.id },
      data: {
        status: "certified",
        reviewStatus: "passed",
        publicListingEnabled: true,
      },
    });

    await tx.trustRegistryEvent.create({
      data: {
        registryCaseId: registryCase.id,
        eventType: "certificate_issued",
        title: "Hosted KYA certificate issued",
        actor: parsed.reviewer ?? null,
        detail: signed.publicUrl,
        metadataJson: toJson({
          certificateId,
          publicUrl: signed.publicUrl,
          badgeUrl: signed.badgeUrl,
          publication: publication
            ? {
              backend: publication.driver === "s3" ? "aws_s3" : "local_filesystem",
              publishedAt: publication.publishedAt,
            }
            : null,
        }),
      },
    });

    return created;
  });

  return {
    certificate,
    signed,
  };
}

export async function updateRegistryCertificateStatus(input: unknown) {
  const parsed = updateRegistryCertificateStatusInputSchema.parse(input);
  const now = new Date();
  const certificate = await prisma.trustCertificate.findUnique({
    where: { certificateId: parsed.certificateId },
    select: {
      id: true,
      certificateId: true,
      status: true,
      expiresAt: true,
      registryCaseId: true,
      registryCase: {
        select: {
          id: true,
          status: true,
          publicListingEnabled: true,
        },
      },
    },
  });

  if (!certificate) {
    throw new Error("KYA certificate not found.");
  }

  if (
    parsed.status === "active" &&
    certificate.status !== "active" &&
    certificate.expiresAt.getTime() <= now.getTime()
  ) {
    throw new Error("Expired certificates cannot be reactivated. Issue a new certificate instead.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.trustCertificate.update({
      where: { id: certificate.id },
      data: {
        status: parsed.status,
        lastCheckedAt: now,
      },
    });

    if (parsed.status !== certificate.status || parsed.reason) {
      const defaultReason =
        parsed.status === certificate.status
          ? "Certificate status reviewed with no state change."
          : `Certificate status changed from ${certificate.status} to ${parsed.status}.`;

      await tx.trustCertificateStatusEvent.create({
        data: {
          certificateDbId: certificate.id,
          status: parsed.status,
          reason: parsed.reason ?? defaultReason,
        },
      });

      if (certificate.registryCaseId) {
        await tx.trustRegistryEvent.create({
          data: {
            registryCaseId: certificate.registryCaseId,
            eventType: "certificate_status_updated",
            title: `Certificate ${parsed.status}`,
            detail: parsed.reason ?? defaultReason,
            actor: parsed.actor ?? null,
            metadataJson: toJson({
              certificateId: certificate.certificateId,
              previousStatus: certificate.status,
              nextStatus: parsed.status,
            }),
          },
        });
      }
    }

    if (certificate.registryCaseId && parsed.status !== "active") {
      const remainingActiveCertificates = await tx.trustCertificate.count({
        where: {
          registryCaseId: certificate.registryCaseId,
          id: { not: certificate.id },
          status: "active",
          expiresAt: { gt: now },
        },
      });

      if (remainingActiveCertificates === 0 && certificate.registryCase?.publicListingEnabled) {
        await tx.trustRegistryCase.update({
          where: { id: certificate.registryCaseId },
          data: {
            publicListingEnabled: false,
            ...(certificate.registryCase.status === "listed"
              ? { status: "certified" }
              : {}),
          },
        });
      }
    }

    return updated;
  });
}

export async function listRegistryCases() {
  return prisma.trustRegistryCase.findMany({
    include: {
      company: true,
      standard: true,
      assets: true,
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      billingInvoices: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      certificates: {
        orderBy: { issuedAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRegistryCompanies() {
  return prisma.trustCompany.findMany({
    where: {
      OR: [
        { registryCases: { some: {} } },
        { registryAssets: { some: {} } },
        { certificates: { some: {} } },
      ],
    },
    include: {
      domains: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
      contacts: {
        orderBy: [{ kind: "asc" }, { email: "asc" }],
      },
      registryAssets: {
        orderBy: { updatedAt: "desc" },
        take: 6,
      },
      registryCases: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          assets: {
            orderBy: { updatedAt: "desc" },
          },
          testRuns: {
            orderBy: { createdAt: "desc" },
            take: 2,
          },
          billingInvoices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          certificates: {
            orderBy: { issuedAt: "desc" },
          },
        },
      },
      certificates: {
        orderBy: { issuedAt: "desc" },
      },
      _count: {
        select: {
          registryCases: true,
          registryAssets: true,
          certificates: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRegistryCertificates() {
  return prisma.trustCertificate.findMany({
    where: {
      registryCaseId: { not: null },
    },
    include: {
      company: true,
      registryAsset: true,
      registryCase: {
        select: {
          id: true,
          caseNumber: true,
          publicListingEnabled: true,
        },
      },
      badge: true,
      statusEvents: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: [{ issuedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export {
  certificateStatusSchema,
  registryAssetTypeSchema,
  registryCaseStatusSchema,
  registryTestProviderSchema,
  registryTestTypeSchema,
};
