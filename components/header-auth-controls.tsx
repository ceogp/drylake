"use client";

import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type HeaderAuthControlsProps = {
  configured: boolean;
  signedIn: boolean;
  accountLabel?: string;
  logoutHref: string;
};

function getManualMode(value: string | null) {
  if (!value) {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function buildExtensionConnectPath(searchParams: ReadonlyURLSearchParams) {
  const callback = searchParams.get("callback");
  const editor = searchParams.get("editor") === "cursor" ? "cursor" : "vscode";
  const manual = getManualMode(searchParams.get("manual"));
  const params = new URLSearchParams();

  if (callback) {
    params.set("callback", callback);
  }

  params.set("editor", editor);

  if (manual) {
    params.set("manual", "1");
  }

  return `/extensions/connect?${params.toString()}`;
}

function authPath(pathname: string, redirectUrl: string) {
  const params = new URLSearchParams();
  params.set("redirect_url", redirectUrl);
  return `${pathname}?${params.toString()}`;
}

export function HeaderAuthControls(props: HeaderAuthControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isExtensionConnectPage = pathname === "/extensions/connect";
  const hasExtensionCallback = Boolean(searchParams.get("callback"));
  const redirectPath = isExtensionConnectPage
    ? buildExtensionConnectPath(searchParams)
    : "/skills";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  if (props.signedIn) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <span className="max-w-[180px] truncate">{props.accountLabel ?? "Account"}</span>
          <span aria-hidden="true" className="text-zinc-500">▾</span>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-zinc-800 bg-[#111414] p-2 shadow-2xl shadow-black/40">
            <Link className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 hover:text-white" href="/workspace" onClick={() => setMenuOpen(false)}>
              Agent Control
            </Link>
            <Link className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 hover:text-white" href="/account" onClick={() => setMenuOpen(false)}>
              Account
            </Link>
            <Link className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 hover:text-white" href="/billing" onClick={() => setMenuOpen(false)}>
              Billing
            </Link>
            <Link className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 hover:text-white" href="/security/reports" onClick={() => setMenuOpen(false)}>
              Security Reports
            </Link>
            <a
              className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 hover:text-white"
              href={props.logoutHref}
            >
              Sign Out
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  if (!props.configured) {
    return (
      <div className="rounded border border-red-400/40 bg-red-400/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200">
        Auth Missing
      </div>
    );
  }

  if (isExtensionConnectPage && hasExtensionCallback) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        className="text-sm font-medium text-zinc-300 transition hover:text-zinc-100"
        href={authPath("/sign-in", redirectPath)}
      >
        Sign In
      </Link>
      <Link
        className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
        href="/pricing"
      >
        Register
      </Link>
    </div>
  );
}
