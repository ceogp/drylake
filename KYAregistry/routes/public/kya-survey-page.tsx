import { submitPublicKyaSurveyAction } from "@/KYAregistry/actions/public-kya-survey";

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

export default async function PublicKyaSurveyPage(props: PageProps<"/survey/kya/[token]">) {
  const { token } = await props.params;

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <header className="space-y-3">
          <p className="tape-eyebrow">Xupra KYA Registry</p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            KYA controls survey
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-stone-700">
            Submit the controls questionnaire for the reviewed company or product. Xupra reviews the submitted scope before issuing any certificate.
          </p>
        </header>

        <form action={submitPublicKyaSurveyAction} className="tape-panel grid gap-5 bg-white p-6">
          <input name="token" type="hidden" value={token} />
          <div className="grid gap-3">
            {questions.map(([name, label]) => (
              <label key={name} className="flex items-start gap-3 rounded border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-800">
                <input className="mt-1" name={name} type="checkbox" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
            Submit survey
          </button>
        </form>
      </div>
    </main>
  );
}
