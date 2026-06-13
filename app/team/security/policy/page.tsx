import { updateTeamPolicyAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { getOrCreateTeamPolicy } from "@/lib/services/team-security";
import { CapabilityRow, TeamPageShell } from "@/app/team/_components/team-page";

function listText(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

export default async function TeamPolicyPage() {
  const context = await requireCurrentAppContextForPage();
  const [{ resolved }, policy] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    getOrCreateTeamPolicy(context.organization.id),
  ]);

  return (
    <TeamPageShell title="Team policy" subtitle="Policy controls gate team-approved MCP and extension allowlists/denylists.">
      <section className="tape-panel p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <CapabilityRow enabled={resolved.canManageTeamPolicy} label="MCP allowlist / denylist" />
          <CapabilityRow enabled={resolved.canManageTeamPolicy} label="Extension allowlist / denylist" />
          <CapabilityRow enabled={resolved.canUseContinuousWatch} label="Policy violation history" />
          <CapabilityRow enabled={resolved.canUseTeamBaseline} label="Baseline drift rules" />
        </div>
      </section>
      {resolved.canManageTeamPolicy ? (
        <form action={updateTeamPolicyAction} className="tape-panel grid gap-5 p-6">
          <input name="organizationId" type="hidden" value={context.organization.id} />
          <label className="grid gap-2 text-sm text-zinc-300">
            MCP allowlist
            <textarea className="min-h-28 rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100" name="mcpAllowlist" defaultValue={listText(policy.mcpAllowlistJson)} />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            MCP denylist
            <textarea className="min-h-28 rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100" name="mcpDenylist" defaultValue={listText(policy.mcpDenylistJson)} />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Extension allowlist
            <textarea className="min-h-28 rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100" name="extensionAllowlist" defaultValue={listText(policy.extensionAllowlistJson)} />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Extension denylist
            <textarea className="min-h-28 rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100" name="extensionDenylist" defaultValue={listText(policy.extensionDenylistJson)} />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Retention days
            <input className="rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-100" name="retentionDays" type="number" min="7" max="3650" defaultValue={policy.retentionDays} />
          </label>
          <button className="tape-button w-fit bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
            Save policy
          </button>
        </form>
      ) : null}
    </TeamPageShell>
  );
}
