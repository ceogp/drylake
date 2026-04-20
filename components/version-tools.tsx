"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function VersionTools({ versionId, deploymentTargets }: VersionToolsProps) {
  const router = useRouter();
  const [targetPlatform, setTargetPlatform] = useState<(typeof TARGETS)[number]["value"]>("claude_code");
  const [deploymentTargetId, setDeploymentTargetId] = useState<string>(deploymentTargets[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState("No job has been run yet.");
  const [latestPreview, setLatestPreview] = useState<Array<{ logicalPath: string; preview: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);

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
        setStatusMessage(
          `Compatibility: ${payload.result.status}${
            payload.result.warnings?.length ? ` | warnings: ${payload.result.warnings.join("; ")}` : ""
          }`,
        );
      } else if (payload.imported) {
        setStatusMessage(
          `Imported ${payload.imported.rawFiles} files, ${payload.imported.subagents} subagents, ${payload.imported.skills} skills, ${payload.imported.rules} rules.`,
        );
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

      setStatusMessage(`Uploaded ${payload.files?.length ?? 0} file(s).`);
      form.reset();
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
          Compatibility Check
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
        Upload, import, and compatibility checks stay available on free. Export preview and deploy
        unlock on paid plans.
      </div>

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
