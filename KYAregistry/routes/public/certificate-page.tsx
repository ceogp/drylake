import Link from "next/link";
import { notFound } from "next/navigation";

import { getHostedCertificate } from "@/KYAregistry/services/public-registry";

export default async function KyaCertificatePage(props: PageProps<"/kya-registry/certificates/[certificateId]">) {
  const { certificateId } = await props.params;
  const certificate = await getHostedCertificate(certificateId);

  if (!certificate) {
    notFound();
  }

  const statusLabel = certificate.active ? "Active" : "Invalid";
  const verificationRows: Array<[string, string | null | undefined]> = [
    ["API endpoint", `/api/kya-registry/v1/certificates/${certificate.certificateId}`],
    ["Public URL", certificate.verification.publicUrl],
    ["Badge URL", certificate.verification.badgeUrl],
    ["Signature algorithm", certificate.verification.signatureAlgorithm],
    ["Evidence hash", certificate.review.evidenceHash],
    ["Expires", certificate.review.expiresAt],
  ];

  if (certificate.verification.archive?.backend) {
    verificationRows.push(["Archive backend", certificate.verification.archive.backend]);
  }

  if (certificate.verification.archive?.publishedAt) {
    verificationRows.push(["Archive published", certificate.verification.archive.publishedAt]);
  }

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Hosted KYA certificate
          </p>
          <h1 className="mt-4 break-words font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.08] text-zinc-50 sm:text-5xl">
            {certificate.certificateId}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
            Xupra-hosted verification record for {certificate.company.name}. Agents can use the API endpoint to check active status before a transaction.
          </p>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 md:grid-cols-3 lg:px-10">
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Status</p>
            <p className={certificate.active ? "mt-3 text-3xl font-semibold text-emerald-300" : "mt-3 text-3xl font-semibold text-red-300"}>
              {statusLabel}
            </p>
          </article>
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">KYA level</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{certificate.review.kyaLevel ?? "n/a"}</p>
          </article>
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Risk class</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{certificate.review.riskClass ?? "n/a"}</p>
          </article>
        </div>
      </section>

      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <section>
            <h2 className="text-2xl font-semibold text-zinc-50">Subject</h2>
            <dl className="mt-5 grid gap-px bg-zinc-800 text-sm sm:grid-cols-2">
              {[
                ["Company", certificate.company.name],
                ["Domain", certificate.company.domain],
                ["Country", certificate.company.country],
                ["Asset", certificate.asset?.name ?? "n/a"],
                ["Asset type", certificate.asset?.type?.replaceAll("_", " ") ?? "n/a"],
                ["Protocol", certificate.asset?.protocol ?? "n/a"],
              ].map(([label, value]) => (
                <div className="bg-[#111414] px-5 py-4" key={label}>
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                  <dd className="mt-2 break-words text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
            {certificate.asset?.did ? (
              <div className="mt-px bg-zinc-800 p-px">
                <div className="bg-[#111414] px-5 py-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Agent ID / DID
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-300">{certificate.asset.did}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-50">Verification</h2>
            <div className="mt-5 grid gap-px bg-zinc-800 text-sm">
              {verificationRows.map(([label, value]) => (
                <div className="bg-[#111414] px-5 py-4" key={label}>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-300">{value}</p>
                </div>
              ))}
            </div>
            <Link className="mt-5 inline-flex rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href={`/api/kya-registry/v1/certificates/${certificate.certificateId}`}>
              Open machine-readable certificate
            </Link>
          </section>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Signed certificate payload
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-50">Canonical public record</h2>
            </div>
          </div>
          <pre className="mt-5 max-h-[34rem] overflow-auto border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-200">
            {JSON.stringify(certificate.signedCertificate, null, 2)}
          </pre>
        </div>
      </section>
    </main>
  );
}
