"use server";

import { revalidatePath } from "next/cache";

import {
  createRegistryCase,
  createRegistryCaseInvoice,
  isUsableRegistryCertificate,
  issueHostedAgentCertificate,
  recordRegistryEvent,
  recordRegistryTestRun,
  updateRegistryCertificateStatus,
} from "@/KYAregistry/services/operator";
import { requireAdminActionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? Number(value) : undefined;
}

function revalidateRegistryOperatorViews() {
  revalidatePath("/admin/kya-registry", "layout");
  revalidatePath("/portal/kya-registry", "layout");
}

function revalidateRegistryPublicViews(certificateId?: string) {
  revalidatePath("/kya-registry/registry");
  revalidatePath("/kya-registry/certificates/[certificateId]", "page");

  if (certificateId) {
    revalidatePath(`/kya-registry/badges/${encodeURIComponent(certificateId)}`);
  }
}

export async function createRegistryCaseAction(formData: FormData) {
  await requireAdminActionAccess();

  await createRegistryCase({
    companyName: text(formData, "companyName"),
    websiteUrl: text(formData, "websiteUrl"),
    country: optionalText(formData, "country") ?? "Unknown",
    primaryContactEmail: optionalText(formData, "primaryContactEmail"),
    discoveredSource: optionalText(formData, "discoveredSource"),
    discoveredUrl: optionalText(formData, "discoveredUrl"),
    rippleEcosystemScope: optionalText(formData, "rippleEcosystemScope"),
    notes: optionalText(formData, "notes"),
    asset: {
      assetType: optionalText(formData, "assetType") ?? "mcp_server",
      name: text(formData, "assetName"),
      sourceUrl: optionalText(formData, "assetSourceUrl"),
      packageName: optionalText(formData, "packageName"),
      repositoryUrl: optionalText(formData, "repositoryUrl"),
      endpointUrl: optionalText(formData, "endpointUrl"),
      agentCardUrl: optionalText(formData, "agentCardUrl"),
      did: optionalText(formData, "did"),
      protocol: optionalText(formData, "protocol"),
      description: optionalText(formData, "assetDescription"),
    },
  });

  revalidateRegistryOperatorViews();
}

export async function recordRegistryEventAction(formData: FormData) {
  const actor = await requireAdminActionAccess();

  await recordRegistryEvent({
    registryCaseId: text(formData, "registryCaseId"),
    eventType: text(formData, "eventType"),
    title: text(formData, "title"),
    detail: optionalText(formData, "detail"),
    actor,
  });

  revalidateRegistryOperatorViews();
}

export async function createRegistryInvoiceAction(formData: FormData) {
  await requireAdminActionAccess();

  await createRegistryCaseInvoice({
    registryCaseId: text(formData, "registryCaseId"),
    customerEmail: optionalText(formData, "customerEmail"),
    amountUsdCents: optionalNumber(formData, "amountUsdCents"),
    description: optionalText(formData, "description"),
    daysUntilDue: optionalNumber(formData, "daysUntilDue"),
  });

  revalidateRegistryOperatorViews();
}

export async function recordRegistryTestRunAction(formData: FormData) {
  await requireAdminActionAccess();

  await recordRegistryTestRun({
    registryCaseId: text(formData, "registryCaseId"),
    registryAssetId: optionalText(formData, "registryAssetId"),
    provider: text(formData, "provider"),
    testType: text(formData, "testType"),
    status: optionalText(formData, "status") ?? "queued",
    externalJobId: optionalText(formData, "externalJobId"),
    recommendation: optionalText(formData, "recommendation"),
    riskClass: optionalText(formData, "riskClass"),
    kyaLevel: optionalText(formData, "kyaLevel"),
    criticalFindings: optionalNumber(formData, "criticalFindings") ?? 0,
    highFindings: optionalNumber(formData, "highFindings") ?? 0,
    mediumFindings: optionalNumber(formData, "mediumFindings") ?? 0,
    lowFindings: optionalNumber(formData, "lowFindings") ?? 0,
  });

  revalidateRegistryOperatorViews();
}

export async function issueRegistryCertificateAction(formData: FormData) {
  const reviewer = await requireAdminActionAccess();

  const result = await issueHostedAgentCertificate({
    registryCaseId: text(formData, "registryCaseId"),
    registryAssetId: optionalText(formData, "registryAssetId"),
    riskClass: optionalText(formData, "riskClass"),
    kyaLevel: optionalText(formData, "kyaLevel"),
    expiresInDays: optionalNumber(formData, "expiresInDays") ?? 365,
    reviewer,
  });

  revalidateRegistryOperatorViews();
  revalidateRegistryPublicViews(result.certificate.certificateId);
}

export async function setRegistryCaseListingAction(formData: FormData) {
  await requireAdminActionAccess();
  const registryCaseId = text(formData, "registryCaseId");
  const enabled = text(formData, "publicListingEnabled") === "true";
  const registryCase = await prisma.trustRegistryCase.findUnique({
    where: { id: registryCaseId },
    include: {
      certificates: {
        select: {
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!registryCase) {
    throw new Error("KYA registry case not found.");
  }

  if (enabled && !registryCase.certificates.some((certificate) => isUsableRegistryCertificate(certificate))) {
    throw new Error("A public registry listing requires at least one active unexpired certificate.");
  }

  await prisma.trustRegistryCase.update({
    where: { id: registryCaseId },
    data: {
      publicListingEnabled: enabled,
      ...(enabled
        ? { status: "listed" }
        : registryCase.status === "listed"
          ? { status: "certified" }
          : {}),
    },
  });

  revalidateRegistryOperatorViews();
  revalidateRegistryPublicViews();
}

export async function setRegistryCertificateStatusAction(formData: FormData) {
  const actor = await requireAdminActionAccess();
  const certificateId = text(formData, "certificateId");

  await updateRegistryCertificateStatus({
    certificateId,
    status: text(formData, "status"),
    reason: optionalText(formData, "reason"),
    actor,
  });

  revalidateRegistryOperatorViews();
  revalidateRegistryPublicViews(certificateId);
}
