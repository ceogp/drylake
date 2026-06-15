import crypto from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  classifyMcpRisk,
  companySizeClassSchema,
  mcpPackageTypeSchema,
  mcpTransportSchema,
  scoreKyaQuestionnaire,
  trustProductCategorySchema,
  kyaQuestionnaireSchema,
} from "@/KYAregistry/services/registry";
import { toSlug } from "@/lib/utils/slug";

const emailSchema = z.string().trim().email().max(320);
const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  emailSchema.optional(),
);
const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);

export const trustCompanyProfileSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(160),
  country: z.string().trim().min(2).max(80),
  sizeClass: companySizeClassSchema.default("small"),
  websiteUrl: z.url(),
  primaryProductUrl: optionalUrlSchema,
  businessContactEmail: optionalEmailSchema,
  securityContactEmail: optionalEmailSchema,
  privacyContactEmail: optionalEmailSchema,
  githubOrganizationUrl: optionalUrlSchema,
  packageRegistryLinks: z.array(z.url()).max(20).default([]),
  description: z.string().trim().max(2000).optional(),
  categories: z.array(trustProductCategorySchema).max(10).default([]),
  japanMarketInterest: z.array(z.enum([
    "selling_into_japan",
    "looking_for_japanese_partners",
    "preparing_for_agentic_payments",
    "not_applicable",
  ])).max(4).default([]),
}).strict();

export const trustMcpSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  transport: mcpTransportSchema,
  packageType: mcpPackageTypeSchema.optional(),
  packageIdentifier: z.string().trim().max(240).optional(),
  repositoryUrl: optionalUrlSchema,
  officialRegistryUrl: optionalUrlSchema,
  remoteEndpoint: optionalUrlSchema,
  authMethod: z.string().trim().max(160).optional(),
  requiredEnvVars: z.array(z.string().trim().min(1).max(120)).max(80).default([]),
  requiresSecrets: z.boolean().default(false),
  filesystemAccess: z.enum(["none", "read", "write"]).default("none"),
  shellExecution: z.boolean().default(false),
  networkAccess: z.boolean().default(false),
  databaseWriteAccess: z.boolean().default(false),
  emailMessageAccess: z.boolean().default(false),
  walletPaymentAccess: z.boolean().default(false),
  productionWriteAccess: z.boolean().default(false),
  declaredTools: z.array(z.string().trim().min(1).max(160)).max(300).default([]),
  declaredResources: z.array(z.string().trim().min(1).max(160)).max(300).default([]),
  declaredPrompts: z.array(z.string().trim().min(1).max(160)).max(300).default([]),
}).strict();

export type TrustCompanyProfileInput = z.infer<typeof trustCompanyProfileSchema>;
export type TrustMcpSubmissionInput = z.infer<typeof trustMcpSubmissionSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function token() {
  return crypto.randomBytes(24).toString("base64url");
}

function normalizeDomain(input: string) {
  const url = new URL(input);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function companySlug(input: { displayName: string; organizationId: string }) {
  const baseSlug = toSlug(input.displayName) || "company";
  return `${baseSlug}-${input.organizationId.slice(0, 8).toLowerCase()}`;
}

async function getTrustCompanyForOrganization(organizationId: string) {
  return prisma.trustCompany.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}

async function upsertContact(input: {
  companyId: string;
  kind: string;
  email?: string;
}) {
  if (!input.email) {
    return null;
  }

  return prisma.trustCompanyContact.upsert({
    where: {
      companyId_kind_email: {
        companyId: input.companyId,
        kind: input.kind,
        email: input.email,
      },
    },
    update: {},
    create: {
      companyId: input.companyId,
      kind: input.kind,
      email: input.email,
    },
  });
}

export async function upsertTrustCompanyProfile(input: {
  organizationId: string;
  profile: TrustCompanyProfileInput;
}) {
  const parsed = trustCompanyProfileSchema.parse(input.profile);
  const domain = normalizeDomain(parsed.websiteUrl);
  const existing = await getTrustCompanyForOrganization(input.organizationId);
  const data = {
    legalName: parsed.legalName,
    displayName: parsed.displayName,
    country: parsed.country,
    sizeClass: parsed.sizeClass,
    websiteUrl: parsed.websiteUrl,
    primaryProductUrl: parsed.primaryProductUrl ?? null,
    businessContactEmail: parsed.businessContactEmail ?? null,
    securityContactEmail: parsed.securityContactEmail ?? null,
    privacyContactEmail: parsed.privacyContactEmail ?? null,
    githubOrganizationUrl: parsed.githubOrganizationUrl ?? null,
    packageRegistryLinksJson: toJson(parsed.packageRegistryLinks),
    description: parsed.description ?? null,
    categoriesJson: toJson(parsed.categories),
    japanMarketInterestJson: toJson(parsed.japanMarketInterest),
  };
  const company = existing
    ? await prisma.trustCompany.update({
      where: { id: existing.id },
      data,
    })
    : await prisma.trustCompany.create({
      data: {
        ...data,
        organizationId: input.organizationId,
        slug: companySlug({
          displayName: parsed.displayName,
          organizationId: input.organizationId,
        }),
      },
    });

  const verificationToken = token();
  const txtRecordName = `_xupra-verify.${domain}`;
  const txtRecordValue = `xupra-site-verification=${verificationToken}`;
  const domainRecord = await prisma.trustCompanyDomain.upsert({
    where: {
      companyId_domain: {
        companyId: company.id,
        domain,
      },
    },
    update: {
      verificationToken,
      txtRecordName,
      txtRecordValue,
      status: "pending",
      verifiedAt: null,
    },
    create: {
      companyId: company.id,
      domain,
      verificationToken,
      txtRecordName,
      txtRecordValue,
    },
  });

  await Promise.all([
    upsertContact({ companyId: company.id, kind: "business", email: parsed.businessContactEmail }),
    upsertContact({ companyId: company.id, kind: "security", email: parsed.securityContactEmail }),
    upsertContact({ companyId: company.id, kind: "privacy", email: parsed.privacyContactEmail }),
  ]);

  return {
    company,
    domainRecord,
  };
}

export async function verifyTrustCompanyDomain(input: {
  organizationId: string;
  companyId: string;
  domain: string;
}) {
  const company = await prisma.trustCompany.findFirst({
    where: {
      id: input.companyId,
      organizationId: input.organizationId,
    },
  });

  if (!company) {
    throw new Error("Trust company profile not found.");
  }

  const domainRecord = await prisma.trustCompanyDomain.findUnique({
    where: {
      companyId_domain: {
        companyId: company.id,
        domain: input.domain,
      },
    },
  });

  if (!domainRecord) {
    throw new Error("Domain verification record not found.");
  }

  const records = await resolveTxt(domainRecord.txtRecordName).catch(() => []);
  const flattened = records.map((record) => record.join(""));
  const verified = flattened.includes(domainRecord.txtRecordValue);

  const updated = await prisma.trustCompanyDomain.update({
    where: { id: domainRecord.id },
    data: {
      status: verified ? "verified" : "pending",
      verifiedAt: verified ? new Date() : null,
    },
  });

  if (verified) {
    await prisma.trustCompany.update({
      where: { id: company.id },
      data: {
        verifiedDomain: domainRecord.domain,
        status: company.status === "draft" ? "submitted" : company.status,
      },
    });
  }

  return {
    verified,
    domainRecord: updated,
    observedTxtRecords: flattened,
  };
}

export async function submitTrustMcpServer(input: {
  organizationId: string;
  submission: TrustMcpSubmissionInput;
}) {
  const company = await getTrustCompanyForOrganization(input.organizationId);

  if (!company) {
    throw new Error("Create a company profile before submitting an MCP server.");
  }

  const parsed = trustMcpSubmissionSchema.parse(input.submission);
  const riskClass = classifyMcpRisk({
    requiresSecrets: parsed.requiresSecrets,
    filesystemAccess: parsed.filesystemAccess,
    shellExecution: parsed.shellExecution,
    networkAccess: parsed.networkAccess,
    databaseWriteAccess: parsed.databaseWriteAccess,
    emailMessageAccess: parsed.emailMessageAccess,
    walletPaymentAccess: parsed.walletPaymentAccess,
    productionWriteAccess: parsed.productionWriteAccess,
  });
  const productSlug = toSlug(parsed.name) || "mcp-server";
  const product = await prisma.trustProduct.upsert({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: productSlug,
      },
    },
    update: {
      name: parsed.name,
      description: parsed.description ?? null,
      categoriesJson: toJson(["mcp_server"]),
      repositoryUrl: parsed.repositoryUrl ?? null,
      packageName: parsed.packageIdentifier ?? null,
      status: "submitted",
    },
    create: {
      companyId: company.id,
      name: parsed.name,
      slug: productSlug,
      description: parsed.description ?? null,
      categoriesJson: toJson(["mcp_server"]),
      repositoryUrl: parsed.repositoryUrl ?? null,
      packageName: parsed.packageIdentifier ?? null,
      status: "submitted",
    },
  });
  const mcpServer = await prisma.trustMcpServer.upsert({
    where: { productId: product.id },
    update: {
      companyId: company.id,
      transport: parsed.transport,
      packageType: parsed.packageType ?? null,
      packageIdentifier: parsed.packageIdentifier ?? null,
      repositoryUrl: parsed.repositoryUrl ?? null,
      officialRegistryUrl: parsed.officialRegistryUrl ?? null,
      remoteEndpoint: parsed.remoteEndpoint ?? null,
      authMethod: parsed.authMethod ?? null,
      requiredEnvVarsJson: toJson(parsed.requiredEnvVars),
      requiresSecrets: parsed.requiresSecrets,
      filesystemAccess: parsed.filesystemAccess,
      shellExecution: parsed.shellExecution,
      networkAccess: parsed.networkAccess,
      databaseWriteAccess: parsed.databaseWriteAccess,
      emailMessageAccess: parsed.emailMessageAccess,
      walletPaymentAccess: parsed.walletPaymentAccess,
      productionWriteAccess: parsed.productionWriteAccess,
      declaredToolsJson: toJson(parsed.declaredTools),
      declaredResourcesJson: toJson(parsed.declaredResources),
      declaredPromptsJson: toJson(parsed.declaredPrompts),
      declaredPermissionsJson: toJson({
        requiresSecrets: parsed.requiresSecrets,
        filesystemAccess: parsed.filesystemAccess,
        shellExecution: parsed.shellExecution,
        networkAccess: parsed.networkAccess,
        databaseWriteAccess: parsed.databaseWriteAccess,
        emailMessageAccess: parsed.emailMessageAccess,
        walletPaymentAccess: parsed.walletPaymentAccess,
        productionWriteAccess: parsed.productionWriteAccess,
      }),
      riskClass,
    },
    create: {
      productId: product.id,
      companyId: company.id,
      transport: parsed.transport,
      packageType: parsed.packageType ?? null,
      packageIdentifier: parsed.packageIdentifier ?? null,
      repositoryUrl: parsed.repositoryUrl ?? null,
      officialRegistryUrl: parsed.officialRegistryUrl ?? null,
      remoteEndpoint: parsed.remoteEndpoint ?? null,
      authMethod: parsed.authMethod ?? null,
      requiredEnvVarsJson: toJson(parsed.requiredEnvVars),
      requiresSecrets: parsed.requiresSecrets,
      filesystemAccess: parsed.filesystemAccess,
      shellExecution: parsed.shellExecution,
      networkAccess: parsed.networkAccess,
      databaseWriteAccess: parsed.databaseWriteAccess,
      emailMessageAccess: parsed.emailMessageAccess,
      walletPaymentAccess: parsed.walletPaymentAccess,
      productionWriteAccess: parsed.productionWriteAccess,
      declaredToolsJson: toJson(parsed.declaredTools),
      declaredResourcesJson: toJson(parsed.declaredResources),
      declaredPromptsJson: toJson(parsed.declaredPrompts),
      declaredPermissionsJson: toJson({
        requiresSecrets: parsed.requiresSecrets,
        filesystemAccess: parsed.filesystemAccess,
        shellExecution: parsed.shellExecution,
        networkAccess: parsed.networkAccess,
        databaseWriteAccess: parsed.databaseWriteAccess,
        emailMessageAccess: parsed.emailMessageAccess,
        walletPaymentAccess: parsed.walletPaymentAccess,
        productionWriteAccess: parsed.productionWriteAccess,
      }),
      riskClass,
    },
  });
  const scanOrder = await prisma.trustScanOrder.create({
    data: {
      companyId: company.id,
      productId: product.id,
      state: "submitted",
      scanType: "basic_safety_scan",
      requestedByEmail: company.businessContactEmail ?? company.securityContactEmail,
    },
  });

  return {
    company,
    product,
    mcpServer,
    scanOrder,
  };
}

export async function submitTrustKyaQuestionnaire(input: {
  organizationId?: string | null;
  companyId?: string | null;
  productId?: string | null;
  answers: unknown;
}) {
  const company = input.companyId
    ? await prisma.trustCompany.findUnique({ where: { id: input.companyId } })
    : input.organizationId
      ? await getTrustCompanyForOrganization(input.organizationId)
      : null;

  if (!company) {
    throw new Error("Create a company profile before submitting a KYA questionnaire.");
  }

  const scored = scoreKyaQuestionnaire(kyaQuestionnaireSchema.parse(input.answers));
  const product = input.productId
    ? await prisma.trustProduct.findFirst({
      where: {
        id: input.productId,
        companyId: company.id,
      },
    })
    : await prisma.trustProduct.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
    });

  const questionnaire = await prisma.trustKyaQuestionnaire.create({
    data: {
      companyId: company.id,
      productId: product?.id ?? null,
      answersJson: toJson(scored.answers),
      evidenceJson: toJson({
        paymentControlsDocumented: scored.paymentControlsDocumented,
      }),
      score: scored.score,
      kyaLevel: scored.kyaLevel,
    },
  });

  if (product) {
    await prisma.trustProduct.update({
      where: { id: product.id },
      data: { status: "submitted" },
    });
  }

  return {
    company,
    product,
    questionnaire,
  };
}

export async function getTrustRegistryWorkspace(organizationId: string) {
  const company = await getTrustCompanyForOrganization(organizationId);

  if (!company) {
    return {
      company: null,
      domains: [],
      products: [],
      certificates: [],
    };
  }

  const [domains, products, certificates] = await Promise.all([
    prisma.trustCompanyDomain.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trustProduct.findMany({
      where: { companyId: company.id },
      include: { mcpServer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trustCertificate.findMany({
      where: { companyId: company.id },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  return {
    company,
    domains,
    products,
    certificates,
  };
}
