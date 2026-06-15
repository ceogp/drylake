import Link from "next/link";
import type { ReactNode } from "react";

import { AdminShell } from "@/app/admin/_components/admin-ui";

import { KyaRegistryAdminNav } from "./kya-registry-admin-nav";

export function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-stone-800">
      {label}
      <input
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-stone-700"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function Textarea({
  label,
  name,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-stone-800">
      {label}
      <textarea
        className="min-h-24 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-stone-700"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

export function SubmitButton({
  children,
  tone = "primary",
}: {
  children: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <button
      className={[
        "rounded-md px-4 py-2 text-sm font-semibold transition",
        tone === "primary"
          ? "bg-stone-950 text-white hover:bg-stone-800"
          : "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
      ].join(" ")}
      type="submit"
    >
      {children}
    </button>
  );
}

export function formatMoneyUsdCents(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `$${(value / 100).toFixed(2)}`;
}

export function KyaRegistryAdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      title="KYA Registry Operations"
      subtitle="Internal operator workflow for discovered MCP servers, outreach, Stripe invoices, test evidence, hosted certificates, and public registry publication."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/kya-registry"
        >
          Product site
        </Link>
        <Link
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/kya-registry/registry"
        >
          Public registry
        </Link>
        <Link
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/api/kya-registry/v1/registry"
        >
          Registry API
        </Link>
        <Link
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/.well-known/kya-registry.json"
        >
          Issuer metadata
        </Link>
      </div>
      <KyaRegistryAdminNav />
      {children}
    </AdminShell>
  );
}
