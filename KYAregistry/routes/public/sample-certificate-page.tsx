import Link from "next/link";

import { getSampleCertificate } from "@/KYAregistry/services/sample-certificate";

export default function KyaSampleCertificatePage() {
  const certificate = getSampleCertificate();
  const verificationRows: Array<[string, string | null | undefined]> = [
    ["API endpoint", certificate.verification.apiUrl],
    ["Public URL", certificate.verification.publicUrl],
    ["Badge URL", certificate.verification.badgeUrl],
    ["Issuer metadata", certificate.verification.issuerMetadataUrl],
    ["Trust signing", certificate.verification.trustSigningProvider],
    ["Signature algorithm", certificate.verification.signatureAlgorithm],
    ["Evidence hash", certificate.review.evidenceHash],
    ["Expires", certificate.review.expiresAt],
  ];

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Sample certificate
          </p>
          <h1 className="mt-4 break-words font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.08] text-zinc-50 sm:text-5xl">
            {certificate.certificateId}
          </h1>
          <p className="mt-5 max-w-4xl text-base leading-8 text-zinc-300">
            This is an illustrative hosted KYA certificate. It shows what a reviewed MCP server or agent certificate looks like before your first live production company is listed.
          </p>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 md:grid-cols-3 lg:px-10">
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Type</p>
            <p className="mt-3 text-3xl font-semibold text-orange-300">Sample</p>
          </article>
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">KYA level</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{certificate.review.kyaLevel}</p>
          </article>
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Risk class</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{certificate.review.riskClass}</p>
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
                ["Asset", certificate.asset.name],
                ["Asset type", certificate.asset.type.replaceAll("_", " ")],
                ["Protocol", certificate.asset.protocol],
              ].map(([label, value]) => (
                <div className="bg-[#111414] px-5 py-4" key={label}>
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                  <dd className="mt-2 break-words text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-px bg-zinc-800 p-px">
              <div className="bg-[#111414] px-5 py-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Agent ID / DID
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-6 text-zinc-300">{certificate.asset.did}</p>
              </div>
            </div>
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
            <Link className="mt-5 inline-flex rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href={certificate.verification.apiUrl}>
              Open sample JSON
            </Link>
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:px-10">
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Trust signing
            </p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Xupra signs the canonical certificate payload with AWS KMS. The issuer metadata endpoint publishes the public key that external verifiers use to validate that signature.
            </p>
          </article>
          <article className="border border-zinc-800 bg-[#111414] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              MCP verification
            </p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              The hosted MCP server turns the certificate into a live trust check. Verifiers can fetch the certificate offline, then use the MCP handshake tools when a transaction needs challenge-response proof that the remote agent still controls the certified key.
            </p>
          </article>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Signed certificate payload
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-50">Illustrative public record</h2>
            </div>
            <Link className="text-sm font-medium text-emerald-300 underline" href="/kya-registry">
              Back to KYA
            </Link>
          </div>
          <pre className="mt-5 max-h-[34rem] overflow-auto border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-200">
            {JSON.stringify(certificate.signedCertificate, null, 2)}
          </pre>
        </div>
      </section>
    </main>
  );
}
