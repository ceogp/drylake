"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";

import { clerkTapeAppearance } from "@/components/drylake-auth-shell";

type HeaderAuthControlsProps =
  | {
      authMode: "clerk";
      configured: boolean;
    }
  | {
      authMode: "cognito";
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
  const isExtensionConnectPage = pathname === "/extensions/connect";
  const hasExtensionCallback = Boolean(searchParams.get("callback"));
  const redirectPath = isExtensionConnectPage
    ? buildExtensionConnectPath(searchParams)
    : "/workspace";

  if (props.authMode === "cognito") {
    if (props.signedIn) {
      return (
        <div className="flex items-center gap-2">
          <Link
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-orange-400 hover:text-orange-200"
            href="/account"
          >
            {props.accountLabel ?? "Account"}
          </Link>
          <a
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-orange-400 hover:text-orange-200"
            href={props.logoutHref}
          >
            Sign Out
          </a>
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
      <div className="flex items-center gap-2">
        <Link
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-orange-400 hover:text-orange-200"
          href={authPath("/sign-in", redirectPath)}
        >
          Sign In
        </Link>
        <Link
          className="rounded border border-emerald-400 bg-emerald-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          href={authPath("/sign-up", redirectPath)}
        >
          Register
        </Link>
      </div>
    );
  }

  return (
    <>
      <Show when="signed-out">
        {isExtensionConnectPage && hasExtensionCallback ? null : (
          <>
            <Link className="rounded border border-zinc-700 bg-zinc-950 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href={authPath("/sign-in", redirectPath)}>
              Sign In
            </Link>
            <Link className="rounded border border-emerald-400 bg-emerald-400 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-300" href={authPath("/sign-up", redirectPath)}>
              Register to try
            </Link>
          </>
        )}
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={clerkTapeAppearance}
          customMenuItems={[
            { label: "Account", href: "/account" },
            { label: "Billing", href: "/billing" },
          ]}
          signInUrl="/sign-in"
          userProfileMode="navigation"
          userProfileUrl="/account"
        />
      </Show>
    </>
  );
}
