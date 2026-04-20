"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString();
}

export function VersionTools({ versionId, deploymentTargets }: VersionToolsProps) {
  const router = useRouter();
  const [targetPlatform, setTargetPlatform] = useState<(typeof TARGETS)[number]["value"]>("claude_code");
  const [deploymentTargetId, setDeploymentTargetId] = useState<string>(deploymentTargets[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState("No job has been run yet.");
  const [latestPreview, setLatestPreview] = useState<Array<{ logicalPath: string; preview: string }>>([]);
  const [importedFiles, setImportedFiles] = useState<ImportedFileRecord[]>([]);
  const [importedFilesSource, setImportedFilesSource] = useState("postgres_package_file");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

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
        return;
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
          `Imported ${payload.imported.rawFiles} files, ${payload.imported.subagents} subagents, ${payload.imported.skills} skills, ${payload.imported.rules} rules.`,
        );
        await loadImportedFiles();
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
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsBusy(true);

    try {
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
      const uploadedNames = uploadedFiles.slice(0, 3).map((file) => file.logicalPath);
      const uploadedSuffix = uploadedFiles.length > uploadedNames.length ? ", ..." : "";
      const uploadedNameList = uploadedNames.length > 0 ? ` (${uploadedNames.join(", ")}${uploadedSuffix})` : "";

      setStatusMessage(`Uploaded ${uploadedFiles.length} file(s)${uploadedNameList}.`);
      form.reset();
      await loadImportedFiles();
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
            Import, Compatibility, and Export
          </h2>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Upload source files, normalize them into the canonical package, then run target-specific compatibility and export preview jobs.
          </p>
        </div>
        <p className="max-w-sm rounded-2xl bg-stone-100 px-4 py-3 font-mono text-xs leading-6 text-stone-700">
          {statusMessage}
        </p>
      </div>

      <form className="grid gap-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5" onSubmit={handleUpload}>
        <label className="text-sm font-medium text-stone-900" htmlFor="version-upload">
          Upload raw package files
        </label>
        <input
          id="version-upload"
          name="files"
          multiple
          type="file"
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
        />
        <button
          className="w-fit rounded-full bg-orange-600 px-5 py-3 font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
          disabled={isBusy}
          type="submit"
        >
          {isBusy ? "Working..." : "Upload Files"}
        </button>
      </form>

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
          onClick={() => runJsonPost(`/api/v1/versions/${versionId}/import`, { mode: "auto" })}
          type="button"
        >
          Import Files
        </button>
        <button
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() =>
            runJsonPost(`/api/v1/versions/${versionId}/compatibility`, {
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
            runJsonPost(`/api/v1/versions/${versionId}/export-preview`, {
              targetPlatform,
            })
          }
          type="button"
        >
          Export Preview
        </button>
      </div>

      <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700">
        Compatibility checks tell you whether the current version has enough instructions, skills,
        rules, or subagents for the selected target. They do not change files, export artifacts, or
        deploy anything.
      </div>

      <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700">
        Upload, import, and compatibility checks stay available on free. Export preview and deploy
        unlock on paid plans.
      </div>

      <section className="space-y-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
            Imported Source Files
          </h3>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || isLoadingFiles}
            onClick={() => void loadImportedFiles()}
            type="button"
          >
            {isLoadingFiles ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="text-sm leading-7 text-stone-700">
          These records are read from Postgres table <span className="font-mono text-xs">PackageFile</span>.
          Preview text is loaded via each row&apos;s <span className="font-mono text-xs">storageKey</span> from artifact storage.
        </p>
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
            No raw source files are currently loaded in this panel. Click Refresh to read existing
            Postgres records, or upload files first and then run import.
          </div>
        )}
      </section>

      <div className="grid gap-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5">
        <div>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
            Deploy Version
          </h3>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Run a deployment job against a configured target. Local repository path mirroring works now; remote automation will attach to the same target records.
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
              runJsonPost(`/api/v1/versions/${versionId}/deploy`, {
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

      {latestPreview.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
            Latest generated files
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
