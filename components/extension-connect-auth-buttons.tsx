"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function ExtensionConnectAuthButtons({
  reconnectPath,
}: {
  reconnectPath: string;
}) {
  const signInRedirectProps = {
    forceRedirectUrl: reconnectPath,
    fallbackRedirectUrl: reconnectPath,
    signUpForceRedirectUrl: reconnectPath,
    signUpFallbackRedirectUrl: reconnectPath,
  };

  const signUpRedirectProps = {
    forceRedirectUrl: reconnectPath,
    fallbackRedirectUrl: reconnectPath,
    signInForceRedirectUrl: reconnectPath,
    signInFallbackRedirectUrl: reconnectPath,
  };

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <SignUpButton mode="modal" {...signUpRedirectProps}><button className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700">Sign Up</button></SignUpButton>
      <SignInButton mode="modal" {...signInRedirectProps}><button className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100">Sign In</button></SignInButton>
    </div>
  );
}
