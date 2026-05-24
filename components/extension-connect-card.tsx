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
    <section className="tape-panel p-7">
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
          className="tape-button px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          onClick={generateToken}
          type="button"
        >
          {isPending ? "Generating..." : "Generate Token"}
        </button>
        <button
          className="tape-button bg-white px-5 py-3 text-sm text-black disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!token}
          onClick={copyToken}
          type="button"
        >
          {copied ? "Copied" : "Copy Token"}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Extension token</p>
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-xs leading-6 text-zinc-200"
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
