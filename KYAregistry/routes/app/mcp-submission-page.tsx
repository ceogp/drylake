import Link from "next/link";

import { submitTrustMcpServerAction } from "@/KYAregistry/actions/mcp-submission";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";
import { getTrustRegistryWorkspace } from "@/KYAregistry/services/submissions";

function TextField({
  label,
  name,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-800">
      {label}
      <input
        className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <input name={name} type="checkbox" />
      {label}
    </label>
  );
}

export default async function TrustMcpSubmissionPage() {
  const context = await requireCompletedOnboardingAppContextForPage("/app/products/mcp/submit");
  const workspace = await getTrustRegistryWorkspace(context.organization.id);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10">
        <header className="space-y-3">
          <p className="tape-eyebrow">Xupra KYA Registry</p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            MCP server submission
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-stone-700">
            Declare the MCP server transport, package source, exposed capabilities, and high-risk access before the review scan.
          </p>
        </header>

        {!workspace.company ? (
          <section className="tape-panel bg-white p-6">
            <p className="text-sm leading-7 text-stone-700">Create a company profile before submitting an MCP server.</p>
            <Link className="mt-4 inline-flex tape-button bg-white px-4 py-2 text-xs text-black" href="/app/company/profile">
              Open company profile
            </Link>
          </section>
        ) : (
          <form action={submitTrustMcpServerAction} className="tape-panel grid gap-5 bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="MCP server name" name="name" required />
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Transport
                <select
                  className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                  name="transport"
                  required
                >
                  <option value="stdio">stdio</option>
                  <option value="streamable_http">Streamable HTTP</option>
                  <option value="both">both</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Package type
                <select
                  className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                  name="packageType"
                >
                  <option value="">Remote HTTP only or not packaged</option>
                  <option value="npm">npm</option>
                  <option value="pypi">PyPI</option>
                  <option value="docker">Docker</option>
                  <option value="github_release">GitHub release</option>
                  <option value="remote_http_only">remote HTTP only</option>
                </select>
              </label>
              <TextField label="Package identifier" name="packageIdentifier" />
              <TextField label="Repository URL" name="repositoryUrl" type="url" />
              <TextField label="Official MCP Registry URL" name="officialRegistryUrl" type="url" />
              <TextField label="Remote MCP endpoint" name="remoteEndpoint" type="url" />
              <TextField label="Authentication method" name="authMethod" />
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Filesystem access
                <select
                  className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700"
                  name="filesystemAccess"
                >
                  <option value="none">none</option>
                  <option value="read">read</option>
                  <option value="write">write</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Description
              <textarea className="min-h-24 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700" name="description" />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Required environment variables
                <textarea className="min-h-28 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700" name="requiredEnvVars" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Tool list
                <textarea className="min-h-28 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700" name="declaredTools" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Resources list
                <textarea className="min-h-28 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700" name="declaredResources" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Prompts list
                <textarea className="min-h-28 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-700" name="declaredPrompts" />
              </label>
            </div>

            <fieldset className="grid gap-3 rounded border border-stone-300 p-4 md:grid-cols-2">
              <legend className="px-1 text-sm font-semibold text-stone-800">Declared access</legend>
              <Checkbox label="Requires secrets" name="requiresSecrets" />
              <Checkbox label="Executes shell commands" name="shellExecution" />
              <Checkbox label="Accesses network APIs" name="networkAccess" />
              <Checkbox label="Writes to databases" name="databaseWriteAccess" />
              <Checkbox label="Sends email/messages" name="emailMessageAccess" />
              <Checkbox label="Accesses wallets/private keys/payments" name="walletPaymentAccess" />
              <Checkbox label="Accesses production systems" name="productionWriteAccess" />
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                Submit MCP server
              </button>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/app/company/profile">
                Company profile
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
