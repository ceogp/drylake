import Link from "next/link";

import { ExtensionConnectAuthButtons } from "@/components/extension-connect-auth-buttons";
import { ExtensionBrowserReturn } from "@/components/extension-browser-return";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { createExtensionAuthRequest } from "@/lib/services/extension-auth-requests";
import { getCurrentAppContext } from "@/lib/services/current-user";

const allowedCallbackProtocols = new Set(["vscode:", "vscode-insiders:", "cursor:"]);

const steps = [
  "Click Connect in VS Code or Cursor.",
  "The extension opens this page in your browser.",
  "Sign up or sign in if needed.",
  "Xupra creates your starter workspace automatically.",
  "The browser returns to the editor so you can scan, import, and review the repo first.",
];

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getValidCallback(rawValue: string) {
  if (!rawValue.trim()) {
    return null;
  }

  try {
    const url = new URL(rawValue);

    if (!allowedCallbackProtocols.has(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildConnectPath(
  callback: string | null,
  editor: "vscode" | "cursor",
  options?: {
    manual?: boolean;
  },
) {
  const params = new URLSearchParams();

  if (callback) {
    params.set("callback", callback);
  }

  params.set("editor", editor);

  if (options?.manual) {
    params.set("manual", "1");
  }

  return `/extensions/connect?${params.toString()}`;
}

function buildReconnectPath(callback: string | null, editor: "vscode" | "cursor") {
  return buildConnectPath(callback, editor);
}

function buildManualFallbackPath(callback: string | null, editor: "vscode" | "cursor") {
  return buildConnectPath(callback, editor, { manual: true });
}

function isManualMode(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  return normalized === "1" || normalized.toLowerCase() === "true";
}

function getEditor(value: string | string[] | undefined): "vscode" | "cursor" {
  return normalizeSearchValue(value) === "cursor" ? "cursor" : "vscode";
}

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const callback = getValidCallback(normalizeSearchValue(resolvedSearchParams.callback));
  const editor = getEditor(resolvedSearchParams.editor);
  const manualMode = isManualMode(resolvedSearchParams.manual);
  const reconnectPath = buildReconnectPath(callback, editor);
  const manualFallbackPath = buildManualFallbackPath(callback, editor);
  const context = await getCurrentAppContext();
  const browserRequest =
    callback && context && !manualMode
      ? await createExtensionAuthRequest({
          userId: context.user.id,
          organizationId: context.organization.id,
          editor,
        })
      : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_46%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">
              Extension Connection
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
              {context
                ? `Return ${context.organization.name} to VS Code or Cursor`
                : "Connect Xupra back to the editor"}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              The editor opens the browser for identity, Xupra creates the starter workspace on
              first sign-in, and the browser hands control back to VS Code or Cursor.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/extensions/install"
            >
              Install Guide
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/app"
            >
              Open App
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {callback && browserRequest ? (
            <ExtensionBrowserReturn
              callback={callback}
              code={browserRequest.code}
              manualFallbackHref={manualFallbackPath}
            />
          ) : callback && !manualMode ? (
            <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Sign In To Continue
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Finish account setup, then go right back to the editor
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use any email. Xupra creates your starter workspace automatically, then returns you
                to VS Code or Cursor so you can import the repo first and decide on upgrades later.
              </p>
              <ExtensionConnectAuthButtons reconnectPath={reconnectPath} />
              <p className="mt-4 text-xs leading-6 text-stone-500">
                If the browser return does not work later, manual token fallback is still available.
              </p>
            </section>
          ) : (
            <ExtensionConnectCard />
          )}

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              What to do
            </p>
            <div className="mt-5 grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-stone-700"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    Step {index + 1}
                  </span>
                  <p className="mt-2">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-700">
              Upload, import, and compatibility checks are available on free. Upgrade later from{" "}
              <span className="font-mono text-xs">/billing</span> when you want export preview,
              credential vault, or deployment workflow.
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
              If your repo does not keep skills, rules, or agent files in the default directories,
              add patterns in extension settings under{" "}
              <span className="font-mono text-xs">xupra.additionalScanPatterns</span>.
            </div>

            {!callback || manualMode ? (
              <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                This screen is the fallback path. The normal customer flow starts inside the
                extension and returns to the editor automatically.
              </div>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  );
}
