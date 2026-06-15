import Link from "next/link";

import { getSampleCertificateApiUrl, getSampleCertificatePublicUrl } from "@/KYAregistry/services/sample-certificate";

const certificateFields = [
  "Certificate ID",
  "Hosted verification URL",
  "Issuer DID",
  "Company identity",
  "Reviewed agent or MCP asset",
  "KYA level",
  "Risk class",
  "AWS KMS signature",
  "Encrypted AWS archive",
  "Blockchain anchor hash",
  "Evidence hash",
  "Issue and expiry dates",
  "Revocation-aware status",
] as const;

const standards = [
  ["KYA-L1", "Stable agent identity, accountable company identity, and baseline transaction records."],
  ["KYA-L2", "Stronger delegation controls, revocation paths, and operational auditability."],
  ["KYA-L3", "Cryptographic identity, blockchain-anchored hash proofs, tamper-evident logs, and third-party verification endpoints."],
] as const;

const verificationFlow = [
  {
    label: "1. Sign the certificate",
    body: "Xupra signs the hosted certificate with AWS KMS and publishes issuer metadata so verifiers can validate the issuer public key.",
  },
  {
    label: "2. Anchor the hash",
    body: "Xupra records a SHA-256 proof of the certificate on a public blockchain through AWS infrastructure. Private evidence and customer data stay off-chain.",
  },
  {
    label: "3. Embed the certificate reference",
    body: "The company places the hosted certificate URL or ID inside an agent file, agent card, or MCP-facing manifest so peers know what trust record to fetch.",
  },
  {
    label: "4. Verify offline first",
    body: "A peer agent fetches the hosted certificate JSON, checks active status, expiry, KYA level, MCP risk class, subject binding, signature, and blockchain anchor status.",
  },
  {
    label: "5. Use MCP for live proof",
    body: "If the transaction needs stronger assurance, the peer calls the hosted MCP tools to prepare a challenge and verify that the remote agent still controls the certified key.",
  },
] as const;

const trustStack = [
  {
    title: "AWS KMS certificate signature",
    body: "The canonical KYA certificate payload is signed with an AWS KMS-backed issuer key so agents can verify the issuer and detect tampering.",
  },
  {
    title: "Encrypted AWS publication",
    body: "Signed certificate artifacts and manifests publish through the AWS-backed trust archive. Private review evidence remains protected outside the public certificate.",
  },
  {
    title: "Blockchain hash anchor",
    body: "A public chain stores only a certificate hash and timestamp proof. The chain proves the certificate existed without exposing customer evidence or agent internals.",
  },
] as const;

function CertificatePreview() {
  return (
    <section aria-label="Hosted KYA certificate preview" className="self-start border border-zinc-800 bg-[#101414]">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Hosted certificate
          </p>
          <p className="mt-2 font-mono text-sm text-zinc-400">https://xupracorp.com/kya-registry/certificates/XMKS-KYA-2026-000001</p>
        </div>
        <div className="border border-emerald-400 bg-emerald-400 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-950">
          Active
        </div>
      </div>
      <dl className="grid gap-px bg-zinc-800 text-sm md:grid-cols-2">
        {[
          ["Issuer", "did:web:xupracorp.com"],
          ["Subject", "Example AI Inc."],
          ["Asset", "Payment MCP endpoint"],
          ["Standard", "KYA Agent Transaction v0.1"],
          ["KYA level", "KYA-L2"],
          ["Risk class", "MCP-R1"],
          ["Anchor", "SHA-256 proof on-chain"],
        ].map(([label, value]) => (
          <div className="bg-[#101414] px-5 py-4" key={label}>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
            <dd className="mt-2 break-words text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-zinc-800 px-5 py-4">
        <p className="font-mono text-xs leading-6 text-zinc-400">
          Agents verify status, subject, reviewed asset, expiry, evidence hash, KMS signature, and blockchain anchor proof before approving an agent-to-agent transaction.
        </p>
      </div>
    </section>
  );
}

export default function KyaRegistryLandingPage() {
  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-20">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Xupra product
            </p>
            <h1 className="mt-5 max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              KYA Registry
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              AWS-backed hosted Know Your Agent certificates with KMS signatures, encrypted certificate publication, blockchain hash anchoring, and online verification before agent-to-agent transactions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href="/kya-registry/sample-certificate">
                View sample certificate
              </Link>
              <Link className="rounded-md border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white" href="/kya-registry/standards">
                Read the standard
              </Link>
            </div>
            <div className="mt-10 grid gap-3 border-l border-zinc-800 pl-5 text-sm leading-7 text-zinc-400">
              <p>
                KYA Registry is the hosted trust layer for MCP servers and agents that need a public certificate, a blockchain-anchored proof, and a live verification endpoint before they transact with other agents.
              </p>
              <p>
                The certificate is the signed public record. The blockchain anchor is the public tamper-evidence layer. The hosted MCP verification server is the live challenge-response path when a transaction needs stronger proof than lookup alone.
              </p>
            </div>
          </div>

          <CertificatePreview />
        </div>
      </section>

      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Hosted credential
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              A certificate endpoint that agents can verify online.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              A KYA certificate is a signed, AWS-backed attestation for one company and one reviewed agent or MCP asset. Agents can fetch the endpoint, verify the issuer signature, check the blockchain hash anchor when present, and enforce active status before exchanging data, calling tools, or initiating payment-related work.
            </p>
          </div>
          <div className="grid gap-px bg-zinc-800 sm:grid-cols-2">
            {certificateFields.map((field) => (
              <div className="bg-[#111414] px-4 py-3 text-sm text-zinc-300" key={field}>
                {field}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0b0d0d]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Certificate trust stack
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              Signed by AWS. Anchored on-chain. Verified online.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              KYA uses AWS for the private trust boundary and blockchain for public tamper evidence. The chain receives hashes only, so customer evidence, survey answers, remediation notes, and private operational details remain off-chain.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {trustStack.map((item) => (
              <article className="border border-zinc-800 bg-[#111414] p-5" key={item.title}>
                <h3 className="text-lg font-semibold text-zinc-50">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              How the system works
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              Trust signing and MCP do different jobs.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              The certificate is the signed trust record. Blockchain is the public hash timestamp. MCP is the live verification channel. KYA uses all three: AWS KMS signs the hosted certificate, the chain anchors the certificate hash, and the hosted MCP server adds challenge-response when a transaction needs proof that the remote agent still controls the certified operational key.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {verificationFlow.map((item) => (
              <article className="border border-zinc-800 bg-[#111414] p-5" key={item.label}>
                <h3 className="text-lg font-semibold text-zinc-50">{item.label}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="border border-zinc-800 bg-[#111414] p-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Sample public certificate
              </p>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                You can inspect an illustrative certificate page and its machine-readable JSON right now, even before the first live production company is published.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href="/kya-registry/sample-certificate">
                  Open sample page
                </Link>
                <a className="rounded-md border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:text-white" href={getSampleCertificateApiUrl()}>
                  Open sample JSON
                </a>
              </div>
            </article>
            <article className="border border-zinc-800 bg-[#111414] p-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Trust endpoints
              </p>
              <div className="mt-4 grid gap-3 text-xs leading-6 text-zinc-300">
                <p className="break-all font-mono">{getSampleCertificatePublicUrl()}</p>
                <p className="break-all font-mono">https://xupracorp.com/.well-known/kya-registry.json</p>
                <p className="break-all font-mono">https://xupracorp.com/api/kya-registry/v1/mcp</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Agent transaction standard
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
              Know Your Agent levels.
            </h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400">
              The first Xupra standard focuses on identity, delegation, auditability, and revocation-aware hosted verification for agent-to-agent activity.
            </p>
          </div>
          <div className="grid gap-4">
            {standards.map(([level, body]) => (
              <article className="grid gap-3 border border-zinc-800 bg-[#111414] p-5 sm:grid-cols-[8rem_1fr]" key={level}>
                <h3 className="font-mono text-sm font-semibold text-emerald-300">{level}</h3>
                <p className="text-sm leading-7 text-zinc-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
