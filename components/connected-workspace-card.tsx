import Link from "next/link";

export function ConnectedWorkspaceCard({
  organizationName,
  signedInLabel,
  workspaceHref,
}: {
  organizationName: string;
  signedInLabel: string;
  workspaceHref: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-700">Connected</p>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
            Xupra is linked to {organizationName}
          </h3>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Signed in as {signedInLabel}. Your import workspace is ready.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          href={workspaceHref}
        >
          Open Import Workspace
        </Link>
        <Link
          className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/settings"
        >
          Profile And Settings
        </Link>
        <Link
          className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/billing"
        >
          Billing
        </Link>
      </div>
    </div>
  );
}
