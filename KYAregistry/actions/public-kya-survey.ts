"use server";

import { redirect } from "next/navigation";

import { submitKyaSurveyInvite } from "@/KYAregistry/services/surveys";

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function submitPublicKyaSurveyAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();

  await submitKyaSurveyInvite({
    token,
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

  redirect("/survey/kya/submitted");
}
