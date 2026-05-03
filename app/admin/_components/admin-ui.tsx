import Link from "next/link";
import type { ReactNode } from "react";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/audit", label: "Audit" },
];

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString();
}

export function formatJsonPreview(value: unknown) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">
              Platform Admin
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-stone-950 md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-stone-700">{subtitle}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
          {adminLinks.map((link) => (
            <Link
              className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{detail}</p>
    </article>
  );
}

export function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      {eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 text-2xl font-semibold text-stone-950">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = (value ?? "unknown").toLowerCase();
  const strong = ["active", "succeeded", "completed", "ready", "trialing", "trial"].includes(normalized);
  const danger = ["failed", "canceled", "cancelled", "past_due", "suspended"].includes(normalized);

  return (
    <span
      className={[
        "inline-flex rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
        strong
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : danger
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-stone-200 bg-stone-50 text-stone-600",
      ].join(" ")}
    >
      {value ?? "unknown"}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
      {children}
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  const preview = formatJsonPreview(value);

  if (!preview) {
    return <span className="text-stone-500">n/a</span>;
  }

  return (
    <pre className="max-h-56 overflow-auto rounded-md bg-stone-950 p-3 text-xs leading-5 text-stone-100">
      {preview}
    </pre>
  );
}
