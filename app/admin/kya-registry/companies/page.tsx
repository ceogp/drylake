import Link from "next/link";

import { setRegistryCaseListingAction } from "@/KYAregistry/actions/operator-admin";
import {
  isUsableRegistryCertificate,
  listRegistryCompanies,
} from "@/KYAregistry/services/operator";
import {
  EmptyState,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import {
  SubmitButton,
  formatMoneyUsdCents,
} from "@/app/admin/kya-registry/_components/kya-registry-admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";

export default async function KyaRegistryCompaniesPage() {
  await requireAdminPageAccess();
  const companies = await listRegistryCompanies();
  const activeCertificateCount = companies.reduce(
    (count, company) =>
      count + company.certificates.filter((certificate) => isUsableRegistryCertificate(certificate)).length,
    0,
  );
  const verifiedDomainCount = companies.filter(
    (company) =>
      Boolean(company.verifiedDomain) ||
      company.domains.some((domain) => domain.status === "verified"),
  ).length;
  const publicCaseCount = companies.reduce(
    (count, company) =>
      count + company.registryCases.filter((registryCase) => registryCase.publicListingEnabled).length,
    0,
  );

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Companies with registry cases, assets, or issued certificates"
          label="Companies"
          value={String(companies.length)}
        />
        <MetricCard
          detail="Verified or verification-ready company domains"
          label="Domain Coverage"
          value={String(verifiedDomainCount)}
        />
        <MetricCard
          detail="Usable hosted credentials tied to a tracked company"
          label="Active Certificates"
          value={String(activeCertificateCount)}
        />
        <MetricCard
          detail="Registry cases currently flagged for the public explorer"
          label="Public Listings"
          value={String(publicCaseCount)}
        />
      </section>

      <Panel eyebrow="Directory" title="Registered Companies">
        {companies.length === 0 ? (
          <EmptyState>No registry companies exist yet. Create a case from the overview page first.</EmptyState>
        ) : (
          <div className="grid gap-4">
            {companies.map((company) => {
              const activeCertificates = company.certificates.filter((certificate) =>
                isUsableRegistryCertificate(certificate),
              );

              return (
                <article className="rounded-lg border border-stone-200 bg-white p-5" key={company.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-stone-950">{company.displayName}</h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                        <a className="underline" href={company.websiteUrl}>
                          {company.websiteUrl}
                        </a>
                        <span>{company.country}</span>
                        {company.verifiedDomain ? <span>Verified: {company.verifiedDomain}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={company.status} />
                      <StatusBadge value={activeCertificates.length ? "verified" : "pending"} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Cases</div>
                      <div className="mt-2 text-2xl font-semibold text-stone-950">{company._count.registryCases}</div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Assets</div>
                      <div className="mt-2 text-2xl font-semibold text-stone-950">{company._count.registryAssets}</div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Certificates</div>
                      <div className="mt-2 text-2xl font-semibold text-stone-950">{company._count.certificates}</div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Active</div>
                      <div className="mt-2 text-2xl font-semibold text-stone-950">{activeCertificates.length}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Contacts And Domains</p>
                      <div className="mt-3 grid gap-2 text-sm text-stone-700">
                        {company.businessContactEmail ? <div>Business: {company.businessContactEmail}</div> : null}
                        {company.securityContactEmail ? <div>Security: {company.securityContactEmail}</div> : null}
                        {company.privacyContactEmail ? <div>Privacy: {company.privacyContactEmail}</div> : null}
                        {company.contacts.length ? (
                          company.contacts.map((contact) => (
                            <div key={contact.id}>
                              {contact.kind}: {contact.email}
                            </div>
                          ))
                        ) : (
                          <div className="text-stone-500">No contact records</div>
                        )}
                        <div className="border-t border-stone-200 pt-2">
                          {company.domains.length ? (
                            company.domains.map((domain) => (
                              <div className="flex items-center justify-between gap-3" key={domain.id}>
                                <span>{domain.domain}</span>
                                <StatusBadge value={domain.status} />
                              </div>
                            ))
                          ) : (
                            <div className="text-stone-500">No domain verification records</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Tracked Assets</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {company.registryAssets.length ? (
                          company.registryAssets.map((asset) => (
                            <div key={asset.id}>
                              <div className="font-medium text-stone-950">{asset.name}</div>
                              <div className="text-stone-600">
                                {asset.assetType}
                                {asset.protocol ? ` / ${asset.protocol}` : ""}
                              </div>
                              <div className="font-mono text-xs text-stone-500">{asset.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-stone-500">No assets linked yet</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Latest Certificates</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {company.certificates.length ? (
                          company.certificates.map((certificate) => (
                            <div key={certificate.id}>
                              <Link
                                className="font-medium text-stone-950 underline"
                                href={`/kya-registry/certificates/${certificate.certificateId}`}
                              >
                                {certificate.certificateId}
                              </Link>
                              <div className="text-stone-600">
                                {certificate.kyaLevel ?? "KYA pending"} / {certificate.riskClass ?? "Risk pending"}
                              </div>
                              <StatusBadge value={certificate.status} />
                            </div>
                          ))
                        ) : (
                          <div className="text-stone-500">No issued certificates</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {company.registryCases.map((registryCase) => {
                      const latestInvoice = registryCase.billingInvoices[0] ?? null;
                      const latestRun = registryCase.testRuns[0] ?? null;
                      const latestCertificate = registryCase.certificates[0] ?? null;
                      const canPublish = registryCase.certificates.some((certificate) =>
                        isUsableRegistryCertificate(certificate),
                      );
                      const waitingForPayment = registryCase.paymentStatus !== "paid";
                      const listingMismatch =
                        registryCase.publicListingEnabled &&
                        !registryCase.certificates.some(
                          (certificate) => isUsableRegistryCertificate(certificate),
                        );

                      return (
                        <div className="rounded-lg border border-stone-200 bg-white p-4" key={registryCase.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                                {registryCase.caseNumber}
                              </div>
                              <div className="mt-1 text-sm text-stone-600">Case ID: {registryCase.id}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge value={registryCase.status} />
                              <StatusBadge value={registryCase.paymentStatus} />
                              <StatusBadge value={registryCase.reviewStatus} />
                              <StatusBadge value={registryCase.publicListingEnabled ? "published" : "private"} />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-3 text-sm">
                            <div>
                              <div className="font-medium text-stone-950">Latest invoice</div>
                              {latestInvoice ? (
                                <div className="text-stone-600">
                                  {formatMoneyUsdCents(latestInvoice.amountUsdCents)} / {latestInvoice.status}
                                </div>
                              ) : (
                                <div className="text-stone-500">No invoice sent</div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-stone-950">Latest test</div>
                              {latestRun ? (
                                <div className="text-stone-600">
                                  {latestRun.provider} / {latestRun.status}
                                </div>
                              ) : (
                                <div className="text-stone-500">No test run recorded</div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-stone-950">Latest certificate</div>
                              {latestCertificate ? (
                                <div className="text-stone-600">
                                  <Link className="underline" href={`/kya-registry/certificates/${latestCertificate.certificateId}`}>
                                    {latestCertificate.certificateId}
                                  </Link>
                                </div>
                              ) : (
                                <div className="text-stone-500">No certificate issued</div>
                              )}
                            </div>
                          </div>

                          {listingMismatch ? (
                            <p className="mt-3 text-sm text-red-700">
                              Public listing is enabled, but this case no longer has an active usable certificate.
                            </p>
                          ) : null}

                          {waitingForPayment ? (
                            <p className="mt-3 text-sm text-amber-700">
                              Waiting for Stripe payment confirmation before testing and certificate issuance.
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-stone-600">Updated {formatDate(registryCase.updatedAt)}</div>
                            {registryCase.publicListingEnabled || canPublish ? (
                              <form action={setRegistryCaseListingAction} className="flex flex-wrap items-center gap-2">
                                <input name="registryCaseId" type="hidden" value={registryCase.id} />
                                <input
                                  name="publicListingEnabled"
                                  type="hidden"
                                  value={registryCase.publicListingEnabled ? "false" : "true"}
                                />
                                <SubmitButton tone="secondary">
                                  {registryCase.publicListingEnabled ? "Unpublish listing" : "Publish listing"}
                                </SubmitButton>
                              </form>
                            ) : (
                              <p className="text-sm text-stone-600">
                                Issue an active certificate before publishing.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 text-sm text-stone-600">Company updated {formatDate(company.updatedAt)}</div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
