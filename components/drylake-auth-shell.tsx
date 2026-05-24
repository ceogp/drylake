import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const clerkTapeAppearance = {
  variables: {
    borderRadius: "6px",
    colorBackground: "#111414",
    colorDanger: "#f87171",
    colorInputBackground: "#090a0a",
    colorInputText: "#f4f4f5",
    colorPrimary: "#34d399",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    fontFamily: "var(--font-heading), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-mono), ui-monospace, monospace",
  },
  elements: {
    card: "border border-zinc-800 bg-[#111414] shadow-none rounded-[8px]",
    cardBox: "shadow-none",
    footer: "bg-[#111414]",
    footerActionLink: "font-semibold text-emerald-300 hover:text-emerald-200",
    formButtonPrimary: "border border-emerald-400 bg-emerald-400 text-zinc-950 font-semibold tracking-[0.08em] shadow-none hover:bg-emerald-300 hover:text-zinc-950",
    formFieldInput: "border border-zinc-700 bg-[#090a0a] text-zinc-100 focus:ring-0 focus:border-emerald-400",
    formFieldLabel: "font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400",
    headerSubtitle: "text-zinc-400",
    headerTitle: "font-semibold text-zinc-50",
    socialButtonsBlockButton: "border border-zinc-700 bg-zinc-950 text-zinc-100 font-semibold shadow-none hover:border-orange-400 hover:text-orange-200",
  },
} as const;

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
    <main className="tape-page min-h-screen px-6 py-12 md:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-8">
          <Link className="inline-flex items-center gap-3" href="/">
            <Image
              alt="DryLake logo"
              className="h-12 w-12 rounded border border-zinc-700 bg-zinc-950 object-contain p-1"
              height={56}
              src="/blackwhite.webp"
              width={56}
              priority
            />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-100">
              DryLake
            </span>
          </Link>
          <div className="space-y-5">
            <p className="tape-eyebrow">{eyebrow}</p>
            <h1 className="max-w-xl font-[family-name:var(--font-heading)] text-4xl font-black leading-tight text-stone-950 sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-lg text-lg leading-8 text-stone-700">{body}</p>
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
