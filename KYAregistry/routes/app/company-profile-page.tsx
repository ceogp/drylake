import Link from "next/link";

import {
  updateTrustCompanyProfileAction,
  verifyTrustCompanyDomainAction,
} from "@/KYAregistry/actions/company-profile";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";
import { getTrustRegistryWorkspace } from "@/KYAregistry/services/submissions";

const categoryOptions = [
  ["mcp_server", "MCP Server"],
  ["kya_provider", "KYA Provider"],
  ["ai_agent_platform", "AI Agent Platform"],
  ["wallet_signing_provider", "Wallet / Signing Provider"],
  ["x402_candidate", "x402 Candidate"],
  ["xrpl_rlusd_candidate", "XRPL/RLUSD Candidate"],
  ["enterprise_mcp_gateway", "Enterprise MCP Gateway"],
] as const;

const japanOptions = [
  ["selling_into_japan", "Selling into Japan"],
  ["looking_for_japanese_partners", "Looking for Japanese partners"],
  ["preparing_for_agentic_payments", "Preparing for agentic payments"],
  ["not_applicable", "Not applicable"],
] as const;

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-800">
      {label}
      <input
        className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

export default async function TrustCompanyProfilePage() {
  const context = await requireCompletedOnboardingAppContextForPage("/app/company/profile");
  const workspace = await getTrustRegistryWorkspace(context.organization.id);
  const selectedCategories = new Set(jsonArray(workspace.company?.categoriesJson));
  const selectedJapan = new Set(jsonArray(workspace.company?.japanMarketInterestJson));

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10">
        <header className="space-y-3">
          <p className="tape-eyebrow">Xupra KYA Registry</p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            Company profile
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-stone-700">
            Register the accountable company, official domain, contacts, and product categories before submitting MCP or KYA details.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <form action={updateTrustCompanyProfileAction} className="tape-panel grid gap-5 bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Legal company name" name="legalName" defaultValue={workspace.company?.legalName} required />
              <Field label="Public display name" name="displayName" defaultValue={workspace.company?.displayName} required />
              <Field label="Country" name="country" defaultValue={workspace.company?.country} required />
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Company size
                <select
                  className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                  defaultValue={workspace.company?.sizeClass ?? "small"}
                  name="sizeClass"
                >
                  <option value="small">Small / Indie / Open Source</option>
                  <option value="large">Large company</option>
                </select>
              </label>
              <Field label="Official website" name="websiteUrl" defaultValue={workspace.company?.websiteUrl} required type="url" />
              <Field label="Primary product URL" name="primaryProductUrl" defaultValue={workspace.company?.primaryProductUrl} type="url" />
              <Field label="Business contact email" name="businessContactEmail" defaultValue={workspace.company?.businessContactEmail} type="email" />
              <Field label="Security contact email" name="securityContactEmail" defaultValue={workspace.company?.securityContactEmail} type="email" />
              <Field label="Privacy contact email" name="privacyContactEmail" defaultValue={workspace.company?.privacyContactEmail} type="email" />
              <Field label="GitHub organization URL" name="githubOrganizationUrl" defaultValue={workspace.company?.githubOrganizationUrl} type="url" />
            </div>

            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Package registry links
              <textarea
                className="min-h-24 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                defaultValue={jsonArray(workspace.company?.packageRegistryLinksJson).join("\n")}
                name="packageRegistryLinks"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Company description
              <textarea
                className="min-h-28 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                defaultValue={workspace.company?.description ?? ""}
                name="description"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="grid gap-3 rounded border border-stone-300 p-4">
                <legend className="px-1 text-sm font-semibold text-stone-800">Categories</legend>
                {categoryOptions.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-stone-700">
                    <input defaultChecked={selectedCategories.has(value)} name="categories" type="checkbox" value={value} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="grid gap-3 rounded border border-stone-300 p-4">
                <legend className="px-1 text-sm font-semibold text-stone-800">Japan market interest</legend>
                {japanOptions.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-stone-700">
                    <input defaultChecked={selectedJapan.has(value)} name="japanMarketInterest" type="checkbox" value={value} />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>

            <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
              Save and continue
            </button>
          </form>

          <aside className="grid gap-4">
            <section className="tape-panel bg-white p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Domain verification</p>
              <div className="mt-4 grid gap-4">
                {workspace.domains.length ? workspace.domains.map((domain) => (
                  <div key={domain.id} className="rounded border border-stone-300 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-stone-950">{domain.domain}</p>
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">{domain.status}</span>
                    </div>
                    <p className="mt-3 font-mono text-xs text-stone-600">{domain.txtRecordName}</p>
                    <p className="mt-2 break-all font-mono text-xs text-stone-800">{domain.txtRecordValue}</p>
                    <form action={verifyTrustCompanyDomainAction} className="mt-4">
                      <input name="companyId" type="hidden" value={workspace.company?.id ?? ""} />
                      <input name="domain" type="hidden" value={domain.domain} />
                      <button className="tape-button bg-white px-4 py-2 text-xs text-black" type="submit">
                        Check DNS
                      </button>
                    </form>
                  </div>
                )) : (
                  <p className="text-sm leading-7 text-stone-700">Save the profile to generate the DNS TXT record.</p>
                )}
              </div>
            </section>

            <section className="tape-panel bg-white p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Next</p>
              <div className="mt-4 grid gap-3">
                <Link className="tape-button bg-white px-4 py-2 text-xs text-black" href="/app/products/mcp/submit">
                  Submit MCP server
                </Link>
                <Link className="tape-button bg-white px-4 py-2 text-xs text-black" href="/app/products/kya/questionnaire">
                  Complete KYA questionnaire
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
