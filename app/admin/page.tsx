import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/services/access";
import { getSetupStatus } from "@/lib/services/setup";

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-stone-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{detail}</p>
    </article>
  );
}

export default async function AdminPage() {
  const adminContext = await requirePlatformAdmin();
  const setup = await getSetupStatus();

  const [users, organizations, projectCount, packageCount, versionCount, credentialCount, transformJobs, deploymentJobs] =
    await Promise.all([
      prisma.user.findMany({
        include: {
          profile: true,
          memberships: {
            include: {
              organization: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.organization.findMany({
        include: {
          memberships: true,
          projects: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.project.count(),
      prisma.agentPackage.count(),
      prisma.packageVersion.count(),
      prisma.credential.count(),
      prisma.transformJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          organization: true,
          createdByUser: true,
        },
      }),
      prisma.deploymentJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          organization: true,
          deploymentTarget: true,
          createdByUser: true,
        },
      }),
    ]);

  const activeUsers = users.filter((user) => user.status === "active").length;
  const queuedTransforms = transformJobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const failedDeployments = deploymentJobs.filter((job) => job.status === "failed").length;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#1c1917_0%,_#292524_28%,_#fafaf9_28%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-300">Platform Admin</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em]">
              Xupra control surface for users, orgs, jobs, and system health.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-200">
              This is the platform-wide admin surface. It is intentionally separate from tenant-scoped product pages and is meant for your operator account only.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-full border border-stone-600 bg-stone-900/60 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800" href="/settings">
              User Settings
            </Link>
            <Link className="rounded-full border border-stone-600 bg-stone-900/60 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800" href="/app">
              App
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Users" value={String(users.length)} detail={`${activeUsers} active accounts`} />
          <MetricCard label="Organizations" value={String(organizations.length)} detail="Latest organizations in the system" />
          <MetricCard label="Projects / Packages" value={`${projectCount} / ${packageCount}`} detail={`${versionCount} package versions stored`} />
          <MetricCard label="Jobs" value={`${queuedTransforms} / ${failedDeployments}`} detail="Queued transform jobs / failed deployment jobs" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Users</p>
                <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                  Recent accounts
                </h2>
              </div>
              <p className="rounded-full bg-stone-100 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-stone-600">
                admin: {adminContext.user.email}
              </p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-stone-700">
                <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  <tr>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Auth</th>
                    <th className="px-3 py-3">Memberships</th>
                    <th className="px-3 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-stone-100 align-top">
                      <td className="px-3 py-4">
                        <div className="font-medium text-stone-950">
                          {user.profile?.displayName ?? user.email}
                        </div>
                        <div className="text-xs text-stone-500">{user.email}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div>{user.authProvider}</div>
                        <div className="text-xs text-stone-500">{user.status}</div>
                      </td>
                      <td className="px-3 py-4">
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-stone-500">No orgs</span>
                        ) : (
                          user.memberships.map((membership) => (
                            <div key={membership.id} className="text-xs leading-6">
                              {membership.organization.name} · {membership.role}
                            </div>
                          ))
                        )}
                      </td>
                      <td className="px-3 py-4 text-xs text-stone-500">
                        {user.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">System Setup</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Runtime readiness
            </h2>
            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Authentication</p>
                <p className="mt-2">Mode: {setup.auth.mode}</p>
                <p>Provider: {setup.auth.provider}</p>
                <p>Configured: {setup.auth.configured ? "yes" : "no"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Storage / AI</p>
                <p className="mt-2">Artifact driver: {setup.storage.driver}</p>
                <p>OpenAI model: {setup.openai.model}</p>
                <p>OpenAI ready: {setup.openai.configured ? "yes" : "no"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Commercial</p>
                <p className="mt-2">Stripe configured: {setup.billing.configured ? "yes" : "no"}</p>
                <p>Credentials stored: {credentialCount}</p>
                <p>Extension path: {setup.extension.packagePath}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Organizations</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Latest orgs
            </h2>
            <div className="mt-6 space-y-3">
              {organizations.map((organization) => (
                <div key={organization.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-stone-950">{organization.name}</div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {organization.tier} · {organization.status}
                    </div>
                  </div>
                  <p>Members: {organization.memberships.length}</p>
                  <p>Projects: {organization.projects.length}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Recent Jobs</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Transforms and deployments
            </h2>
            <div className="mt-6 space-y-3">
              {transformJobs.map((job) => (
                <div key={job.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-stone-950">
                      Transform · {job.jobType}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {job.status}
                    </div>
                  </div>
                  <p>Org: {job.organization.name}</p>
                  <p>User: {job.createdByUser.email}</p>
                  <p>Target: {job.targetPlatform ?? "n/a"}</p>
                </div>
              ))}
              {deploymentJobs.map((job) => (
                <div key={job.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-stone-950">
                      Deployment · {job.deploymentTarget.name}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {job.status}
                    </div>
                  </div>
                  <p>Org: {job.organization.name}</p>
                  <p>User: {job.createdByUser.email}</p>
                  <p>Platform: {job.deploymentTarget.platform}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
