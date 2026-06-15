import {
  TRUST_REGISTRY_STANDARD_LABEL,
  TRUST_REGISTRY_STANDARD_VERSION,
} from "@/KYAregistry/services/registry";
import { getPublishedTrustPolicies } from "@/KYAregistry/services/trust-policy";

const controlFamilies = [
  {
    title: "Identity binding",
    body: "Every certificate binds one accountable company to one reviewed MCP server, agent, agent card, package, repository, or tool gateway.",
    items: [
      "Company identity and website domain",
      "Reviewed asset name, type, and endpoint or source binding",
      "Hosted certificate URL and issuer DID",
      "Optional certified operational key for live challenge verification",
    ],
  },
  {
    title: "Transaction trust",
    body: "Verification is designed for agent-to-agent workflows where the relying agent must confirm status and authority before allowing sensitive work.",
    items: [
      "Active status, issue date, and expiry checks",
      "KYA level and MCP risk class",
      "Revocation-aware online verification",
      "Evidence hash and signature validation",
    ],
  },
  {
    title: "Review evidence",
    body: "Xupra reviews technical and operational evidence before a hosted certificate becomes active.",
    items: [
      "Declared MCP tools, resources, prompts, and permissions",
      "Repository, package, endpoint, and agent card mapping",
      "Maintainer and operator accountability",
      "Recorded scan evidence and operator notes retained privately",
    ],
  },
] as const;

const publicEvidence = [
  "certificate identifier",
  "issuer DID and issuer metadata endpoint",
  "company identity and reviewed asset binding",
  "KYA level, MCP risk class, and status",
  "issue date, expiry date, and evidence hash",
  "hosted verification URL and badge URL",
] as const;

const privateEvidence = [
  "raw scan output and operator notes",
  "survey responses and supporting documents",
  "remediation conversations and internal review history",
  "non-public endpoint details or sensitive architecture evidence",
] as const;

const suspensionRules = [
  "temporary uncertainty about the reviewed deployment or key binding",
  "new evidence that requires remediation before trust can continue",
  "operator-requested hold while the company updates the asset",
] as const;

const revocationRules = [
  "certificate subject no longer maps to the live asset or company control boundary",
  "material hidden behavior, undisclosed capability, or unresolved critical issue",
  "replacement by a newer certificate or explicit withdrawal from the registry",
] as const;

const decisionRules = [
  {
    outcome: "Pass",
    body: "No hidden critical behavior, accountable company identity, stable asset binding, and review evidence sufficient for the assigned KYA level.",
  },
  {
    outcome: "Needs remediation",
    body: "The company can correct declared-tool drift, unresolved high findings, weak delegation controls, or incomplete operational evidence and return for review.",
  },
  {
    outcome: "Fail",
    body: "Hidden shell execution, hidden private-key access, misleading capability disclosure, unresolved critical findings, or ownership mismatch blocks certification.",
  },
] as const;

const publishedPolicies = getPublishedTrustPolicies();

export default function KyaRegistryStandardsPage() {
  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Published standard
            </p>
            <h1 className="mt-5 max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl">
              {TRUST_REGISTRY_STANDARD_LABEL}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Public trust rules for hosted Know Your Agent certificates used in agent-to-agent verification.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-md border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white" href="/.well-known/kya-registry.json">
                Issuer metadata
              </a>
            </div>
          </div>

          <section className="border border-zinc-800 bg-[#101414]">
            <div className="border-b border-zinc-800 px-5 py-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Standard summary
              </p>
            </div>
            <dl className="grid gap-px bg-zinc-800 text-sm md:grid-cols-2">
              {[
                ["Version", TRUST_REGISTRY_STANDARD_VERSION],
                ["Scope", "Hosted agent and MCP certificate verification"],
                ["Verification", "Online status plus optional live nonce challenge"],
                ["Audience", "Agents, MCP clients, and relying transaction systems"],
                ["Issuer", "Xupra KYA Registry"],
                ["Evidence posture", "Public attestation plus private review archive"],
              ].map(([label, value]) => (
                <div className="bg-[#101414] px-5 py-4" key={label}>
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                  <dd className="mt-2 text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Control families
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              What the first KYA standard actually covers.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {controlFamilies.map((family) => (
              <article className="border border-zinc-800 bg-[#111414] p-5" key={family.title}>
                <h3 className="text-xl font-semibold text-zinc-50">{family.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{family.body}</p>
                <ul className="mt-4 grid gap-2 text-sm leading-7 text-zinc-300">
                  {family.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:px-10">
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Public evidence
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-50">What verifiers can see.</h2>
            <ul className="mt-5 grid gap-2 text-sm leading-7 text-zinc-300">
              {publicEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Private evidence
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-50">What stays with Xupra and the company.</h2>
            <ul className="mt-5 grid gap-2 text-sm leading-7 text-zinc-300">
              {privateEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:px-10">
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Suspension rules
            </p>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-zinc-300">
              {suspensionRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Revocation rules
            </p>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-zinc-300">
              {revocationRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Transaction policy
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
              Different transactions require different trust.
            </h2>
          </div>
          <div className="mt-8 overflow-x-auto border border-zinc-800 bg-[#111414]">
            <table className="min-w-full text-left text-sm text-zinc-300">
              <thead className="border-b border-zinc-800 bg-[#0d0f0f] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">Transaction</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">Min KYA</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">Max Risk</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">Live Challenge</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">Offline Fallback</th>
                </tr>
              </thead>
              <tbody>
                {publishedPolicies.map((policy) => (
                  <tr className="border-t border-zinc-800" key={policy.transactionType}>
                    <td className="px-4 py-3 font-medium text-zinc-100">{policy.transactionType}</td>
                    <td className="px-4 py-3">{policy.minimumKyaLevel}</td>
                    <td className="px-4 py-3">{policy.maximumRiskClass}</td>
                    <td className="px-4 py-3">{policy.handshakePreference}</td>
                    <td className="px-4 py-3">{policy.fallbackMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Certification decisions
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
              Pass, remediate, or fail.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {decisionRules.map((rule) => (
              <article className="border border-zinc-800 bg-[#111414] p-5" key={rule.outcome}>
                <h3 className="font-mono text-sm font-semibold text-emerald-300">{rule.outcome}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{rule.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
