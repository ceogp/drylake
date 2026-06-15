"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationRole } from "@/lib/services/access";
import { submitTrustMcpServer } from "@/KYAregistry/services/submissions";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function textareaList(formData: FormData, key: string) {
  return formText(formData, key)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function submitTrustMcpServerAction(formData: FormData) {
  const context = await requireOrganizationRole(["owner", "admin", "member"]);

  await submitTrustMcpServer({
    organizationId: context.organization.id,
    submission: {
      name: formText(formData, "name"),
      description: formText(formData, "description") || undefined,
      transport: formText(formData, "transport") as never,
      packageType: formText(formData, "packageType") ? formText(formData, "packageType") as never : undefined,
      packageIdentifier: formText(formData, "packageIdentifier") || undefined,
      repositoryUrl: formText(formData, "repositoryUrl") || undefined,
      officialRegistryUrl: formText(formData, "officialRegistryUrl") || undefined,
      remoteEndpoint: formText(formData, "remoteEndpoint") || undefined,
      authMethod: formText(formData, "authMethod") || undefined,
      requiredEnvVars: textareaList(formData, "requiredEnvVars"),
      requiresSecrets: formBoolean(formData, "requiresSecrets"),
      filesystemAccess: formText(formData, "filesystemAccess") as never,
      shellExecution: formBoolean(formData, "shellExecution"),
      networkAccess: formBoolean(formData, "networkAccess"),
      databaseWriteAccess: formBoolean(formData, "databaseWriteAccess"),
      emailMessageAccess: formBoolean(formData, "emailMessageAccess"),
      walletPaymentAccess: formBoolean(formData, "walletPaymentAccess"),
      productionWriteAccess: formBoolean(formData, "productionWriteAccess"),
      declaredTools: textareaList(formData, "declaredTools"),
      declaredResources: textareaList(formData, "declaredResources"),
      declaredPrompts: textareaList(formData, "declaredPrompts"),
    },
  });

  revalidatePath("/app/products/mcp/submit");
  redirect("/app/products/kya/questionnaire");
}
