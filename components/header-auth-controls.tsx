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
    : undefined;

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
              <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal" {...signUpRedirectProps}>
              <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800">Sign Up</button>
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
