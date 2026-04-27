"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { normalizeImportLogicalPath } from "@/lib/utils/import-paths";

const TARGETS = [
  { value: "codex", label: "Codex" },
  { value: "claude_code", label: "Claude Code" },
  { value: "claude_agents", label: "Claude Agents" },
  { value: "cursor", label: "Cursor" },
] as const;

type VersionToolsProps = {
  versionId: string;
  deploymentTargets: Array<{
    id: string;
    name: string;
    platform: string;
    deliveryMode: string;
  }>;
  currentSummary: {
    rawFiles: number;
    subagents: number;
    skillRules: number;
    transformJobs: number;
    lastImportedAt: string | null;
  };
};

type JobResponse = {
  ok: boolean;
  job?: {
    id: string;
    status: string;
    targetPlatform?: string;
  };
  result?: {
    status?: string;
    warnings?: string[];
    unsupported?: string[];
  };
  generatedFiles?: Array<{
    logicalPath: string;
    preview: string;
  }>;
  imported?: {
    rawFiles: number;
    subagents: number;
    skills: number;
    rules: number;
    updatedInstructions: boolean;
  };
  warnings?: string[];
  error?: {
    message: string;
  };
};

type ImportedFileRecord = {
  dbId: string;
  logicalPath: string;
  kind: string;
  sourceFormat: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  createdAt: string;
  previewText: string | null;
  previewTruncated: boolean;
  previewError: string | null;
};

type FileListResponse = {
  ok: boolean;
  source?: string;
  files?: ImportedFileRecord[];
  error?: {
    message?: string;
  };
};

type PendingBrowserFile = {
  file: File;
  logicalPath: string;
  category: "instruction" | "subagent" | "skill" | "rule" | "source";
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "Never";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString();
}

function normalizeLogicalPath(rawValue: string) {
  return normalizeImportLogicalPath(rawValue);
}

function isIgnoredPath(logicalPath: string) {
  return /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage)(\/|$)/i.test(logicalPath);
}

function classifySupportedPath(logicalPath: string): PendingBrowserFile["category"] | null {
  const normalized = normalizeLogicalPath(logicalPath);

  if (!normalized || isIgnoredPath(normalized)) {
    return null;
  }

  if (normalized === "AGENTS.md" || normalized === "CLAUDE.md") {
    return "instruction";
  }

  if (/^\.claude\/agents\/.+\.md$/i.test(normalized)) {
    return "subagent";
  }

  if (/^\.codex\/agents\/.+\.toml$/i.test(normalized)) {
    return "subagent";
  }

  if (/^(\.agents\/skills|\.claude\/skills|\.cursor\/skills)\/.+\/SKILL\.md$/i.test(normalized)) {
    return "skill";
  }

  if (/^\.cursor\/rules\/.+\.mdc$/i.test(normalized)) {
    return "rule";
  }

  if (/\.md$/i.test(normalized) || /\.py$/i.test(normalized)) {
    return "source";
  }

  return null;
}

function toPendingBrowserFiles(fileList: FileList | File[] | null) {
  if (!fileList) {
    return [];
  }

  return Array.from(fileList)
    .map((file) => {
      const logicalPath = normalizeLogicalPath(file.webkitRelativePath || file.name);
      const category = classifySupportedPath(logicalPath);

      if (!category) {
        return null;
      }

      return {
        file,
        logicalPath,
        category,
      } satisfies PendingBrowserFile;
    })
    .filter((file): file is PendingBrowserFile => Boolean(file));
}

function describePendingFiles(files: PendingBrowserFile[]) {
  const counts = {
    instruction: 0,
    subagent: 0,
    skill: 0,
    rule: 0,
    source: 0,
  };

  for (const file of files) {
    counts[file.category] += 1;
  }

  return [
    `${files.length} matched file${files.length === 1 ? "" : "s"}`,
    counts.instruction ? `${counts.instruction} instructions` : null,
    counts.subagent ? `${counts.subagent} agents` : null,
    counts.skill ? `${counts.skill} skills` : null,
    counts.rule ? `${counts.rule} rules` : null,
    counts.source ? `${counts.source} markdown/python` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function VersionTools({ versionId, deploymentTargets, currentSummary }: VersionToolsProps) {
  const router = useRouter();
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const [targetPlatform, setTargetPlatform] = useState<(typeof TARGETS)[number]["value"]>("claude_code");
  const [deploymentTargetId, setDeploymentTargetId] = useState<string>(deploymentTargets[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState(
    currentSummary.rawFiles > 0
      ? `This version already has ${currentSummary.rawFiles} raw files in storage.`
      : "Choose a repo folder or selected files, then upload and import them here.",
  );
  const [latestPreview, setLatestPreview] = useState<Array<{ logicalPath: string; preview: string }>>([]);
  const [importedFiles, setImportedFiles] = useState<ImportedFileRecord[]>([]);
  const [importedFilesSource, setImportedFilesSource] = useState("postgres_package_file");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingFolderFiles, setPendingFolderFiles] = useState<PendingBrowserFile[]>([]);
  const [pendingManualFiles, setPendingManualFiles] = useState<PendingBrowserFile[]>([]);

  const loadImportedFiles = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoadingFiles(true);
      }

      try {
        const response = await fetch(
          `/api/v1/versions/${versionId}/files?kind=raw_source&preview=1&limit=30`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as FileListResponse;

        if (!response.ok || !payload.ok) {
          if (!options?.silent) {
            setStatusMessage(payload.error?.message ?? "Failed to load imported files.");
          }
          return;
        }

        setImportedFiles(payload.files ?? []);
        setImportedFilesSource(payload.source ?? "postgres_package_file");
      } catch (error) {
        if (!options?.silent) {
          setStatusMessage(error instanceof Error ? error.message : "Failed to load imported files.");
        }
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [versionId],
  );

  useEffect(() => {
    if (!directoryInputRef.current) {
      return;
    }

    directoryInputRef.current.setAttribute("webkitdirectory", "");
    directoryInputRef.current.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadImportedFiles({ silent: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadImportedFiles]);

  const folderSummary = useMemo(() => describePendingFiles(pendingFolderFiles), [pendingFolderFiles]);
  const manualSummary = useMemo(() => describePendingFiles(pendingManualFiles), [pendingManualFiles]);

  async function runJsonPost(url: string, body?: Record<string, unknown>) {
    setIsBusy(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = (await response.json()) as JobResponse;

      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error?.message ?? "Request failed.");
        return false;
      }

      if (payload.generatedFiles) {
        setLatestPreview(payload.generatedFiles);
      }

      if (payload.result?.status) {
        const detailParts: string[] = [];

        if (payload.result.unsupported?.length) {
          detailParts.push(`blocked: ${payload.result.unsupported.join("; ")}`);
        }

        if (payload.result.warnings?.length) {
          detailParts.push(`warnings: ${payload.result.warnings.join("; ")}`);
        }

        setStatusMessage(
          `Compatibility: ${payload.result.status}${detailParts.length ? ` | ${detailParts.join(" | ")}` : ""}`,
        );
      } else if (payload.imported) {
        setStatusMessage(
          `Imported ${payload.imported.rawFiles} files, ${payload.imported.subagents} agents, ${payload.imported.skills} skills, ${payload.imported.rules} rules.`,
        );
        await loadImportedFiles({ silent: true });
      } else if (payload.job) {
        setStatusMessage(
          payload.job.status === "queued" || payload.job.status === "running"
            ? `Job ${payload.job.id} is ${payload.job.status}.`
            : `Job ${payload.job.id} finished with status ${payload.job.status}.`,
        );
      } else {
        setStatusMessage("Request completed.");
      }

      router.refresh();
      return true;
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadPendingFiles(files: PendingBrowserFile[], options?: { autoImport?: boolean }) {
    if (files.length === 0) {
      setStatusMessage("Choose a repo folder or selected files first.");
      return;
    }

    setIsBusy(true);

    try {
      const formData = new FormData();

      for (const item of files) {
        formData.append("paths", item.logicalPath);
        formData.append("files", item.file, item.file.name);
      }

      const response = await fetch(`/api/v1/versions/${versionId}/files`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as JobResponse & {
        files?: Array<{ logicalPath: string }>;
      };

      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error?.message ?? "Upload failed.");
        return;
      }

      const uploadedFiles = payload.files ?? [];
      const uploadedPreview = uploadedFiles
        .slice(0, 4)
        .map((file) => file.logicalPath)
        .join(", ");

      setStatusMessage(
        `Uploaded ${uploadedFiles.length} file(s)${uploadedPreview ? `: ${uploadedPreview}${uploadedFiles.length > 4 ? ", ..." : ""}` : ""}`,
      );

      if (options?.autoImport) {
        const importResponse = await fetch(`/api/v1/versions/${versionId}/import`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode: "auto" }),
        });
        const importPayload = (await importResponse.json()) as JobResponse;

        if (!importResponse.ok || !importPayload.ok) {
          setStatusMessage(importPayload.error?.message ?? "Upload succeeded, but import failed.");
          return;
        }

        if (importPayload.imported) {
          setStatusMessage(
            `Imported ${importPayload.imported.rawFiles} files, ${importPayload.imported.subagents} agents, ${importPayload.imported.skills} skills, ${importPayload.imported.rules} rules.`,
          );
        } else if (importPayload.job) {
          setStatusMessage(`Upload finished. Import job ${importPayload.job.id} is ${importPayload.job.status}.`);
        } else {
          setStatusMessage("Upload finished and import started.");
        }
      }

      setPendingFolderFiles([]);
      setPendingManualFiles([]);

      if (manualInputRef.current) {
        manualInputRef.current.value = "";
      }

      if (directoryInputRef.current) {
        directoryInputRef.current.value = "";
      }

      await loadImportedFiles({ silent: true });
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div id="version-upload" className="space-y-5 rounded-[1.25rem] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
            Upload Files
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-700">
            Choose a repo folder or selected files. Xupra uploads them and imports supported skills,
            agents, rules, and instruction files.
          </p>
        </div>
        <p className="max-w-sm rounded-2xl bg-stone-100 px-4 py-3 font-mono text-xs leading-6 text-stone-700">
          {statusMessage}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Raw Files</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">{currentSummary.rawFiles}</p>
        </article>
        <article className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Agents</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">{currentSummary.subagents}</p>
        </article>
        <article className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Skills/Rules</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">{currentSummary.skillRules}</p>
        </article>
        <article className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Last Import</p>
          <p className="mt-3 text-base font-semibold text-stone-950">{formatTimestamp(currentSummary.lastImportedAt)}</p>
        </article>
      </div>

      <section className="grid gap-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
            Upload a repo folder
          </h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            This keeps supported files and imports them immediately.
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-emerald-200 bg-white p-4">
          <input
            ref={directoryInputRef}
            className="hidden"
            multiple
            type="file"
            onChange={(event) => setPendingFolderFiles(toPendingBrowserFiles(event.target.files))}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full border border-emerald-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              onClick={() => directoryInputRef.current?.click()}
              type="button"
            >
              Choose Repo Folder
            </button>
            <button
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={isBusy || pendingFolderFiles.length === 0}
              onClick={() => void uploadPendingFiles(pendingFolderFiles, { autoImport: true })}
              type="button"
            >
              {isBusy ? "Working..." : "Upload Folder And Import"}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {pendingFolderFiles.length > 0 ? folderSummary : "No repo folder selected yet."}
          </div>
          {pendingFolderFiles.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {pendingFolderFiles.slice(0, 8).map((file) => (
                <div key={file.logicalPath} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                  <span className="font-mono text-stone-900">{file.logicalPath}</span>
                  <span className="ml-2 text-stone-500">({file.category})</span>
                </div>
              ))}
              {pendingFolderFiles.length > 8 ? (
                <p className="text-xs text-stone-500">+ {pendingFolderFiles.length - 8} more supported files queued</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-medium text-stone-900">
          Or upload selected files
          <input
            ref={manualInputRef}
            multiple
            type="file"
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
            onChange={(event) => setPendingManualFiles(toPendingBrowserFiles(event.target.files))}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || pendingManualFiles.length === 0}
            onClick={() => void uploadPendingFiles(pendingManualFiles)}
            type="button"
          >
            Upload Selected Files
          </button>
          <button
            className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
            disabled={isBusy || pendingManualFiles.length === 0}
            onClick={() => void uploadPendingFiles(pendingManualFiles, { autoImport: true })}
            type="button"
          >
            Upload And Import
          </button>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 lg:col-span-2">
          {pendingManualFiles.length > 0 ? manualSummary : "Choose files if you do not want to upload the full repo folder."}
        </div>
      </section>

      {currentSummary.rawFiles > 0 ? (
        <>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium text-stone-900">
          Target platform
          <select
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800"
            onChange={(event) => setTargetPlatform(event.target.value as (typeof TARGETS)[number]["value"])}
            value={targetPlatform}
          >
            {TARGETS.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => void runJsonPost(`/api/v1/versions/${versionId}/import`, { mode: "auto" })}
          type="button"
        >
          Import Existing Raw Files
        </button>
        <button
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() =>
            void runJsonPost(`/api/v1/versions/${versionId}/compatibility`, {
              targetPlatform,
            })
          }
          type="button"
        >
          Check Compatibility
        </button>
        <button
          className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={isBusy}
          onClick={() =>
            void runJsonPost(`/api/v1/versions/${versionId}/export-preview`, {
              targetPlatform,
            })
          }
          type="button"
        >
          Export Preview
        </button>
      </div>

      <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700">
        Compatibility checks only tell you whether the canonical package is ready for a target.
        They do not upload source files, export artifacts, or deploy anything.
      </div>
        </>
      ) : null}

      <section className="space-y-4 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
              Imported Source Files
            </h3>
          </div>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || isLoadingFiles}
            onClick={() => void loadImportedFiles()}
            type="button"
          >
            {isLoadingFiles ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="text-xs leading-6 text-stone-500">
          Source: <span className="font-mono">{importedFilesSource}</span>
        </p>
        {importedFiles.length > 0 ? (
          <div className="grid gap-3">
            {importedFiles.map((file) => (
              <article key={file.dbId} className="overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white">
                <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
                    {file.logicalPath}
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    dbId {file.dbId} · {file.sourceFormat} · {formatBytes(file.sizeBytes)} · uploaded{" "}
                    {formatTimestamp(file.createdAt)} · checksum {file.checksumSha256.slice(0, 12)}
                  </p>
                </div>
                {file.previewText ? (
                  <pre className="max-h-56 overflow-auto bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                    {file.previewText}
                    {file.previewTruncated ? "\n\n[preview truncated]" : ""}
                  </pre>
                ) : (
                  <div className="px-4 py-4 text-xs leading-6 text-stone-600">
                    {file.previewError
                      ? `Preview unavailable: ${file.previewError}`
                      : "No text preview available for this file type."}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            No raw source files are loaded for this version yet. Upload a repo folder or selected
            files above, then this panel should populate automatically.
          </div>
        )}
      </section>

      {currentSummary.rawFiles > 0 && deploymentTargets.length > 0 ? (
      <div className="grid gap-4 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-5">
        <div>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
            Deploy Version
          </h3>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Run a deployment job against a configured target after import and compatibility are in shape.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-stone-900">
            Deployment target
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800"
              onChange={(event) => setDeploymentTargetId(event.target.value)}
              value={deploymentTargetId}
            >
              <option value="">Select a target</option>
              {deploymentTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} ({target.platform} · {target.deliveryMode})
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
            disabled={isBusy || !deploymentTargetId}
            onClick={() =>
              void runJsonPost(`/api/v1/versions/${versionId}/deploy`, {
                deploymentTargetId,
                triggerSource: "ui",
              })
            }
            type="button"
          >
            Deploy
          </button>
        </div>
      </div>
      ) : null}

      {latestPreview.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
            Latest Generated Files
          </h3>
          <div className="grid gap-4">
            {latestPreview.map((file) => (
              <article key={file.logicalPath} className="overflow-hidden rounded-[1.5rem] border border-stone-200">
                <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  {file.logicalPath}
                </div>
                <pre className="overflow-x-auto bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                  {file.preview}
                </pre>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
