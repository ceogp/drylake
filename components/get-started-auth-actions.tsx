"use client";

import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  useUser,
} from "@clerk/nextjs";

export function GetStartedAuthActions({
  workspaceHref,
}: {
  workspaceHref: string;
}) {
  const { user } = useUser();
  const signedInLabel =
    user?.fullName?.trim() || user?.primaryEmailAddress?.emailAddress || "Signed in";

  return (
    <>
      <Show when="signed-out">
        <div className="flex flex-wrap gap-3">
          <SignUpButton mode="modal">
            <button className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700">
              Create Workspace
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100">
              Sign In
            </button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Connected
            </span>
            <span className="text-sm text-stone-700">Signed in as {signedInLabel}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
              href={workspaceHref}
            >
              Open Import Workspace
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
              href="/extensions/install"
            >
              Install The Extension
            </Link>
          </div>
        </div>
      </Show>
    </>
  );
}
