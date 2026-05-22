import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const clerkTapeAppearance = {
  variables: {
    borderRadius: "6px",
    colorBackground: "#ffffff",
    colorDanger: "#e84a5f",
    colorInputBackground: "#f7f4ea",
    colorInputText: "#111111",
    colorPrimary: "#005caf",
    colorText: "#111111",
    colorTextSecondary: "#4b463f",
    fontFamily: "var(--font-heading), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-mono), ui-monospace, monospace",
  },
  elements: {
    card: "border-[5px] border-black shadow-[10px_10px_0_#111111] rounded-[8px]",
    cardBox: "shadow-none",
    footer: "bg-white",
    footerActionLink: "font-black text-[#005caf] hover:text-black",
    formButtonPrimary: "border-[4px] border-black bg-[#ffd60a] text-black font-black uppercase tracking-[0.12em] shadow-[5px_5px_0_#111111] hover:bg-[#36b979] hover:text-black",
    formFieldInput: "border-[3px] border-black bg-[#f7f4ea] text-black focus:ring-0 focus:shadow-[4px_4px_0_#111111]",
    formFieldLabel: "font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-700",
    headerSubtitle: "text-stone-600",
    headerTitle: "font-black text-stone-950",
    socialButtonsBlockButton: "border-[3px] border-black bg-white text-black font-black shadow-[4px_4px_0_#111111] hover:bg-[#f7f4ea]",
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
              className="h-14 w-14 rounded-[4px] border-[4px] border-black bg-white"
              height={56}
              src="/drylake-logo.svg"
              width={56}
              priority
            />
            <span className="rounded-[4px] border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-black">
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
              ["Kanban", "#ffd60a"],
              ["Pipeline", "#36b979"],
              ["Agents", "#ffffff"],
            ].map(([label, color]) => (
              <div key={label} className="border-[4px] border-black px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] text-black" style={{ backgroundColor: color }}>
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
