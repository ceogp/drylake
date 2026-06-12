"use client";

import Link from "next/link";

function authHref(pathname: "/sign-in" | "/sign-up", reconnectPath: string) {
  const params = new URLSearchParams();
  params.set("redirect_url", reconnectPath);
  return `${pathname}?${params.toString()}`;
}

export function ExtensionConnectAuthButtons({
  reconnectPath,
}: {
  reconnectPath: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700"
        href={authHref("/sign-up", reconnectPath)}
      >
        Register and continue
      </Link>
      <Link
        className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
        href={authHref("/sign-in", reconnectPath)}
      >
        Sign in and continue
      </Link>
    </div>
  );
}
