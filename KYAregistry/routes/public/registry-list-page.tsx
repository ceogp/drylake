import Link from "next/link";

import {
  getPublicRegistryApiPath,
  getPublicRegistryExplorer,
  type PublicRegistryFacet,
  type PublicRegistryQuery,
} from "@/KYAregistry/services/public-registry";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function hasFiltersApplied(query: PublicRegistryQuery) {
  return Boolean(query.q || query.type || query.risk || query.kya || query.protocol);
}

function MetricCard({
  label,
  value,
  help,
}: {
  label: string;
  value: number;
  help: string;
}) {
  return (
    <article className="border border-zinc-800 bg-[#111414] p-4">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{help}</p>
    </article>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: PublicRegistryFacet[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-300">
      <span>{label}</span>
      <select
        className="h-11 rounded-md border border-zinc-800 bg-[#090a0a] px-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600"
        defaultValue={value ?? ""}
        name={name}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultTag({
  value,
  tone = "default",
}: {
  value: string;
  tone?: "default" | "success";
}) {
  const className =
    tone === "success"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : "border-zinc-700 bg-zinc-950 text-zinc-300";

  return (
    <span className={`inline-flex rounded-md border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}>
      {value}
    </span>
  );
}

export default async function KyaRegistryListPage(props: PageProps<"/kya-registry/registry">) {
  const searchParams = await props.searchParams;
  const registry = await getPublicRegistryExplorer({
    q: firstValue(searchParams.q),
    type: firstValue(searchParams.type),
    risk: firstValue(searchParams.risk),
    kya: firstValue(searchParams.kya),
    protocol: firstValue(searchParams.protocol),
  });
  const filtered = registry.filteredSummary;
  const total = registry.totalSummary;
  const apiHref = getPublicRegistryApiPath(registry.query);

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Xupra KYA Registry
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl">
            Public registry explorer
          </h1>
          <p className="mt-5 max-w-4xl text-base leading-8 text-zinc-300">
            Search reviewed companies, MCP servers, agent assets, and hosted certificates. Listings appear only after outreach, agreement, payment, review, certificate issuance, and publication approval.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-400">
            <a className="font-medium text-emerald-300 underline" href={apiHref}>
              Explorer API
            </a>
            <a className="font-medium text-emerald-300 underline" href="/.well-known/kya-registry.json">
              Issuer metadata
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <form action="/kya-registry/registry" className="grid gap-5 border border-zinc-800 bg-[#111414] p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))]">
              <label className="grid gap-2 text-sm font-medium text-zinc-300 xl:col-span-1">
                <span>Search</span>
                <input
                  className="h-11 rounded-md border border-zinc-800 bg-[#090a0a] px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-600"
                  defaultValue={registry.query.q ?? ""}
                  name="q"
                  placeholder="Company, asset, MCP, domain, certificate, protocol"
                  type="search"
                />
              </label>
              <SelectField label="Asset type" name="type" options={registry.facets.assetTypes} value={registry.query.type} />
              <SelectField label="Risk class" name="risk" options={registry.facets.riskClasses} value={registry.query.risk} />
              <SelectField label="KYA level" name="kya" options={registry.facets.kyaLevels} value={registry.query.kya} />
              <SelectField label="Protocol" name="protocol" options={registry.facets.protocols} value={registry.query.protocol} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" type="submit">
                Search registry
              </button>
              <Link
                className="rounded-md border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white"
                href="/kya-registry/registry"
              >
                Clear filters
              </Link>
              <p className="text-sm text-zinc-500">
                Use the same query parameters as the API: <span className="font-mono">q</span>, <span className="font-mono">type</span>, <span className="font-mono">risk</span>, <span className="font-mono">kya</span>, <span className="font-mono">protocol</span>.
              </p>
            </div>
          </form>
        </div>
      </section>

      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:px-8 lg:grid-cols-5 lg:px-10">
          <MetricCard label="Results" value={filtered.results} help={hasFiltersApplied(registry.query) ? `Filtered from ${total.results} public listings.` : "Current matching public listings."} />
          <MetricCard label="Companies" value={filtered.companies} help="Distinct reviewed companies in the current result set." />
          <MetricCard label="Assets" value={filtered.assets} help="Reviewed MCP servers, agents, packages, or related assets." />
          <MetricCard label="Certificates" value={filtered.certificates} help="Hosted KYA certificates currently visible here." />
          <MetricCard label="Protocols" value={filtered.protocols} help="Distinct transport or protocol labels in the current result set." />
        </div>
      </section>

      <section>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-10 sm:px-8 lg:px-10">
          {total.results === 0 ? (
            <section className="grid gap-6 border border-dashed border-zinc-700 bg-[#111414] p-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  No public listings yet
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-zinc-50">
                  The explorer is live, but no companies have been published yet.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                  Public companies appear here only after manual discovery, company contact, agreement, payment, review, certificate issuance, and publication approval. The internal registry workflow already exists for creating companies, agent assets, invoices, test runs, and hosted certificates.
                </p>
              </div>
              <div className="grid gap-3">
                {[
                  "Company identity and website",
                  "Reviewed MCP or agent asset",
                  "KYA level and risk class",
                  "Hosted certificate page and JSON API",
                  "Agent card, endpoint, repository, or package references",
                ].map((item) => (
                  <div key={item} className="border border-zinc-800 bg-[#090a0a] px-4 py-3 text-sm text-zinc-300">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : filtered.results === 0 ? (
            <section className="border border-dashed border-zinc-700 bg-[#111414] p-8">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                No matches
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-zinc-50">
                No public registry listings match the current query.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                Adjust the search terms or clear the filters. The explorer only searches published entries with an active hosted certificate.
              </p>
              <div className="mt-6">
                <Link
                  className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white"
                  href="/kya-registry/registry"
                >
                  Reset explorer
                </Link>
              </div>
            </section>
          ) : (
            registry.entries.map((entry) => (
              <article className="border border-zinc-800 bg-[#111414]" key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5">
                  <div className="min-w-0 max-w-4xl">
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {entry.caseNumber}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                      {entry.asset.name}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-300">
                      {entry.companyName} · {entry.asset.typeLabel}
                      {entry.asset.protocolLabel ? ` · ${entry.asset.protocolLabel}` : ""}
                    </p>
                    {entry.asset.description ? (
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                        {entry.asset.description}
                      </p>
                    ) : entry.rippleEcosystemScope ? (
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                        {entry.rippleEcosystemScope}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ResultTag tone="success" value="active" />
                    {entry.certificate.kyaLevel ? <ResultTag value={entry.certificate.kyaLevel} /> : null}
                    {entry.certificate.riskClass ? <ResultTag value={entry.certificate.riskClass} /> : null}
                  </div>
                </div>

                <div className="grid gap-4 border-t border-zinc-800 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-3 text-sm text-zinc-400">
                    {entry.websiteUrl ? (
                      <a className="break-all text-emerald-300 underline" href={entry.websiteUrl} rel="noreferrer" target="_blank">
                        {entry.websiteUrl}
                      </a>
                    ) : null}
                    {entry.companyDomain ? (
                      <p className="font-mono text-xs text-zinc-500">{entry.companyDomain}</p>
                    ) : null}
                    <p>Updated {formatDate(entry.updatedAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-start justify-start gap-3 lg:justify-end">
                    <Link
                      className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
                      href={`/kya-registry/certificates/${entry.certificate.certificateId}`}
                    >
                      View certificate
                    </Link>
                    <Link
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white"
                      href={entry.certificate.apiUrl}
                    >
                      Certificate JSON
                    </Link>
                  </div>
                </div>

                <details className="border-t border-zinc-800">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-200 transition hover:text-white">
                    View listing details
                  </summary>
                  <div className="grid gap-px bg-zinc-800 sm:grid-cols-2">
                    {[
                      ["Certificate ID", entry.certificate.certificateId],
                      ["Issued", formatDate(entry.certificate.issuedAt)],
                      ["Expires", formatDate(entry.certificate.expiresAt)],
                      ["Standard", entry.standard.title ?? entry.standard.version ?? "Not recorded"],
                      ["Asset type", entry.asset.typeLabel],
                      ["Protocol", entry.asset.protocolLabel ?? "Not recorded"],
                      ["DID", entry.asset.did],
                      ["Package", entry.asset.packageName],
                      ["Endpoint", entry.asset.endpointUrl],
                      ["Agent card", entry.asset.agentCardUrl],
                      ["Repository", entry.asset.repositoryUrl],
                      ["Source URL", entry.asset.sourceUrl],
                    ]
                      .filter((item): item is [string, string] => Boolean(item[1]))
                      .map(([label, value]) => (
                        <div className="bg-[#101414] px-5 py-4" key={`${entry.id}-${label}`}>
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            {label}
                          </p>
                          {value.startsWith("http") ? (
                            <a className="mt-2 block break-all text-sm text-emerald-300 underline" href={value} rel="noreferrer" target="_blank">
                              {value}
                            </a>
                          ) : (
                            <p className="mt-2 break-all text-sm text-zinc-100">{value}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
