import Link from "next/link";

import { completeOnboardingProfileAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

function normalizeSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeReturnPath(value: string | string[] | undefined) {
  const rawValue = normalizeSearchValue(value).trim();

  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/workspace";
  }

  try {
    const parsed = new URL(rawValue, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/workspace";
  }
}

function ProfileInput({
  label,
  name,
  value,
  autoComplete,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  value?: string | null;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
        {label}
        {required ? <span className="text-orange-300"> *</span> : null}
      </span>
      <input
        autoComplete={autoComplete}
        className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400"
        defaultValue={value ?? ""}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

export default async function OnboardingProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const context = await requireCurrentAppContextForPage();
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const returnTo = safeReturnPath(resolvedSearchParams.returnTo);
  const profile = context.user.profile;

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-start gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="sticky top-24 rounded-xl border border-zinc-800 bg-[#111414] p-6 shadow-2xl shadow-black/40">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            DryLake account setup
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold leading-tight text-zinc-50">
            Tell us who is joining.
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            This is separate from Cognito authentication. DryLake stores these details in the app database so admins can see
            real user records, contact details, and Free/Paid intent.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-zinc-300">
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Name and contact details</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Company or team name</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Free or Paid intent</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Visible in internal admin users</span>
          </div>
        </aside>

        <section className="rounded-xl border border-zinc-800 bg-[#111414] p-6 shadow-2xl shadow-black/40 md:p-8">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Profile
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              Complete your DryLake profile.
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Start Free if you only want local Agent Control and Guard. Choose Paid if you want Fix with AI,
              Deep Cloud Analysis, saved reports, and Local Watchdog.
            </p>
          </div>

          <form action={completeOnboardingProfileAction} className="mt-7 grid gap-5">
            <input name="returnTo" type="hidden" value={returnTo} />

            <div className="grid gap-4 md:grid-cols-2">
              <ProfileInput
                autoComplete="name"
                label="Full name"
                name="displayName"
                placeholder="Jane Developer"
                required
                value={profile?.displayName ?? ""}
              />
              <ProfileInput
                autoComplete="organization"
                label="Company or team"
                name="organizationName"
                placeholder="Acme AI Engineering"
                value={context.organization.name}
              />
              <ProfileInput
                autoComplete="tel"
                label="Phone number"
                name="phoneNumber"
                placeholder="+1 555 0100"
                required
                value={profile?.phoneNumber}
              />
              <ProfileInput
                autoComplete="country-name"
                label="Country"
                name="country"
                placeholder="United States"
                required
                value={profile?.country}
              />
              <ProfileInput
                autoComplete="address-line1"
                label="Address line 1"
                name="addressLine1"
                placeholder="123 Market Street"
                required
                value={profile?.addressLine1}
              />
              <ProfileInput
                autoComplete="address-line2"
                label="Address line 2"
                name="addressLine2"
                placeholder="Suite, floor, building"
                value={profile?.addressLine2}
              />
              <ProfileInput
                autoComplete="address-level2"
                label="City"
                name="city"
                placeholder="San Francisco"
                value={profile?.city}
              />
              <ProfileInput
                autoComplete="address-level1"
                label="State / region"
                name="region"
                placeholder="CA"
                value={profile?.region}
              />
              <ProfileInput
                autoComplete="postal-code"
                label="Postal code"
                name="postalCode"
                placeholder="94105"
                value={profile?.postalCode}
              />
              <ProfileInput
                autoComplete="off"
                label="Timezone"
                name="timezone"
                placeholder="America/Los_Angeles"
                value={profile?.timezone ?? "UTC"}
              />
            </div>

            <fieldset className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <legend className="px-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Plan intent
              </legend>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="cursor-pointer rounded border border-zinc-800 bg-[#111414] p-4 transition hover:border-emerald-400">
                  <input className="mr-3" defaultChecked={profile?.signupPlanIntent !== "paid"} name="planIntent" type="radio" value="free" />
                  <span className="font-semibold text-zinc-100">Start Free</span>
                  <span className="mt-2 block text-sm leading-6 text-zinc-400">
                    Use Agent Control and local Guard without a subscription.
                  </span>
                </label>
                <label className="cursor-pointer rounded border border-emerald-400/60 bg-emerald-400/10 p-4 transition hover:border-emerald-300">
                  <input className="mr-3" defaultChecked={profile?.signupPlanIntent === "paid"} name="planIntent" type="radio" value="paid" />
                  <span className="font-semibold text-zinc-100">I want Paid</span>
                  <span className="mt-2 block text-sm leading-6 text-zinc-400">
                    Continue to billing for Fix with AI, cloud analysis, saved reports, and Watchdog.
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" type="submit">
                Continue
              </button>
              <Link className="rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href="/account">
                Manage later in Account
              </Link>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
