import Link from "next/link";

import { ExtensionConnectApprovalCard } from "@/components/extension-connect-approval-card";
import { ExtensionConnectAuthButtons } from "@/components/extension-connect-auth-buttons";
import { ExtensionBrowserReturn } from "@/components/extension-browser-return";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { ConnectedWorkspaceCard } from "@/components/connected-workspace-card";
import {
  createExtensionAuthRequest,
  getExtensionAuthRequestStatus,
} from "@/lib/services/extension-auth-requests";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { getPrimaryWorkspacePath } from "@/lib/services/workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedCallbackProtocols = new Set(["vscode:", "vscode-insiders:", "cursor:"]);

const steps = [
  "Click Register or Connect in VS Code or Cursor.",
  "The extension opens this approval request in your browser.",
  "Sign up or sign in if needed.",
  "Approve and connect the editor to your current account, workspace, and Guard report history.",
  "The extension updates from the polling request; use Return to Editor only if the editor does not come forward.",
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
    requestId?: string;
    state?: string;
  },
) {
  const params = new URLSearchParams();

  if (callback) {
    params.set("callback", callback);
  }

  params.set("editor", editor);

  if (options?.requestId) {
    params.set("requestId", options.requestId);
  }

  if (options?.state) {
    params.set("state", options.state);
  }

  if (options?.manual) {
    params.set("manual", "1");
  }

  return `/extensions/connect?${params.toString()}`;
}

function buildReconnectPath(
  callback: string | null,
  editor: "vscode" | "cursor",
  requestId: string,
  state: string,
) {
  return buildConnectPath(callback, editor, { requestId, state });
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
  const requestId = normalizeSearchValue(resolvedSearchParams.requestId).trim();
  const callbackState = normalizeSearchValue(resolvedSearchParams.state).trim();
  const reconnectPath = buildReconnectPath(callback, editor, requestId, callbackState);
  const manualFallbackPath = buildManualFallbackPath(callback, editor);
  const context = await getCurrentAppContext();
  const workspaceHref = context ? (await getPrimaryWorkspacePath()) ?? "/app" : "/app";
  const signedInLabel = context?.user.profile?.displayName ?? context?.user.email ?? "";
  const connectRequest = requestId ? await getExtensionAuthRequestStatus(requestId) : null;
  const requestOwnedByDifferentSession = Boolean(
    context &&
      connectRequest &&
      ((connectRequest.userId && connectRequest.userId !== context.user.id) ||
        (connectRequest.organizationId && connectRequest.organizationId !== context.organization.id)),
  );
  const browserRequest =
    callback && context && !manualMode && !requestId
      ? await createExtensionAuthRequest({
          userId: context.user.id,
          organizationId: context.organization.id,
          editor,
        })
      : null;

  return (
    <main className="tape-page min-h-screen">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="tape-eyebrow">Extension Connection</p>
            <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black leading-tight text-stone-950 sm:text-5xl">
              {context
                ? `Return ${context.organization.name} to VS Code or Cursor`
                : "Connect DryLake back to the editor"}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              The editor opens the browser for identity, DryLake creates the starter workspace and Guard account surface on
              first sign-in, and the browser hands control back to VS Code or Cursor.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href={workspaceHref}>
              Open Dashboard
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {requestId ? !context ? (
            <section className="tape-panel p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">Sign In To Approve</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Finish account setup, then approve this editor connection
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                If you are already signed in, this page will come right back to the approval screen.
                The editor keeps waiting for approval in the background.
              </p>
              <ExtensionConnectAuthButtons reconnectPath={reconnectPath} />
              <p className="mt-4 text-xs leading-6 text-stone-500">
                If browser approval still fails, manual token fallback remains available.
              </p>
            </section>
          ) : !connectRequest ? (
            <section className="tape-panel border border-red-500/30 bg-red-950/30 p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-700">Request Missing</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                This editor connection request no longer exists
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Start Connect again from VS Code or Cursor to create a fresh approval request.
              </p>
            </section>
          ) : requestOwnedByDifferentSession ? (
            <section className="tape-panel border border-orange-400/30 bg-orange-400/10 p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-700">Switch Account</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                This browser session does not match the editor approval request
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Switch to the same Xupra account and organization that should own this editor
                connection, or start a new connect request from the editor.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href={workspaceHref}>
                  Open Dashboard
                </Link>
                <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href={manualFallbackPath}>
                  Manual Fallback
                </Link>
              </div>
            </section>
          ) : (
            <ExtensionConnectApprovalCard
              callback={callback}
              editor={connectRequest.editor}
              initialApprovedAt={connectRequest.approvedAt}
              initialStatus={connectRequest.status}
              requestId={connectRequest.id}
              state={callbackState || null}
              workspaceHref={workspaceHref}
            />
          ) : callback && browserRequest ? (
            <ExtensionBrowserReturn
              callback={callback}
              code={browserRequest.code}
              manualFallbackHref={manualFallbackPath}
              workspaceHref={workspaceHref}
            />
          ) : callback && !manualMode ? (
            <section className="tape-panel p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">Sign In To Continue</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Finish account setup, then go right back to the editor
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use any email. DryLake creates your starter workspace and personal Guard report area automatically,
                then brings you back here so you can approve the editor connection.
              </p>
              <ExtensionConnectAuthButtons reconnectPath={reconnectPath} />
              <p className="mt-4 text-xs leading-6 text-stone-500">
                If the browser cannot reopen the editor later, manual token fallback is still available.
              </p>
            </section>
          ) : !context ? (
            <section className="tape-panel p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">Sign In Required</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Sign in first, then generate a fallback token
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Manual token fallback only works after you are signed in on this site. Once signed in,
                this page will show the token generator and your workspace details.
              </p>
              <ExtensionConnectAuthButtons reconnectPath={reconnectPath} />
              <p className="mt-4 text-xs leading-6 text-stone-500">
                After sign in: click <span className="font-medium text-stone-800">Generate Token</span>,
                then in VS Code run <span className="font-mono">Connect Xupra</span> and choose
                <span className="font-medium text-stone-800"> Paste Token</span> if browser return still fails.
              </p>
            </section>
          ) : (
            <ExtensionConnectCard />
          )}

          <article className="tape-panel p-7">
            {context ? (
              <ConnectedWorkspaceCard
                organizationName={context.organization.name}
                signedInLabel={signedInLabel}
                workspaceHref={workspaceHref}
              />
            ) : null}

            <p className={`font-mono text-xs uppercase tracking-[0.2em] text-orange-700 ${context ? "mt-6" : ""}`}>
              What to do
            </p>
            <div className="mt-5 grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-5 py-4 text-sm leading-7 text-zinc-300"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    Step {index + 1}
                  </span>
                  <p className="mt-2">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm leading-7 text-zinc-300">
              Free includes extension connection, local Guard scan, and local report review. Upgrade later from
              <span className="font-mono text-xs"> /pricing</span> or <span className="font-mono text-xs">/billing</span>
              when you want Fix with AI, approved upload, Deep Cloud Analysis, saved website reports, or Team Security workflows.
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-7 text-zinc-300">
              If your repo does not keep skills, rules, or agent files in the default directories,
              add patterns in extension settings under <span className="font-mono text-xs">xupra.additionalScanPatterns</span>.
            </div>

            {!requestId && (!callback || manualMode) ? (
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-7 text-zinc-300">
                This screen is the fallback path. The normal customer flow starts inside the extension and the editor
                completes auth once browser approval is granted.
              </div>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  );
}
