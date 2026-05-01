"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { normalizeImportLogicalPath } from "@/lib/utils/import-paths";

type TabId = "source" | "library" | "history";

type VersionToolsProps = {
  versionId: string;
  currentSummary: {
    rawFiles: number;
    importedItems: number;
    canonicalItems: number;
    lastImportAt: string | null;
  };
  importedItems: Array<{
    id: string;
    name: string;
    kind: "agent" | "skill" | "rule" | "instruction" | "prompt_fragment";
    sourcePath: string | null;
    sourcePlatform: string;
    description: string;
    body: string;
    canonicalized: boolean;
  }>;
  historyEvents: Array<{
    id: string;
    label: string;
    detail: string;
    status: string;
    createdAt: string;
    technicalDetails?: unknown;
  }>;
};

type JobResponse = {
  ok: boolean;
  imported?: {
    rawFiles: number;
    subagents: number;
    skills: number;
    rules: number;
  };
  job?: {
    id: string;
    status: string;
  };
  error?: {
    message: string;
  };
};

type SourceFileRecord = {
  dbId: string;
  logicalPath: string;
  kind: string;
  sourceFormat: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  previewText: string | null;
  previewTruncated: boolean;
  previewError: string | null;
};

type FileListResponse = {
  ok: boolean;
  files?: SourceFileRecord[];
  error?: {
    message?: string;
  };
};

type PendingBrowserFile = {
  file: File;
  logicalPath: string;
  category: "instruction" | "agent" | "skill" | "rule" | "source";
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
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function likelyPlatform(logicalPath: string) {
  const normalized = logicalPath.toLowerCase();

  if (normalized.includes(".claude/")) {
    return "Claude";
  }

  if (normalized.includes(".codex/") || normalized.includes(".agents/skills/")) {
    return "Codex";
  }

  if (normalized.includes(".cursor/")) {
    return "Cursor";
  }

  if (normalized.endsWith("agents.md")) {
    return "AGENTS.md";
  }

  return "Unknown";
}

function likelyKind(logicalPath: string) {
  const normalized = logicalPath.toLowerCase();

  if (normalized.includes("/agents/") || normalized.endsWith("agents.md")) {
    return "agent";
  }

  if (normalized.endsWith("/skill.md")) {
    return "skill";
  }

  if (normalized.includes("/rules/") || normalized.endsWith(".mdc")) {
    return "rule";
  }

  if (normalized.endsWith("claude.md")) {
    return "instruction";
  }

  return "source";
}

function isSystemDefault(logicalPath: string) {
  return /(^|\/)\.system(\/|$)/i.test(logicalPath);
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

  if (/^(\.claude|\.codex)\/agents\/.+\.(md|toml)$/i.test(normalized)) {
    return "agent";
  }

  if (/^(\.agents\/skills|\.codex\/skills|\.claude\/skills|\.cursor\/skills)\/.+\/SKILL\.md$/i.test(normalized)) {
    return "skill";
  }

  if (/^\.cursor\/rules\/.+\.mdc$/i.test(normalized)) {
    return "rule";
  }

  if (/\.(md|py|txt|json|yaml|yml|toml)$/i.test(normalized)) {
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

      return { file, logicalPath, category } satisfies PendingBrowserFile;
    })
    .filter((file): file is PendingBrowserFile => Boolean(file));
}

function describePendingFiles(files: PendingBrowserFile[]) {
  const counts = {
    instruction: 0,
    agent: 0,
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
    counts.agent ? `${counts.agent} agents` : null,
    counts.skill ? `${counts.skill} skills` : null,
    counts.rule ? `${counts.rule} rules` : null,
    counts.source ? `${counts.source} source files` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function sourceFileUrl(versionId: string, fileId: string, mode: "content" | "download") {
  const params = new URLSearchParams({
    fileId,
    mode,
  });

  return `/api/v1/versions/${versionId}/files?${params.toString()}`;
}

export function VersionTools({
  versionId,
  currentSummary,
  importedItems,
  historyEvents,
}: VersionToolsProps) {
  const router = useRouter();
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("source");
  const [sourceFiles, setSourceFiles] = useState<SourceFileRecord[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedImportedItemId, setSelectedImportedItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    currentSummary.rawFiles > 0
      ? `${currentSummary.rawFiles} source files are stored in this library.`
      : "Import files or a folder to build your source library.",
  );
  const [sourceTextById, setSourceTextById] = useState<Record<string, string>>({});
  const [sourceTextLoadingId, setSourceTextLoadingId] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [busyAction, setBusyAction] = useState<"upload" | null>(null);
  const [pendingFolderFiles, setPendingFolderFiles] = useState<PendingBrowserFile[]>([]);
  const [pendingManualFiles, setPendingManualFiles] = useState<PendingBrowserFile[]>([]);

  const selectedSource = sourceFiles.find((file) => file.dbId === selectedSourceId) ?? sourceFiles[0] ?? null;
  const selectedImportedItem =
    importedItems.find((item) => item.id === selectedImportedItemId) ?? importedItems[0] ?? null;

  const loadSourceFiles = useCallback(async () => {
    setIsLoadingFiles(true);

    try {
      const response = await fetch(`/api/v1/versions/${versionId}/files?kind=raw_source&preview=1&limit=100`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as FileListResponse;

      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error?.message ?? "Failed to load source files.");
        return;
      }

      const files = payload.files ?? [];
      setSourceFiles(files);
      setSelectedSourceId((current) => current ?? files[0]?.dbId ?? null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load source files.");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [versionId]);

  useEffect(() => {
    if (!directoryInputRef.current) {
      return;
    }

    directoryInputRef.current.setAttribute("webkitdirectory", "");
    directoryInputRef.current.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSourceFiles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSourceFiles]);

  const folderSummary = useMemo(() => describePendingFiles(pendingFolderFiles), [pendingFolderFiles]);
  const manualSummary = useMemo(() => describePendingFiles(pendingManualFiles), [pendingManualFiles]);

  async function uploadPendingFiles(files: PendingBrowserFile[]) {
    if (files.length === 0) {
      setStatusMessage("No supported source files were found.");
      return;
    }

    setBusyAction("upload");

    try {
      const formData = new FormData();

      for (const item of files) {
        formData.append("paths", item.logicalPath);
        formData.append("files", item.file, item.file.name);
      }

      const uploadResponse = await fetch(`/api/v1/versions/${versionId}/files`, {
        method: "POST",
        body: formData,
      });
      const uploadPayload = (await uploadResponse.json()) as JobResponse & {
        files?: Array<{ logicalPath: string }>;
      };

      if (!uploadResponse.ok || !uploadPayload.ok) {
        setStatusMessage(uploadPayload.error?.message ?? "Upload failed.");
        return;
      }

      const importResponse = await fetch(`/api/v1/versions/${versionId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      });
      const importPayload = (await importResponse.json()) as JobResponse;

      if (!importResponse.ok || !importPayload.ok) {
        setStatusMessage(importPayload.error?.message ?? "Upload succeeded, but import parsing failed.");
        return;
      }

      const imported = importPayload.imported;
      setStatusMessage(
        imported
          ? `Uploaded ${uploadPayload.files?.length ?? files.length} source files. Parsed ${imported.subagents} agents, ${imported.skills} skills, and ${imported.rules} rules.`
          : `Uploaded ${uploadPayload.files?.length ?? files.length} source files.`,
      );
      setPendingFolderFiles([]);
      setPendingManualFiles([]);

      if (manualInputRef.current) {
        manualInputRef.current.value = "";
      }

      if (directoryInputRef.current) {
        directoryInputRef.current.value = "";
      }

      await loadSourceFiles();
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  function importFolderFiles(fileList: FileList | null) {
    const files = toPendingBrowserFiles(fileList);
    setPendingFolderFiles(files);
    setStatusMessage(files.length > 0 ? `${describePendingFiles(files)} found. Uploading...` : "No supported source files were found in that folder.");
    void uploadPendingFiles(files);
  }

  function importSelectedFiles(fileList: FileList | null) {
    const files = toPendingBrowserFiles(fileList);
    setPendingManualFiles(files);
    setStatusMessage(files.length > 0 ? `${describePendingFiles(files)} found. Uploading...` : "No supported source files were found in those files.");
    void uploadPendingFiles(files);
  }

  async function fetchSourceText(fileId: string) {
    const response = await fetch(sourceFileUrl(versionId, fileId, "content"), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to read source file.");
    }

    return response.text();
  }

  async function viewSource(file: SourceFileRecord) {
    setSelectedSourceId(file.dbId);

    if (sourceTextById[file.dbId]) {
      return;
    }

    setSourceTextLoadingId(file.dbId);

    try {
      const text = await fetchSourceText(file.dbId);
      setSourceTextById((current) => ({ ...current, [file.dbId]: text }));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to read source file.");
    } finally {
      setSourceTextLoadingId((current) => (current === file.dbId ? null : current));
    }
  }

  async function copySource(file: SourceFileRecord) {
    const text = await fetchSourceText(file.dbId);
    setSourceTextById((current) => ({ ...current, [file.dbId]: text }));
    await navigator.clipboard.writeText(text);
    setStatusMessage(`Copied ${file.logicalPath}.`);
  }

  async function downloadSource(file: SourceFileRecord) {
    const text = await fetchSourceText(file.dbId);
    const blob = new Blob([text], { type: file.mimeType || "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.logicalPath.split("/").pop() || "source-file.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(`Downloaded ${file.logicalPath}.`);
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "source", label: "Source Files" },
    { id: "library", label: "Canonical Library" },
    { id: "history", label: "History" },
  ];

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Skills & Agents
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-700">
              Import, view, copy, and organize your AI coding agents and skills before install.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:bg-stone-400"
              disabled={busyAction === "upload"}
              onClick={() => directoryInputRef.current?.click()}
              type="button"
            >
              {busyAction === "upload" ? "Importing..." : "Import Files"}
            </button>
            <button
              className="rounded-full border border-orange-500 bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
              onClick={() => router.push("/install")}
              type="button"
            >
              Install -&gt;
            </button>
          </div>
        </div>

        <input
          ref={directoryInputRef}
          className="hidden"
          multiple
          type="file"
          onChange={(event) => importFolderFiles(event.target.files)}
        />
        <input
          ref={manualInputRef}
          className="hidden"
          multiple
          type="file"
          onChange={(event) => importSelectedFiles(event.target.files)}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="font-mono text-xs uppercase text-stone-500">Raw Files</p>
            <p className="mt-2 text-2xl font-semibold text-stone-950">{currentSummary.rawFiles}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="font-mono text-xs uppercase text-stone-500">Imported Items</p>
            <p className="mt-2 text-2xl font-semibold text-stone-950">{currentSummary.importedItems}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="font-mono text-xs uppercase text-stone-500">Canonical Items</p>
            <p className="mt-2 text-2xl font-semibold text-stone-950">{currentSummary.canonicalItems}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="font-mono text-xs uppercase text-stone-500">Last Import</p>
            <p className="mt-2 text-sm font-semibold text-stone-950">{formatTimestamp(currentSummary.lastImportAt)}</p>
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-700">{statusMessage}</p>
      </div>

      <div className="border-b border-stone-200 px-5">
        <div className="flex flex-wrap gap-2 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-stone-950 text-white"
                  : "border border-stone-300 text-stone-800 hover:bg-stone-100"
              }`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {activeTab === "source" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-stone-950">Source Files</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-700">
                    Free users can store, view, copy, and download uploaded source files.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                    disabled={busyAction === "upload"}
                    onClick={() => manualInputRef.current?.click()}
                    type="button"
                  >
                    Choose Files
                  </button>
                  <button
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:opacity-60"
                    disabled={isLoadingFiles}
                    onClick={() => void loadSourceFiles()}
                    type="button"
                  >
                    {isLoadingFiles ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>

              {pendingFolderFiles.length > 0 || pendingManualFiles.length > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-stone-700">
                  {pendingFolderFiles.length > 0 ? folderSummary : manualSummary}
                </div>
              ) : null}

              <div className="grid gap-3">
                {sourceFiles.map((file) => (
                  <article
                    key={file.dbId}
                    className={`rounded-lg border bg-white p-4 transition ${
                      selectedSource?.dbId === file.dbId ? "border-orange-300 shadow-sm" : "border-stone-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <button className="min-w-0 text-left" onClick={() => void viewSource(file)} type="button">
                        <p className="break-all font-mono text-sm font-semibold text-stone-950">{file.logicalPath}</p>
                        <p className="mt-1 text-xs text-stone-600">
                          {file.sourceFormat || "text"} · {formatBytes(file.sizeBytes)} · uploaded {formatTimestamp(file.createdAt)}
                        </p>
                        <p className="mt-2 text-xs text-stone-600">
                          Likely source: {likelyPlatform(file.logicalPath)} · {likelyKind(file.logicalPath)}
                          {isSystemDefault(file.logicalPath) ? " · System/default" : ""}
                        </p>
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-800" onClick={() => void viewSource(file)} type="button">
                          View
                        </button>
                        <button className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-800" onClick={() => void copySource(file)} type="button">
                          Copy
                        </button>
                        <button className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-800" onClick={() => void downloadSource(file)} type="button">
                          Download
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {sourceFiles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
                    No source files are loaded yet. Import a folder or selected files to begin.
                  </div>
                ) : null}
              </div>
            </div>

            <PreviewPanel
              file={selectedSource}
              fullText={selectedSource ? sourceTextById[selectedSource.dbId] ?? null : null}
              isLoading={selectedSource ? sourceTextLoadingId === selectedSource.dbId : false}
            />
          </div>
        ) : null}

        {activeTab === "library" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-stone-950">Canonical Library</h3>
                <p className="mt-1 text-sm leading-6 text-stone-700">
                  Parsed imports are listed here. Canonicalized items are marked after the install flow runs Kimi.
                </p>
              </div>

              <div className="grid gap-3">
                {importedItems.map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedImportedItem?.id === item.id ? "border-orange-300 shadow-sm" : "border-stone-200"
                    }`}
                    onClick={() => setSelectedImportedItemId(item.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-stone-950">{item.name}</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        item.canonicalized
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-700"
                      }`}>
                        {item.canonicalized ? "Canonicalized" : "Parsed import"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-700">{item.kind} · Source: {item.sourcePlatform}</p>
                    <p className="mt-2 text-xs leading-5 text-stone-600">
                      {item.canonicalized
                        ? "Ready for target-specific install."
                        : "Parsed from source. Canonicalization runs from Install."}
                    </p>
                    {item.sourcePath ? <p className="mt-1 break-all font-mono text-xs text-stone-500">From: {item.sourcePath}</p> : null}
                  </button>
                ))}
                {importedItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
                    No imported items have been parsed yet. Import source files first.
                  </div>
                ) : null}
              </div>
            </div>

            <ImportedItemPreview item={selectedImportedItem} />
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-stone-950">History</h3>
            <div className="grid gap-3">
              {historyEvents.map((event) => (
                <article key={event.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-stone-950">{event.label}</h4>
                      <p className="mt-1 text-sm text-stone-700">{event.detail}</p>
                    </div>
                    <p className="text-xs text-stone-500">{formatTimestamp(event.createdAt)}</p>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-stone-600">Show technical details</summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-stone-950 p-3 font-mono text-xs leading-5 text-stone-100">
                      {JSON.stringify(event.technicalDetails ?? {}, null, 2)}
                    </pre>
                  </details>
                </article>
              ))}
              {historyEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
                  Upload, canonicalization, target generation, and install events will appear here.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PreviewPanel({
  file,
  fullText,
  isLoading,
}: {
  file: SourceFileRecord | null;
  fullText: string | null;
  isLoading: boolean;
}) {
  const [viewMode, setViewMode] = useState<"readable" | "raw" | "metadata">("readable");

  if (!file) {
    return (
      <aside className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
        Select a source file to preview it.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <p className="break-all font-mono text-sm font-semibold text-stone-950">{file.logicalPath}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["readable", "raw", "metadata"] as const).map((mode) => (
            <button
              key={mode}
              className={`rounded-full px-3 py-1 text-xs font-medium ${viewMode === mode ? "bg-stone-950 text-white" : "border border-stone-300 text-stone-800"}`}
              onClick={() => setViewMode(mode)}
              type="button"
            >
              {mode === "readable" ? "Readable" : mode === "raw" ? "Raw" : "Metadata"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {viewMode === "metadata" ? (
          <dl className="grid gap-3 text-sm">
            <div><dt className="font-medium text-stone-950">Likely source</dt><dd className="text-stone-700">{likelyPlatform(file.logicalPath)}</dd></div>
            <div><dt className="font-medium text-stone-950">Likely type</dt><dd className="text-stone-700">{likelyKind(file.logicalPath)}</dd></div>
            <div><dt className="font-medium text-stone-950">Size</dt><dd className="text-stone-700">{formatBytes(file.sizeBytes)}</dd></div>
            <div><dt className="font-medium text-stone-950">Checksum</dt><dd className="break-all text-stone-700">{file.checksumSha256}</dd></div>
          </dl>
        ) : (
          <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-stone-950 p-4 font-mono text-xs leading-6 text-stone-100">
            {isLoading ? "Loading source..." : fullText ?? file.previewText ?? file.previewError ?? "No text preview available."}
            {!fullText && file.previewTruncated ? "\n\n[preview truncated]" : ""}
          </pre>
        )}
      </div>
    </aside>
  );
}

function ImportedItemPreview({ item }: { item: VersionToolsProps["importedItems"][number] | null }) {
  if (!item) {
    return (
      <aside className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
        Select an imported item to preview it.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <p className="text-xs font-medium uppercase text-stone-500">
          {item.canonicalized ? "Canonicalized item" : "Parsed import"}
        </p>
        <h4 className="mt-2 text-xl font-semibold text-stone-950">{item.name}</h4>
        <p className="mt-1 text-sm text-stone-700">{item.kind} · Source: {item.sourcePlatform}</p>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm leading-6 text-stone-700">{item.description}</p>
        <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-stone-950 p-4 font-mono text-xs leading-6 text-stone-100">
          {item.body}
        </pre>
      </div>
    </aside>
  );
}
