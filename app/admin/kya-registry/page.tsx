import Link from "next/link";

import {
  createRegistryCaseAction,
  createRegistryInvoiceAction,
  issueRegistryCertificateAction,
  recordRegistryEventAction,
  recordRegistryTestRunAction,
  setRegistryCaseListingAction,
} from "@/KYAregistry/actions/operator-admin";
import {
  isUsableRegistryCertificate,
  listRegistryCases,
} from "@/KYAregistry/services/operator";
import {
  EmptyState,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import {
  Field,
  SubmitButton,
  Textarea,
  formatMoneyUsdCents,
} from "@/app/admin/kya-registry/_components/kya-registry-admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";

export default async function KyaRegistryAdminPage() {
  await requireAdminPageAccess();
  const cases = await listRegistryCases();
  const companyCount = new Set(
    cases.map((registryCase) => registryCase.companyId ?? registryCase.companyName.toLowerCase()),
  ).size;
  const assetCount = cases.reduce((count, registryCase) => count + registryCase.assets.length, 0);
  const activeCertificateCount = cases.reduce(
    (count, registryCase) =>
      count +
      registryCase.certificates.filter((certificate) => isUsableRegistryCertificate(certificate)).length,
    0,
  );
  const publishedCaseCount = cases.filter((registryCase) => registryCase.publicListingEnabled).length;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${companyCount} companies tracked`}
          label="Registry Cases"
          value={String(cases.length)}
        />
        <MetricCard
          detail="Discovered MCP servers and agent assets under review"
          label="Assets"
          value={String(assetCount)}
        />
        <MetricCard
          detail="Publicly verifiable hosted credentials currently usable"
          label="Active Certificates"
          value={String(activeCertificateCount)}
        />
        <MetricCard
          detail="Cases currently marked for public listing"
          label="Published Listings"
          value={String(publishedCaseCount)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Discovery" title="Register Company And Agent Asset">
          <form action={createRegistryCaseAction} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Company name" name="companyName" required />
              <Field label="Website URL" name="websiteUrl" required type="url" />
              <Field label="Country" name="country" />
              <Field label="Primary contact email" name="primaryContactEmail" type="email" />
              <Field label="Discovery source" name="discoveredSource" />
              <Field label="Discovered MCP / agent URL" name="discoveredUrl" type="url" />
            </div>
            <Field label="Ripple / XRPL / RLUSD ecosystem scope" name="rippleEcosystemScope" />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-stone-800">
                Asset type
                <select className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" name="assetType">
                  <option value="mcp_server">MCP server</option>
                  <option value="agent">Agent</option>
                  <option value="agent_card">Agent card</option>
                  <option value="tool_gateway">Tool gateway</option>
                  <option value="package">Package</option>
                  <option value="repository">Repository</option>
                </select>
              </label>
              <Field label="Asset name" name="assetName" required />
              <Field label="Package name" name="packageName" />
              <Field label="Repository URL" name="repositoryUrl" type="url" />
              <Field label="Endpoint URL" name="endpointUrl" type="url" />
              <Field label="Agent card URL" name="agentCardUrl" type="url" />
              <Field label="DID / agent identifier" name="did" />
              <Field label="Protocol" name="protocol" />
            </div>
            <Textarea label="Asset description" name="assetDescription" />
            <Textarea label="Internal notes" name="notes" />
            <SubmitButton>Create registry case</SubmitButton>
          </form>
        </Panel>

        <Panel eyebrow="Operations" title="Case Actions">
          <div className="grid gap-5">
            <form action={recordRegistryEventAction} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-semibold text-stone-950">Record outreach/contact</h3>
              <Field label="Case ID" name="registryCaseId" required />
              <Field label="Event type" name="eventType" required />
              <Field label="Title" name="title" required />
              <Textarea label="Detail" name="detail" />
              <SubmitButton>Record event</SubmitButton>
            </form>

            <form action={createRegistryInvoiceAction} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-semibold text-stone-950">Send Stripe invoice</h3>
              <Field label="Case ID" name="registryCaseId" required />
              <Field label="Customer email override" name="customerEmail" type="email" />
              <Field label="Amount in cents" name="amountUsdCents" type="number" />
              <Field label="Invoice description" name="description" />
              <Field label="Days until due" name="daysUntilDue" type="number" />
              <SubmitButton>Create and email invoice</SubmitButton>
            </form>

            <form action={recordRegistryTestRunAction} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-semibold text-stone-950">Record MCP / agent test run</h3>
              <p className="text-sm text-stone-600">
                Paid status is enforced. Stripe must mark the case invoice paid before test evidence can be recorded.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Case ID" name="registryCaseId" required />
                <Field label="Asset ID" name="registryAssetId" />
                <label className="grid gap-1 text-sm font-medium text-stone-800">
                  Provider
                  <select className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" name="provider">
                    <option value="drylake_mcp_agent">DryLake MCP agent</option>
                    <option value="drylake_agent_transaction">DryLake A2A transaction</option>
                    <option value="aws_codeguru_security">AWS CodeGuru Security</option>
                    <option value="manual_review">Manual review</option>
                    <option value="external_lab">External lab</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-stone-800">
                  Test type
                  <select className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" name="testType">
                    <option value="mcp_capability_scan">MCP capability scan</option>
                    <option value="agent_identity_scan">Agent identity scan</option>
                    <option value="agent_to_agent_transaction_check">A2A transaction check</option>
                    <option value="code_security_scan">Code security scan</option>
                    <option value="package_integrity_scan">Package integrity scan</option>
                    <option value="kya_controls_review">KYA controls review</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-stone-800">
                  Status
                  <select className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" name="status">
                    <option value="queued">Queued</option>
                    <option value="running">Running</option>
                    <option value="passed">Passed</option>
                    <option value="needs_remediation">Needs remediation</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <Field label="External job ID" name="externalJobId" />
                <Field label="Risk class" name="riskClass" />
                <Field label="KYA level" name="kyaLevel" />
                <Field label="Critical findings" name="criticalFindings" type="number" />
                <Field label="High findings" name="highFindings" type="number" />
                <Field label="Medium findings" name="mediumFindings" type="number" />
                <Field label="Low findings" name="lowFindings" type="number" />
              </div>
              <Textarea label="Recommendation" name="recommendation" />
              <SubmitButton>Record test run</SubmitButton>
            </form>

            <form action={issueRegistryCertificateAction} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-semibold text-stone-950">Issue hosted certificate</h3>
              <p className="text-sm text-stone-600">
                Certificate issuance is blocked until the case payment status is paid.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Case ID" name="registryCaseId" required />
                <Field label="Asset ID" name="registryAssetId" />
                <Field label="Risk class" name="riskClass" />
                <Field label="KYA level" name="kyaLevel" />
                <Field label="Expires in days" name="expiresInDays" type="number" />
              </div>
              <SubmitButton>Issue certificate</SubmitButton>
            </form>
          </div>
        </Panel>
      </section>

      <Panel eyebrow="Pipeline" title="Registry Cases">
        <div className="mb-5 flex flex-wrap gap-3 text-sm">
          <Link className="font-medium text-stone-900 underline" href="/portal/kya-registry/companies">
            Open company directory
          </Link>
          <Link className="font-medium text-stone-900 underline" href="/portal/kya-registry/certificates">
            Open certificate lifecycle
          </Link>
        </div>

        {cases.length === 0 ? (
          <EmptyState>No KYA registry cases have been created yet.</EmptyState>
        ) : (
          <div className="grid gap-4">
            {cases.map((registryCase) => {
              const canPublish = registryCase.certificates.some((certificate) =>
                isUsableRegistryCertificate(certificate),
              );
              const waitingForPayment = registryCase.paymentStatus !== "paid";

              return (
                <article className="rounded-lg border border-stone-200 bg-white p-5" key={registryCase.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">{registryCase.caseNumber}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-stone-950">{registryCase.companyName}</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {registryCase.websiteUrl ?? registryCase.company?.websiteUrl ?? "No website"}
                    </p>
                    <p className="mt-1 font-mono text-xs text-stone-500">Case ID: {registryCase.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={registryCase.status} />
                    <StatusBadge value={registryCase.outreachStatus} />
                    <StatusBadge value={registryCase.paymentStatus} />
                    <StatusBadge value={registryCase.reviewStatus} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-4">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Assets</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      {registryCase.assets.length ? (
                        registryCase.assets.map((asset) => (
                          <div key={asset.id}>
                            <div className="font-medium text-stone-950">{asset.name}</div>
                            <div className="font-mono text-xs text-stone-500">
                              {asset.assetType} / {asset.id}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-500">No assets recorded</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Recent Tests</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      {registryCase.testRuns.length ? (
                        registryCase.testRuns.map((run) => (
                          <div key={run.id}>
                            <div className="font-medium text-stone-950">{run.provider}</div>
                            <div className="text-stone-600">{run.testType}</div>
                            <StatusBadge value={run.status} />
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-500">No tests recorded</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Invoices</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      {registryCase.billingInvoices.length ? (
                        registryCase.billingInvoices.map((invoice) => (
                          <div key={invoice.id}>
                            <StatusBadge value={invoice.status} />
                            <div className="text-stone-600">
                              {formatMoneyUsdCents(invoice.amountUsdCents)} / {invoice.customerEmail}
                            </div>
                            {invoice.hostedInvoiceUrl ? (
                              <a className="text-stone-950 underline" href={invoice.hostedInvoiceUrl}>
                                Stripe invoice
                              </a>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-500">No invoices</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Certificates</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      {registryCase.certificates.length ? (
                        registryCase.certificates.map((certificate) => (
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
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-500">No certificates</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Recent Events</p>
                    <div className="mt-3 grid gap-2">
                      {registryCase.events.length ? (
                        registryCase.events.map((event) => (
                          <div key={event.id}>
                            <div className="font-medium text-stone-950">{event.title}</div>
                            <div className="text-stone-600">
                              {event.eventType}
                              {event.actor ? ` / ${event.actor}` : ""}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-500">No events recorded</span>
                      )}
                    </div>
                  </div>

                  <form action={setRegistryCaseListingAction} className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <StatusBadge value={registryCase.publicListingEnabled ? "published" : "private"} />
                    {registryCase.publicListingEnabled || canPublish ? (
                      <>
                        <input name="registryCaseId" type="hidden" value={registryCase.id} />
                        <input
                          name="publicListingEnabled"
                          type="hidden"
                          value={registryCase.publicListingEnabled ? "false" : "true"}
                        />
                        <SubmitButton tone="secondary">
                          {registryCase.publicListingEnabled ? "Unpublish listing" : "Publish listing"}
                        </SubmitButton>
                      </>
                    ) : (
                      <p className="max-w-56 text-sm text-stone-600">
                        Issue an active certificate before publishing this company to the public explorer.
                      </p>
                    )}
                  </form>
                </div>

                {waitingForPayment ? (
                  <p className="mt-4 text-sm text-amber-700">
                    Waiting for payment confirmation before testing and certificate issuance can proceed.
                  </p>
                ) : null}

                <div className="mt-4 text-sm text-stone-600">Updated {formatDate(registryCase.updatedAt)}</div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
