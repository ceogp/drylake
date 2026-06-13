import Link from "next/link";
import type { ReactNode } from "react";

import { DryLakeLogo } from "@/components/drylake-logo";

export function DryLakeAuthShell({
  children,
  eyebrow,
  title,
  body,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <main className="tape-page min-h-screen px-6 py-12 md:px-10" data-drylake-auth-shell>
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-8">
          <Link className="inline-flex items-center" href="/">
            <DryLakeLogo className="h-14 w-auto" priority />
          </Link>
          <div className="space-y-5">
            <p className="tape-eyebrow">{eyebrow}</p>
            <h1 className="max-w-xl font-[family-name:var(--font-heading)] text-4xl font-black leading-tight text-zinc-50 sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-lg text-lg leading-8 text-zinc-300">{body}</p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              ["Kanban", "#34d399"],
              ["Pipeline", "#fb923c"],
              ["Agents", "#18181b"],
            ].map(([label, color]) => (
              <div key={label} className="rounded border border-zinc-800 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-100" style={{ backgroundColor: color }}>
                {label}
              </div>
            ))}
          </div>
        </section>
        <section className="flex justify-center lg:justify-end">{children}</section>
      </div>
    </main>
  );
}
