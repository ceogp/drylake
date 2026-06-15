"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationRole } from "@/lib/services/access";
import {
  upsertTrustCompanyProfile,
  verifyTrustCompanyDomain,
} from "@/KYAregistry/services/submissions";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formList(formData: FormData, key: string) {
  return formData.getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function formTextareaList(formData: FormData, key: string) {
  return formText(formData, key)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function updateTrustCompanyProfileAction(formData: FormData) {
  const context = await requireOrganizationRole(["owner", "admin", "member"]);

  await upsertTrustCompanyProfile({
    organizationId: context.organization.id,
    profile: {
      legalName: formText(formData, "legalName"),
      displayName: formText(formData, "displayName"),
      country: formText(formData, "country"),
      sizeClass: formText(formData, "sizeClass") === "large" ? "large" : "small",
      websiteUrl: formText(formData, "websiteUrl"),
      primaryProductUrl: formText(formData, "primaryProductUrl") || undefined,
      businessContactEmail: formText(formData, "businessContactEmail") || undefined,
      securityContactEmail: formText(formData, "securityContactEmail") || undefined,
      privacyContactEmail: formText(formData, "privacyContactEmail") || undefined,
      githubOrganizationUrl: formText(formData, "githubOrganizationUrl") || undefined,
      packageRegistryLinks: formTextareaList(formData, "packageRegistryLinks"),
      description: formText(formData, "description") || undefined,
      categories: formList(formData, "categories") as never,
      japanMarketInterest: formList(formData, "japanMarketInterest") as never,
    },
  });

  revalidatePath("/app/company/profile");
  redirect("/app/products/mcp/submit");
}

export async function verifyTrustCompanyDomainAction(formData: FormData) {
  const context = await requireOrganizationRole(["owner", "admin", "member"]);
  const companyId = formText(formData, "companyId");
  const domain = formText(formData, "domain");

  if (!companyId || !domain) {
    throw new Error("companyId and domain are required.");
  }

  await verifyTrustCompanyDomain({
    organizationId: context.organization.id,
    companyId,
    domain,
  });

  revalidatePath("/app/company/profile");
}
