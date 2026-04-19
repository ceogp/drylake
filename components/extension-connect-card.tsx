"use client";

import { useState, useTransition } from "react";

type TokenResponse = {
  token: {
    token: string;
    expiresAt: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

export function ExtensionConnectCard() {
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const generateToken = () => {
    setCopied(false);
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/extension/session-token", {
          method: "POST",
        });
        const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } } & TokenResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error?.message ?? "Failed to generate extension token.");
        }

        setToken(payload.token.token);
        setExpiresAt(payload.token.expiresAt);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to generate extension token.");
      }
    });
  };

  const copyToken = async () => {
    if (!token) {
      return;
    }

    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
        Manual Fallback
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
        Generate a fallback token for VS Code or Cursor
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
        The normal flow returns to the editor automatically. Use this only when the browser callback
        does not reopen VS Code or Cursor.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          onClick={generateToken}
          type="button"
        >
          {isPending ? "Generating..." : "Generate Token"}
        </button>
        <button
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!token}
          onClick={copyToken}
          type="button"
        >
          {copied ? "Copied" : "Copy Token"}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-[1.35rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Extension token</p>
        <textarea
          className="mt-3 min-h-40 w-full rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-stone-800"
          readOnly
          value={token}
        />
        <p className="mt-3 text-xs leading-6 text-stone-500">
          {expiresAt ? `Expires ${new Date(expiresAt).toLocaleString()}` : "Generate a token to continue."}
        </p>
      </div>
    </section>
  );
}
