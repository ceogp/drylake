"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationRole } from "@/lib/services/access";
import { submitTrustKyaQuestionnaire } from "@/KYAregistry/services/submissions";

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function submitTrustKyaQuestionnaireAction(formData: FormData) {
  const context = await requireOrganizationRole(["owner", "admin", "member"]);
  const productId = String(formData.get("productId") ?? "").trim();

  await submitTrustKyaQuestionnaire({
    organizationId: context.organization.id,
    productId: productId || undefined,
    answers: {
      stableAgentIdentity: bool(formData, "stableAgentIdentity"),
      cryptographicallyVerifiableAgentIdentity: bool(formData, "cryptographicallyVerifiableAgentIdentity"),
      principalIdentity: bool(formData, "principalIdentity"),
      consentRecord: bool(formData, "consentRecord"),
      delegatedAuthorityByActionType: bool(formData, "delegatedAuthorityByActionType"),
      amountFrequencyDestinationOrResourceLimits: bool(formData, "amountFrequencyDestinationOrResourceLimits"),
      delegationExpiry: bool(formData, "delegationExpiry"),
      delegationRevocation: bool(formData, "delegationRevocation"),
      auditLogs: bool(formData, "auditLogs"),
      signedOrTamperEvidentAuditLogs: bool(formData, "signedOrTamperEvidentAuditLogs"),
      thirdPartyVerificationApi: bool(formData, "thirdPartyVerificationApi"),
      agentsCanInitiatePaymentsOrFinancialActions: bool(formData, "agentsCanInitiatePaymentsOrFinancialActions"),
      humanApprovalThresholds: bool(formData, "humanApprovalThresholds"),
      walletSigningPrivateKeyBoundariesDocumented: bool(formData, "walletSigningPrivateKeyBoundariesDocumented"),
    },
  });

  revalidatePath("/app/products/kya/questionnaire");
  redirect("/app/company/profile");
}
