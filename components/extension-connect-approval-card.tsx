"use client";

import { useMemo, useState, useTransition } from "react";

type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "consumed";

function buildReturnUrl(callback: string, state: string | null) {
  const url = new URL(callback);
  url.searchParams.set("approved", "1");

  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

export function ExtensionConnectApprovalCard({
  callback,
  editor,
  initialApprovedAt,
  initialStatus,
  requestId,
  state,
  workspaceHref,
}: {
  callback: string | null;
  editor: "vscode" | "cursor";
  initialApprovedAt: string | null;
  initialStatus: ApprovalStatus;
  requestId: string;
  state: string | null;
  workspaceHref: string;
}) {
  const editorLabel = editor === "cursor" ? "Cursor" : "VS Code";
  const [status, setStatus] = useState<ApprovalStatus>(initialStatus);
  const [approvedAt, setApprovedAt] = useState(initialApprovedAt);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const returnUrl = useMemo(
    () => (callback ? buildReturnUrl(callback, state) : null),
    [callback, state],
  );
  const isReady = status === "approved" || status === "consumed";

  const approveConnection = () => {
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/extension/connect/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requestId }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: { message?: string };
          status?: ApprovalStatus;
          approvedAt?: string;
        };

        if (!response.ok || payload.ok === false || !payload.status) {
          throw new Error(payload.error?.message ?? "Failed to approve the editor connection.");
        }

        setStatus(payload.status);
        setApprovedAt(payload.approvedAt ?? new Date().toISOString());
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to approve the editor connection.",
        );
      }
    });
  };

  return (
    <section className="tape-panel p-7">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
        Browser Approval
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
        {isReady
          ? `Your ${editorLabel} connection is approved`
          : `Approve and connect ${editorLabel}`}
      </h2>
      <p className="mt-3 text-sm leading-7 text-stone-700">
        {isReady
          ? `The extension is polling in the background and should update automatically. Use the button below if ${editorLabel} does not come forward.`
          : "Approve this request for the account and workspace currently shown in your browser session. The extension will update as soon as approval is received."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="tape-button px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending || isReady || status === "expired" || status === "denied"}
          onClick={approveConnection}
          type="button"
        >
          {isReady ? "Approved" : isPending ? "Approving..." : `Approve and Connect ${editorLabel}`}
        </button>
        {returnUrl && isReady ? (
          <a
            className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300"
            href={returnUrl}
          >
            Return to {editorLabel}
          </a>
        ) : null}
        <a
          className="tape-button bg-white px-5 py-3 text-sm text-black"
          href={workspaceHref}
        >
          Open Dashboard
        </a>
      </div>

      {returnUrl && isReady ? (
        <p className="mt-4 text-xs leading-6 text-stone-500">
          The browser handoff is optional after approval. The editor should already be finishing
          the connection through the polling request it opened.
        </p>
      ) : null}

      {approvedAt ? (
        <p className="mt-4 text-xs leading-6 text-stone-500">
          Approved {new Date(approvedAt).toLocaleString()}.
        </p>
      ) : null}

      {status === "expired" ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          This editor connection request expired. Start Connect again from the editor.
        </div>
      ) : null}

      {status === "denied" ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          This editor connection request was denied. Start again from the editor if you still want
          to connect.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-6 text-stone-500">
        Browser handoff is now optional. If your browser cannot reopen the editor, the editor still
        completes auth once approval is granted.
      </p>
    </section>
  );
}
