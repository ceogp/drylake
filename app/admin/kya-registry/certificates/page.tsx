import Link from "next/link";

import { setRegistryCertificateStatusAction } from "@/KYAregistry/actions/operator-admin";
import {
  canActivateRegistryCertificate,
  isRegistryCertificateExpiringWithinDays,
  isUsableRegistryCertificate,
  listRegistryCertificates,
} from "@/KYAregistry/services/operator";
import {
  EmptyState,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { SubmitButton } from "@/app/admin/kya-registry/_components/kya-registry-admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";

function availableStatuses(currentStatus: string, expiresAt: Date) {
  const values = new Set<string>([
    currentStatus,
    "suspended",
    "revoked",
    "expired",
  ]);

  if (canActivateRegistryCertificate({ expiresAt }) || currentStatus === "active") {
    values.add("active");
  }

  return [...values];
}

export default async function KyaRegistryCertificatesPage() {
  await requireAdminPageAccess();
  const certificates = await listRegistryCertificates();
  const activeCount = certificates.filter((certificate) => isUsableRegistryCertificate(certificate)).length;
  const expiringSoonCount = certificates.filter((certificate) =>
    isRegistryCertificateExpiringWithinDays(certificate, 30),
  ).length;
  const suspendedCount = certificates.filter((certificate) => certificate.status === "suspended").length;
  const inactiveCount = certificates.filter((certificate) =>
    ["revoked", "expired"].includes(certificate.status) || !canActivateRegistryCertificate(certificate),
  ).length;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Certificates currently valid for hosted verification"
          label="Active"
          value={String(activeCount)}
        />
        <MetricCard
          detail="Certificates within 30 days of expiry"
          label="Expiring Soon"
          value={String(expiringSoonCount)}
        />
        <MetricCard
          detail="Certificates intentionally held from public verification"
          label="Suspended"
          value={String(suspendedCount)}
        />
        <MetricCard
          detail="Revoked, expired, or otherwise unusable certificates"
          label="Inactive"
          value={String(inactiveCount)}
        />
      </section>

      <Panel eyebrow="Lifecycle" title="Hosted Certificates">
        {certificates.length === 0 ? (
          <EmptyState>No hosted certificates have been issued yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-3 py-3">Certificate</th>
                  <th className="px-3 py-3">Company / Asset</th>
                  <th className="px-3 py-3">Review</th>
                  <th className="px-3 py-3">Dates</th>
                  <th className="px-3 py-3">Last Event</th>
                  <th className="px-3 py-3">Manage</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((certificate) => {
                  const latestEvent = certificate.statusEvents[0] ?? null;
                  const certificateUsable = isUsableRegistryCertificate(certificate);
                  const statuses = availableStatuses(certificate.status, certificate.expiresAt);

                  return (
                    <tr className="border-b border-stone-100 align-top" key={certificate.id}>
                      <td className="px-3 py-4">
                        <Link
                          className="font-medium text-stone-950 hover:underline"
                          href={`/kya-registry/certificates/${certificate.certificateId}`}
                        >
                          {certificate.certificateId}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge value={certificate.status} />
                          <StatusBadge value={certificateUsable ? "usable" : "invalid"} />
                          {certificate.registryCase?.publicListingEnabled ? (
                            <StatusBadge value="published" />
                          ) : (
                            <StatusBadge value="private" />
                          )}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                          <a className="underline" href={`/api/kya-registry/v1/certificates/${certificate.certificateId}`}>
                            JSON
                          </a>
                          {certificate.badgeUrl ? (
                            <>
                              {" "}·{" "}
                              <a className="underline" href={certificate.badgeUrl}>
                                Badge
                              </a>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-medium text-stone-950">{certificate.company.displayName}</div>
                        <div className="text-stone-600">{certificate.company.websiteUrl}</div>
                        {certificate.registryAsset ? (
                          <div className="mt-2 text-xs text-stone-500">
                            {certificate.registryAsset.name} / {certificate.registryAsset.assetType}
                            {certificate.registryAsset.protocol ? ` / ${certificate.registryAsset.protocol}` : ""}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-stone-500">No linked asset</div>
                        )}
                        {certificate.registryCase ? (
                          <div className="mt-1 text-xs text-stone-500">{certificate.registryCase.caseNumber}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-stone-950">{certificate.kyaLevel ?? "KYA pending"}</div>
                        <div className="text-stone-600">{certificate.riskClass ?? "Risk pending"}</div>
                        <div className="mt-1 text-xs text-stone-500">{certificate.standardVersion}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div>Issued {formatDate(certificate.issuedAt)}</div>
                        <div>Expires {formatDate(certificate.expiresAt)}</div>
                        {certificate.lastCheckedAt ? (
                          <div className="mt-1 text-xs text-stone-500">
                            Checked {formatDate(certificate.lastCheckedAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        {latestEvent ? (
                          <>
                            <div className="font-medium text-stone-950">{latestEvent.status}</div>
                            <div className="max-w-xs text-stone-600">{latestEvent.reason ?? "No reason recorded"}</div>
                            <div className="mt-1 text-xs text-stone-500">{formatDate(latestEvent.createdAt)}</div>
                          </>
                        ) : (
                          <span className="text-stone-500">No status events</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <form action={setRegistryCertificateStatusAction} className="grid min-w-64 gap-2">
                          <input name="certificateId" type="hidden" value={certificate.certificateId} />
                          <label className="grid gap-1 text-xs font-medium uppercase tracking-[0.08em] text-stone-500">
                            Status
                            <select
                              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                              defaultValue={certificate.status}
                              name="status"
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-medium uppercase tracking-[0.08em] text-stone-500">
                            Reason
                            <input
                              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-stone-700"
                              name="reason"
                              placeholder="Why this status changed"
                              type="text"
                            />
                          </label>
                          <SubmitButton tone="secondary">Save status</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
