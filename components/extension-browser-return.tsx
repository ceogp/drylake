"use client";

import { useEffect, useMemo } from "react";

function buildReturnUrl(callback: string, code: string) {
  const url = new URL(callback);
  url.searchParams.set("code", code);
  url.searchParams.set("connected", "1");
  return url.toString();
}

export function ExtensionBrowserReturn({
  callback,
  code,
  manualFallbackHref,
}: {
  callback: string;
  code: string;
  manualFallbackHref: string;
}) {
  const target = useMemo(() => buildReturnUrl(callback, code), [callback, code]);

  useEffect(() => {
    window.location.assign(target);
  }, [target]);

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
        Returning To VS Code
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
        Finish the handoff in the editor
      </h2>
      <p className="mt-3 text-sm leading-7 text-stone-700">
        Your workspace is ready. If the editor does not open automatically, use the button below or
        fall back to the manual token flow.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700"
          href={target}
        >
          Return To VS Code
        </a>
        <a
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href={manualFallbackHref}
        >
          Manual Fallback
        </a>
      </div>

      <p className="mt-4 text-xs leading-6 text-stone-500">
        If the editor does not reopen automatically, use the manual fallback and paste a token instead.
      </p>
    </section>
  );
}
