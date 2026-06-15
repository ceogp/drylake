import Link from "next/link";

import { submitTrustKyaQuestionnaireAction } from "@/KYAregistry/actions/kya-questionnaire";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";
import { getTrustRegistryWorkspace } from "@/KYAregistry/services/submissions";

const questions = [
  ["stableAgentIdentity", "Assigns a stable identity to each AI agent"],
  ["cryptographicallyVerifiableAgentIdentity", "Agent identity is cryptographically verifiable"],
  ["principalIdentity", "Identifies the human or business principal behind the agent"],
  ["consentRecord", "Records consent from the principal"],
  ["delegatedAuthorityByActionType", "Defines delegated authority by action type"],
  ["amountFrequencyDestinationOrResourceLimits", "Supports amount, frequency, destination, or resource limits"],
  ["delegationExpiry", "Delegations expire"],
  ["delegationRevocation", "Delegations can be revoked"],
  ["auditLogs", "Maintains audit logs of agent actions"],
  ["signedOrTamperEvidentAuditLogs", "Audit logs are tamper-evident or signed"],
  ["thirdPartyVerificationApi", "Third parties can verify agent authorization through an API"],
  ["agentsCanInitiatePaymentsOrFinancialActions", "Agents can initiate payments or financial actions"],
  ["humanApprovalThresholds", "Human approval thresholds are supported for payments or financial actions"],
  ["walletSigningPrivateKeyBoundariesDocumented", "Wallet-signing and private-key boundaries are documented"],
] as const;

export default async function TrustKyaQuestionnairePage() {
  const context = await requireCompletedOnboardingAppContextForPage("/app/products/kya/questionnaire");
  const workspace = await getTrustRegistryWorkspace(context.organization.id);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 md:px-10">
        <header className="space-y-3">
          <p className="tape-eyebrow">Xupra KYA Registry</p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            KYA controls questionnaire
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-stone-700">
            These answers determine the initial KYA level. Certificates require KYA-L1 or higher and remain subject to scan review.
          </p>
        </header>

        {!workspace.company ? (
          <section className="tape-panel bg-white p-6">
            <p className="text-sm leading-7 text-stone-700">Create a company profile before completing the KYA questionnaire.</p>
            <Link className="mt-4 inline-flex tape-button bg-white px-4 py-2 text-xs text-black" href="/app/company/profile">
              Open company profile
            </Link>
          </section>
        ) : (
          <form action={submitTrustKyaQuestionnaireAction} className="tape-panel grid gap-5 bg-white p-6">
            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Product
              <select
                className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                name="productId"
              >
                <option value="">Company-level KYA controls</option>
                {workspace.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3">
              {questions.map(([name, label]) => (
                <label key={name} className="flex items-start gap-3 rounded border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-800">
                  <input className="mt-1" name={name} type="checkbox" />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="rounded border border-stone-300 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
              Scoring: agent identity 20, principal identity 15, consent 15, delegation scope 15, revocation 10,
              audit logs 15, verification API 10. KYA-L1 starts at 40 points.
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                Submit questionnaire
              </button>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/app/products/mcp/submit">
                MCP submission
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
