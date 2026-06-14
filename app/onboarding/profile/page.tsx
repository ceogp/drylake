import { completeOnboardingProfileAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

function normalizeSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeReturnPath(value: string | string[] | undefined) {
  const rawValue = normalizeSearchValue(value).trim();

  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/skills";
  }

  try {
    const parsed = new URL(rawValue, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/skills";
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
            Complete your DryLake profile.
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            First create the account, then choose whether to continue free or upgrade to paid. This step just collects
            the profile details DryLake needs before opening the app or checkout.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-zinc-300">
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Full name and country</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Optional company and contact details</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Next: choose Free or Paid</span>
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
              DryLake collects the same profile basics first. After this step, you will choose whether to continue free
              or go to paid checkout.
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

            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" type="submit">
                Continue
              </button>
              <p className="text-sm leading-7 text-zinc-400">
                Profile setup is required before DryLake opens the next step.
              </p>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
