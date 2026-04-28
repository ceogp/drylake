"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Switching..." : "Switch"}
    </button>
  );
}

type OrganizationSwitcherProps = {
  action: (formData: FormData) => Promise<void>;
  organizations: Array<{
    id: string;
    name: string;
  }>;
  activeOrganizationId: string;
  redirectTo?: string;
};

export function OrganizationSwitcher(props: OrganizationSwitcherProps) {
  if (props.organizations.length <= 1) {
    return null;
  }

  return (
    <form action={props.action} className="flex items-center gap-2">
      <input name="redirectTo" type="hidden" value={props.redirectTo ?? "/app"} />
      <label className="sr-only" htmlFor="active-organization">
        Active organization
      </label>
      <select
        className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800"
        defaultValue={props.activeOrganizationId}
        id="active-organization"
        name="organizationId"
      >
        {props.organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      <SubmitButton />
    </form>
  );
}
