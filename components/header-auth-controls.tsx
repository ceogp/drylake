"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";

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

export function HeaderAuthControls() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isExtensionConnectPage = pathname === "/extensions/connect";
  const hasExtensionCallback = Boolean(searchParams.get("callback"));
  const redirectPath = isExtensionConnectPage
    ? buildExtensionConnectPath(searchParams)
    : "/workspace";

  const signInRedirectProps = redirectPath
    ? {
        forceRedirectUrl: redirectPath,
        fallbackRedirectUrl: redirectPath,
        signUpForceRedirectUrl: redirectPath,
        signUpFallbackRedirectUrl: redirectPath,
      }
    : {};

  const signUpRedirectProps = redirectPath
    ? {
        forceRedirectUrl: redirectPath,
        fallbackRedirectUrl: redirectPath,
        signInForceRedirectUrl: redirectPath,
        signInFallbackRedirectUrl: redirectPath,
      }
    : {};

  return (
    <>
      <Show when="signed-out">
        {isExtensionConnectPage && hasExtensionCallback ? null : (
          <>
            <SignInButton mode="modal" {...signInRedirectProps}>
              <button className="rounded border border-zinc-700 bg-zinc-950 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-zinc-100 transition hover:border-orange-400 hover:text-orange-200">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal" {...signUpRedirectProps}>
              <button className="rounded border border-emerald-400 bg-emerald-400 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-300">Register to try</button>
            </SignUpButton>
          </>
        )}
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
