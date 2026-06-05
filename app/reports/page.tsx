import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getExtensionUsageSummary } from "@/lib/services/extension-usage-events";
import { getAuditEvents, getDeploymentSummary, getUsageSummary } from "@/lib/services/reports";

function usageEventLabel(eventName: string) {
  const labels: Record<string, string> = {
    phase_agent_selected: "Agent selected",
    phase_skill_selected: "Skill selected",
    phase_handoff_exported: "Prompt exported",
    phase_handoff_launched: "Handoff launched",
    phase_handoff_launch_failed: "Launch failed",
    planning_prompt_submitted: "Planning prompt submitted",
    planning_chat_message: "Planning chat message",
    phase_marked_complete: "Phase marked complete",
    phase_autopilot_started_next: "Autopilot started next phase",
    agent_setup_checked: "Agent setup checked",
  };

  return labels[eventName] ?? eventName.replace(/_/g, " ");
}

export default async function ReportsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  if (!organizationId) {
    return null;
  }

  const [usage, extensionUsage, deployments, auditEvents] = await Promise.all([
    getUsageSummary(organizationId),
    getExtensionUsageSummary(organizationId),
    getDeploymentSummary(organizationId),
    getAuditEvents(organizationId),
  ]);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="tape-eyebrow">Reports</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-stone-950">
            Usage, handoff health, and audit history.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            The extension is where users do the work. Reports show signed-in usage metadata for agent selections, skill selections, prompt exports, terminal launches, token estimates, and deployment activity.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            ["Projects", String(usage.projects)],
            ["Packages", String(usage.packages)],
            ["Deployments", String(usage.deploymentJobs)],
            ["Usage Events", String(usage.extensionUsageEvents)],
            ["Prompted Events", String(extensionUsage.promptedEvents)],
            ["Captured Prompts", String(extensionUsage.capturedPromptEvents)],
            ["Planning Prompts", String(extensionUsage.planningPrompts)],
            ["Handoffs", String(extensionUsage.handoffLaunches)],
            ["Launch Failures", String(extensionUsage.handoffLaunchFailures)],
            ["Prompt Exports", String(extensionUsage.promptExports)],
            ["Avg Prompt Tokens", String(extensionUsage.averagePromptEstimatedTokens)],
            ["Credentials", String(usage.credentials)],
            ["Integrations", String(usage.integrations)],
            ["Success Rate", `${Math.round(deployments.successRate * 100)}%`],
          ].map(([label, value]) => (
            <article key={label} className="tape-panel p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  Last {extensionUsage.sinceDays} days
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  Agents used
                </h2>
              </div>
              <span className="rounded-full border border-amber-400/50 bg-amber-300 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-950">
                {extensionUsage.agentSelections} selections
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {extensionUsage.topAgents.length > 0 ? extensionUsage.topAgents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <span>{agent.name}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{agent.count}</span>
                </div>
              )) : (
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-400">
                  No signed-in agent usage has been recorded yet.
                </p>
              )}
            </div>
          </article>

          <article className="tape-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  Last {extensionUsage.sinceDays} days
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  Skills used
                </h2>
              </div>
              <span className="rounded-full border border-amber-400/50 bg-amber-300 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-950">
                {extensionUsage.skillSelections} selections
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {extensionUsage.topSkills.length > 0 ? extensionUsage.topSkills.map((skill) => (
                <div key={skill.name} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <span className="min-w-0 truncate">{skill.name}</span>
                  <span className="shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{skill.count}</span>
                </div>
              )) : (
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-400">
                  No signed-in skill usage has been recorded yet.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Recent deployments
            </h2>
            <div className="mt-5 grid gap-3">
              {deployments.jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{job.packageVersion.agentPackage.name}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="tape-panel p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Extension activity
            </h2>
            <div className="mt-5 grid gap-3">
              {extensionUsage.recentEvents.length > 0 ? extensionUsage.recentEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{usageEventLabel(event.eventName)}</span>
                    <span className="font-mono text-xs text-stone-500">{event.createdAt.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 truncate text-xs text-zinc-500">
                    {[event.phaseTitle, event.agentId, event.skillLogicalPath].filter(Boolean).join(" / ") || "Workspace event"}
                  </p>
                  {event.promptPreview ? (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded border border-zinc-800 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
                      {event.promptPreview}
                    </p>
                  ) : null}
                </div>
              )) : (
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-400">
                  No signed-in extension events have been recorded yet.
                </p>
              )}
            </div>
          </article>

          <article className="tape-panel p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Audit trail
            </h2>
            <div className="mt-5 grid gap-3">
              {auditEvents.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{event.action}</span>
                    <span className="font-mono text-xs text-stone-500">{event.createdAt.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
