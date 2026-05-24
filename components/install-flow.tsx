"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CanonicalizationStatus = "none" | "succeeded" | "failed";
type Destination = "all" | "cursor" | "codex" | "claude" | "other";
type EditorScheme = "vscode" | "cursor";
type TargetPlatform = "cursor" | "codex" | "claude_agents";
type InstallTarget = TargetPlatform | "all";
type BillingProvider = "stripe" | "clerk";

type InstallStatus = {
  ok: boolean;
  versionId: string;
  organizationId: string;
  billingProvider?: BillingProvider;
  isPro: boolean;
  hasSourceFiles: boolean;
  sourceFileCount: number;
  canonicalItemCount: number;
  canonicalizationStatus: CanonicalizationStatus;
  canonicalizationResult: {
    confidence: number;
    warnings: string[];
    summary: string;
    itemCount: number;
    agentCount: number;
    skillCount: number;
  } | null;
  canonicalizationError?: string | null;
  extensionConnected: boolean;
  error?: {
    message?: string;
  };
};

type CanonicalizeResponse = {
  ok: boolean;
  confidence?: number;
  warnings?: string[];
  summary?: string;
  itemCount?: number;
  agentCount?: number;
  skillCount?: number;
  alreadyDone?: boolean;
  error?: {
    message?: string;
  };
};

type CheckoutResponse = {
  ok: boolean;
  configured?: boolean;
  url?: string | null;
  error?: {
    message?: string;
  };
};

const destinations: Array<{
  id: Destination;
  name: string;
  detail: string;
}> = [
  {
    id: "all",
    name: "All supported tools",
    detail: "Default install to ~/.codex, ~/.claude, and ~/.cursor in one run",
  },
  {
    id: "cursor",
    name: "Cursor",
    detail: "Default install to ~/.cursor/rules and ~/.cursor/skills",
  },
  {
    id: "codex",
    name: "Codex",
    detail: "Default install to ~/.codex/AGENTS.md, ~/.codex/skills, and ~/.codex/agents",
  },
  {
    id: "claude",
    name: "Claude",
    detail: "Default install to ~/.claude/CLAUDE.md, ~/.claude/agents, and ~/.claude/skills",
  },
  { id: "other", name: "Other / Custom path", detail: "Choose a format, pick a folder, or download a ZIP for another tool" },
];

const targetFormats: Array<{
  id: TargetPlatform;
  name: string;
}> = [
  { id: "cursor", name: "Cursor" },
  { id: "codex", name: "Codex" },
  { id: "claude_agents", name: "Claude" },
];

function targetPlatformFor(destination: Destination, customFormat: TargetPlatform): InstallTarget {
  if (destination === "all") {
    return "all";
  }

  if (destination === "cursor") {
    return "cursor";
  }

  if (destination === "codex") {
    return "codex";
  }

  if (destination === "claude") {
    return "claude_agents";
  }

  return customFormat;
}

function buildInstallUri(params: {
  versionId: string;
  destination: Destination;
  targetPlatform: InstallTarget;
  editorScheme: EditorScheme;
}) {
  const mode = params.destination === "other" ? "custom-path" : "runtime-home";

  const query = new URLSearchParams({
    versionId: params.versionId,
    targetPlatform: params.targetPlatform,
    mode,
  });

  return `${params.editorScheme}://xupra.drylake/install?${query.toString()}`;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function InstallFlow({ versionId }: { versionId: string }) {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [message, setMessage] = useState("Loading install status...");
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isCanonicalizing, setIsCanonicalizing] = useState(false);
  const [reviewAccepted, setReviewAccepted] = useState(false);
  const [canonicalizationJustRan, setCanonicalizationJustRan] = useState(false);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [destination, setDestination] = useState<Destination>("all");
  const [customFormat, setCustomFormat] = useState<TargetPlatform>("cursor");

  const loadStatus = useCallback(
    async ({ preserveMessage = false }: { preserveMessage?: boolean } = {}) => {
      setIsLoadingStatus(true);

      try {
        const response = await fetch(`/api/v1/versions/${versionId}/install-status`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as InstallStatus;

        if (!response.ok || !payload.ok) {
          if (!preserveMessage) {
            setMessage(payload.error?.message ?? "Install status is unavailable.");
          }
          return;
        }

        setStatus(payload);
        if (!preserveMessage) {
          setMessage(
            payload.hasSourceFiles
              ? `${payload.sourceFileCount} source files are ready for install.`
              : "Import source files before installing.",
          );
        }
      } catch (error) {
        if (!preserveMessage) {
          setMessage(error instanceof Error ? error.message : "Install status is unavailable.");
        }
      } finally {
        setIsLoadingStatus(false);
      }
    },
    [versionId],
  );

  const runCanonicalization = useCallback(
    async (force = false) => {
      setIsCanonicalizing(true);
      setMessage("Canonicalizing your agents and skills with Kimi AI...");

      try {
        const response = await fetch(`/api/v1/versions/${versionId}/canonicalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(force ? { force: true } : {}),
        });
        const payload = (await response.json()) as CanonicalizeResponse;

        if (!response.ok || !payload.ok) {
          setMessage(payload.error?.message ?? "Canonicalization failed.");
          await loadStatus({ preserveMessage: true });
          return;
        }

        setCanonicalizationJustRan(true);
        setReviewAccepted((payload.confidence ?? 0) >= 0.85);
        setMessage(
          `Canonicalized ${payload.agentCount ?? 0} agents and ${payload.skillCount ?? 0} skills.`,
        );
        await loadStatus({ preserveMessage: true });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Canonicalization failed.");
      } finally {
        setIsCanonicalizing(false);
      }
    },
    [loadStatus, versionId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  const selectedTargetPlatform = targetPlatformFor(destination, customFormat);
  const vscodeInstallHref = useMemo(
    () =>
      buildInstallUri({
        versionId,
        destination,
        targetPlatform: selectedTargetPlatform,
        editorScheme: "vscode",
      }),
    [destination, selectedTargetPlatform, versionId],
  );
  const cursorInstallHref = useMemo(
    () =>
      buildInstallUri({
        versionId,
        destination,
        targetPlatform: selectedTargetPlatform,
        editorScheme: "cursor",
      }),
    [destination, selectedTargetPlatform, versionId],
  );
  const downloadHref = `/api/v1/versions/${versionId}/exports/download?targetPlatform=${selectedTargetPlatform}&ensureGenerated=true`;
  const needsReview =
    status?.canonicalizationStatus === "succeeded" &&
    status.canonicalizationResult &&
    status.canonicalizationResult.confidence < 0.85 &&
    canonicalizationJustRan &&
    !reviewAccepted;
  const awaitingCanonicalization = status?.canonicalizationStatus === "none" && !isCanonicalizing;
  const canStartCanonicalization =
    Boolean(status?.isPro) &&
    Boolean(status?.hasSourceFiles) &&
    awaitingCanonicalization;
  const readyForDestination =
    Boolean(status?.isPro) &&
    Boolean(status?.hasSourceFiles) &&
    status?.canonicalizationStatus === "succeeded" &&
    !needsReview &&
    !isCanonicalizing;
  const blockingCanonicalizationFailed =
    status?.canonicalizationStatus === "failed" && !status.canonicalizationResult;
  const showCanonicalizationRetryWarning =
    status?.canonicalizationStatus === "succeeded" &&
    Boolean(status.canonicalizationError) &&
    !isCanonicalizing;
  const canonicalizeStepState = readyForDestination
    ? "done"
    : isCanonicalizing || needsReview || awaitingCanonicalization
      ? "active"
      : "pending";

  async function startUpgrade() {
    if (!status?.organizationId) {
      return;
    }

    setIsUpgrading(true);

    if (status.billingProvider === "clerk") {
      setMessage("Opening billing...");
      window.location.href = "/billing?returnPath=/install";
      return;
    }

    setMessage("Opening checkout...");

    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: status.organizationId,
          plan: "pro",
          returnPath: "/install",
        }),
      });
      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Checkout is unavailable.");
        return;
      }

      if (payload.configured && payload.url) {
        window.location.href = payload.url;
        return;
      }

      window.location.href = "/billing?returnPath=/install&billing=unavailable";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout is unavailable.");
    } finally {
      setIsUpgrading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link className="text-sm font-medium text-stone-600 transition hover:text-stone-950" href="/upload">
        Back to Import
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <StepBadge label="Import" state="done" />
        <span className="text-stone-300">/</span>
        <StepBadge label="Canonicalize" state={canonicalizeStepState} />
        <span className="text-stone-300">/</span>
        <StepBadge label="Install" state={readyForDestination ? "active" : "pending"} />
      </div>

      <p className="tape-card border border-zinc-800 bg-[#111414] px-4 py-3 text-sm leading-6 text-zinc-300">{message}</p>

      {isLoadingStatus ? (
        <section className="tape-panel bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Install</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Loading install flow</h1>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full w-1/2 rounded-full bg-emerald-400" />
          </div>
        </section>
      ) : null}

      {status && !status.hasSourceFiles ? (
        <section className="tape-panel bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Import Required</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Import files before installing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            The install flow needs source files from your workspace before Kimi can canonicalize them.
          </p>
          <Link
            className="tape-button mt-6 inline-flex bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300"
            href="/upload"
          >
            Import Files
          </Link>
        </section>
      ) : null}

      {status && !status.isPro && upgradeDismissed ? (
        <section className="tape-panel border border-orange-400/30 bg-orange-400/10 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Pro Required</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Canonicalization and install are locked</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            Free accounts can keep importing, viewing, copying, and downloading source files.
          </p>
          <button
            className="tape-button mt-6 bg-white px-5 py-3 text-sm text-black disabled:opacity-60"
            disabled={isUpgrading}
            onClick={() => void startUpgrade()}
            type="button"
          >
            {isUpgrading ? "Opening..." : "Upgrade to Pro - $10/mo"}
          </button>
        </section>
      ) : null}

      {canStartCanonicalization ? (
        <section className="tape-panel bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Step 2 of 3</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Canonicalize your agents and skills</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            Kimi AI will analyze your source files and convert them into a portable canonical format.
          </p>
          <button
            className="tape-button mt-6 bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
            onClick={() => void runCanonicalization()}
            type="button"
          >
            Canonicalize with Kimi
          </button>
        </section>
      ) : null}

      {status?.isPro && status.hasSourceFiles && isCanonicalizing ? (
        <section className="tape-panel bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Step 2 of 3</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Canonicalizing with Kimi AI</h1>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Analyzing {status.sourceFileCount} source files. This usually takes under 30 seconds.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full w-2/3 rounded-full bg-emerald-400" />
          </div>
          <p className="mt-3 text-xs text-stone-500">Building portable agents, skills, and rules.</p>
        </section>
      ) : null}

      {status?.isPro && blockingCanonicalizationFailed && !isCanonicalizing ? (
        <section className="tape-panel border border-red-500/30 bg-red-950/30 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-red-700">Canonicalization Failed</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Kimi could not complete this run</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            {status.canonicalizationError ?? "Review your source files and try again."}
          </p>
          <button
            className="tape-button mt-6 bg-white px-5 py-3 text-sm text-black"
            onClick={() => void runCanonicalization(true)}
            type="button"
          >
            Retry canonicalization
          </button>
        </section>
      ) : null}

      {showCanonicalizationRetryWarning && status ? (
        <section className="tape-panel border border-orange-400/30 bg-orange-400/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-700">Canonicalization Warning</p>
              <p className="mt-2 text-sm font-medium text-stone-950">
                Last re-canonicalize attempt failed. Using previous successful result.
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-700">{status.canonicalizationError}</p>
            </div>
            <button
              className="tape-button shrink-0 bg-white px-5 py-3 text-sm text-black"
              onClick={() => void runCanonicalization(true)}
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      {needsReview && status?.canonicalizationResult ? (
        <section className="tape-panel border border-orange-400/30 bg-orange-400/10 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-700">Review Required</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Canonicalization needs confirmation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            Kimi returned a low-confidence result. Review the summary before continuing.
          </p>
          <div className="tape-card mt-5 border border-zinc-800 bg-[#111414] p-4">
            <p className="font-medium text-amber-900">
              Overall confidence: {formatConfidence(status.canonicalizationResult.confidence)}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-700">{status.canonicalizationResult.summary}</p>
            {status.canonicalizationResult.warnings.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm text-amber-900">
                {status.canonicalizationResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300"
              onClick={() => {
                setReviewAccepted(true);
                setCanonicalizationJustRan(false);
              }}
              type="button"
            >
              Accept all and continue
            </button>
            <button
              className="tape-button bg-white px-5 py-3 text-sm text-black"
              onClick={() => void runCanonicalization(true)}
              type="button"
            >
              Retry canonicalization
            </button>
          </div>
        </section>
      ) : null}

      {readyForDestination && status ? (
        <section className="tape-panel bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Step 3 of 3</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">Where do you want to install?</h1>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Using {status.canonicalizationResult?.itemCount ?? status.canonicalItemCount} canonical items from the latest successful canonicalization.
            <button
              className="ml-2 font-medium text-orange-700 underline decoration-orange-300 underline-offset-4"
              onClick={() => void runCanonicalization(true)}
              type="button"
            >
              Re-canonicalize
            </button>
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {destinations.map((item) => (
              <button
                key={item.id}
                className={`rounded-lg border p-4 text-left transition ${
                  destination === item.id
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-zinc-800 bg-zinc-950/70 hover:border-orange-400/60"
                }`}
                onClick={() => setDestination(item.id)}
                type="button"
              >
                <span className="font-semibold text-stone-950">{item.name}</span>
                <span className="mt-2 block font-mono text-xs leading-5 text-stone-600">{item.detail}</span>
              </button>
            ))}
          </div>

          {destination === "other" ? (
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="font-medium text-stone-950">Choose output format</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {targetFormats.map((format) => (
                  <button
                    key={format.id}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      customFormat === format.id
                        ? "bg-stone-950 text-white"
                        : "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100"
                    }`}
                    onClick={() => setCustomFormat(format.id)}
                    type="button"
                  >
                    {format.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/70 p-5">
            <p className="font-medium text-stone-950">
              Ready to install into {destination === "other" ? "a custom folder" : destinations.find((item) => item.id === destination)?.name}.
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {destination === "codex"
                ? "Confirm the write inside VS Code or Cursor. This writes directly to Codex's default home directory under ~/.codex, not to your repo or another folder. Xupra places AGENTS.md, skills, and agents there so Codex can pick them up from the standard location."
                : destination === "claude"
                  ? "Confirm the write inside VS Code or Cursor. This writes directly to Claude's default home directory under ~/.claude, not to your repo or another folder. Xupra places CLAUDE.md, agents, and skills there so they are available from the standard location."
                  : destination === "cursor"
                    ? "Confirm the write inside VS Code or Cursor. This writes directly to Cursor's default home directory under ~/.cursor, not to your repo or another folder. Xupra places rules and skills there at the standard location."
                    : destination === "all"
                      ? "Confirm the write inside VS Code or Cursor. This writes directly to the default home directories for every supported tool: ~/.codex, ~/.claude, and ~/.cursor. It does not install into your repo unless you explicitly choose Other / Custom path."
                      : "Confirm the write inside VS Code or Cursor. Choose Other only when you want an explicit custom folder instead of the default vendor directories, or download the generated files for any tool that is not listed."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                className="inline-flex justify-center rounded-full bg-stone-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-stone-800"
                href={vscodeInstallHref}
              >
                Open in VS Code
              </a>
              <a
                className="inline-flex justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-center text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                href={cursorInstallHref}
              >
                Open in Cursor
              </a>
              <a
                className="inline-flex justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-center text-sm font-medium text-stone-900 transition hover:bg-stone-100 sm:col-span-2"
                href={downloadHref}
              >
                Download files instead
              </a>
            </div>
          </div>

          <FallbackPanel downloadHref={downloadHref} />
        </section>
      ) : null}

      {status && status.hasSourceFiles && !status.isPro && !upgradeDismissed ? (
        <UpgradeModal
          isUpgrading={isUpgrading}
          onContinue={() => setUpgradeDismissed(true)}
          onUpgrade={() => void startUpgrade()}
        />
      ) : null}
    </div>
  );
}

function StepBadge({ label, state }: { label: string; state: "done" | "active" | "pending" }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] ${
        state === "done"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : state === "active"
            ? "border-orange-400/50 bg-orange-400/10 text-orange-200"
            : "border-stone-200 bg-white text-stone-500"
      }`}
    >
      {label}
    </span>
  );
}

function FallbackPanel({
  downloadHref,
}: {
  downloadHref: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-5">
      <p className="font-medium text-stone-950">Open VS Code or Cursor to install</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        Open VS Code or Cursor with the Xupra extension installed and signed in, then return here to install.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
          href="/extensions/connect"
        >
          Connect Extension
        </Link>
        <a
          className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href={downloadHref}
        >
          Download files instead
        </a>
      </div>
    </div>
  );
}

function UpgradeModal({
  isUpgrading,
  onContinue,
  onUpgrade,
}: {
  isUpgrading: boolean;
  onContinue: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Pro Required</p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-950">
          Unlock canonicalization and install
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          Free accounts can import and view source files. Pro unlocks AI canonicalization and one-click install into your editor.
        </p>
        <div className="mt-5 grid gap-3 text-sm text-stone-800">
          <p>AI canonicalization with Kimi converts agents and skills into a portable format.</p>
          <p>One-click install can write Codex, Claude, and Cursor files together through the extension.</p>
          <p>For other tools, choose a target format and download the generated files for manual placement.</p>
        </div>
        <button
          className="mt-6 w-full rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:bg-orange-300"
          disabled={isUpgrading}
          onClick={onUpgrade}
          type="button"
        >
          {isUpgrading ? "Opening checkout..." : "Upgrade to Pro - $10/mo"}
        </button>
        <button
          className="mt-3 w-full text-center text-sm font-medium text-stone-500 underline decoration-stone-300 underline-offset-4"
          onClick={onContinue}
          type="button"
        >
          Continue with free
        </button>
      </section>
    </div>
  );
}
