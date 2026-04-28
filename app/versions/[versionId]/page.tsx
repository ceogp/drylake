import Link from "next/link";
import { notFound } from "next/navigation";

import { VersionTools } from "@/components/version-tools";
import { requireVersionAccess } from "@/lib/services/access";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    versionId: string;
  }>;
};

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

type ImportedItemKind = "agent" | "skill" | "rule" | "instruction" | "prompt_fragment";

function readImportedKind(value: string): ImportedItemKind {
  if (value === "skill" || value === "rule" || value === "prompt_fragment") {
    return value;
  }

  return "instruction";
}

function sanitizeTechnicalDetails(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeTechnicalDetails(item, depth + 1));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === "storageKey") {
      continue;
    }

    result[key] = sanitizeTechnicalDetails(item, depth + 1);
  }

  return result;
}

export default async function VersionPage({ params }: PageProps) {
  const { versionId } = await params;
  const access = await requireVersionAccess(versionId).catch(() => null);

  if (!access) {
    notFound();
  }

  const version = await prisma.packageVersion.findUnique({
    where: { id: access.version.id },
    include: {
      files: {
        orderBy: { createdAt: "desc" },
      },
      subagents: {
        orderBy: { sortOrder: "asc" },
      },
      skillRules: {
        orderBy: { createdAt: "asc" },
      },
      transformJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      agentPackage: {
        include: {
          project: {
            include: {
              deploymentTargets: {
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
              },
            },
          },
        },
      },
      deploymentJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          deploymentTarget: true,
        },
      },
    },
  });

  if (!version) {
    notFound();
  }

  const manifest = (version.manifestJson as Record<string, unknown>) ?? {};
  const signedInLabel = access.context.user.profile?.displayName ?? access.context.user.email;
  const { entitlements } = await getEntitlementsForOrganization(access.context.organization.id);
  const importedItems = [
    ...version.subagents.map((subagent) => {
      const metadata = readRecord(subagent.metadataJson);

      return {
        id: subagent.id,
        name: subagent.name,
        kind: "agent" as const,
        sourcePath: readNullableString(metadata.sourcePath),
        sourcePlatform: readString(metadata.sourcePlatform, "unknown"),
        description: subagent.description,
        body: subagent.instructionsMd,
      };
    }),
    ...version.skillRules.map((rule) => {
      const metadata = readRecord(rule.metadataJson);

      return {
        id: rule.id,
        name: rule.name,
        kind: readImportedKind(rule.kind),
        sourcePath: readNullableString(metadata.sourcePath),
        sourcePlatform: readString(metadata.sourcePlatform, "unknown"),
        description: readString(metadata.description, `${rule.name} imported item`),
        body: rule.bodyMd,
      };
    }),
  ];
  const historyEvents = [
    ...version.transformJobs.map((job) => ({
      id: job.id,
      label:
        job.jobType === "import_parse"
          ? "Imported source files"
          : job.jobType === "export_build"
            ? "Generated target files"
            : job.jobType === "normalize"
              ? "Canonicalized with AI"
              : "Processed library event",
      detail: job.targetPlatform ? `${job.jobType} for ${job.targetPlatform}` : job.jobType,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      technicalDetails: sanitizeTechnicalDetails(job.resultJson ?? job.errorJson ?? {}),
    })),
    ...version.deploymentJobs.map((job) => ({
      id: job.id,
      label: "Uploaded target files",
      detail: `${job.deploymentTarget.name} · ${job.status}`,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      technicalDetails: sanitizeTechnicalDetails(job.outputJson ?? job.errorJson ?? {}),
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.22em] text-orange-700">
            <Link href="/app">App</Link>
            <span>/</span>
            <Link href={`/projects/${version.agentPackage.projectId}`}>{version.agentPackage.project.name}</Link>
            <span>/</span>
            <Link href={`/packages/${version.agentPackageId}`}>{version.agentPackage.name}</Link>
            <span>/</span>
            <span>Version {version.versionNumber}</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
                Skills & Agents
              </h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-stone-700">
                Upload, view, and organize your AI coding agents and skills.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-[1.5rem] border border-stone-200 bg-white px-5 py-4 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Signed in</p>
                <p className="mt-2 text-sm text-stone-700">
                  {signedInLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-6">
          <VersionTools
            canUseAiFeatures={Boolean(entitlements.manual_export)}
            currentSummary={{
              rawFiles: version.files.filter((file) => file.kind === "raw_source").length,
              importedItems: importedItems.length,
              targetFiles: version.files.filter((file) => file.kind === "generated_export").length,
              lastImportAt:
                typeof manifest.lastImportedAt === "string"
                  ? manifest.lastImportedAt
                  : typeof manifest.lastUploadedAt === "string"
                    ? manifest.lastUploadedAt
                    : null,
            }}
            historyEvents={historyEvents}
            importedItems={importedItems}
            versionId={version.id}
          />
        </section>
      </div>
    </main>
  );
}
