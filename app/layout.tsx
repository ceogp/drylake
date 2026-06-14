import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { setActiveOrganizationAction } from "@/app/actions";
import { DryLakeLogo } from "@/components/drylake-logo";
import { HeaderAuthControls } from "@/components/header-auth-controls";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
  getConfiguredAppOrigin,
  isConfiguredAdminInternalHost,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import "./globals.css";

const headingFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const xupraHomepage = "https://xupracorp.com";
const discordHref = "https://discord.gg/WQdapuVn";
const iconVersion = "20260601";

export const metadata: Metadata = {
  title: {
    default: "DryLake",
    template: "%s | DryLake",
  },
  description: "DryLake has Agent Control and Security in one product.",
  icons: {
    icon: [
      { url: `/favicon.ico?v=${iconVersion}`, sizes: "any" },
      { url: `/icon.svg?v=${iconVersion}`, type: "image/svg+xml" },
    ],
    shortcut: `/favicon.ico?v=${iconVersion}`,
    apple: `/apple-touch-icon.png?v=${iconVersion}`,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const requestHost = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
  const marketingHostRequest = isConfiguredMarketingHost(requestHost);
  const adminInternalHostRequest = isConfiguredAdminInternalHost(requestHost);
  const authSetup = getAuthSetup();
  const allowDevFallback = authSetup.mode === "dev";
  const appContext = marketingHostRequest || adminInternalHostRequest
    ? null
    : await getCurrentAppContext({ allowDevFallback });
  const dryLakeOrigin = getConfiguredAppOrigin();

  const shell = marketingHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <a className="flex items-center gap-4" href={xupraHomepage}>
            <div className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-zinc-50">
              Xupra
            </div>
            <div className="min-w-0">
              <div className="hidden text-xs text-zinc-500 sm:block">
                Company overview and product portfolio.
              </div>
            </div>
          </a>
          <a
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            href={dryLakeOrigin}
          >
            Open DryLake
          </a>
        </div>
      </div>
      {children}
    </>
  ) : adminInternalHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link className="flex items-center gap-4" href="/admin">
            <DryLakeLogo className="h-11 w-auto" priority />
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-100">
                Xupra Internal Admin
              </div>
              <div className="hidden text-xs text-zinc-500 sm:block">
                DryLake control plane
              </div>
            </div>
          </Link>
          <a
            className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            href={dryLakeOrigin}
          >
            Open Customer App
          </a>
        </div>
      </div>
      {children}
    </>
  ) : (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <a className="flex items-center gap-4" href={dryLakeOrigin}>
              <DryLakeLogo className="h-11 w-auto" priority />
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  DryLake
                </div>
                <div className="hidden text-xs text-zinc-500 lg:block">
                  Agent Control + Guard
                </div>
              </div>
            </a>
            <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-400 md:flex">
              <Link className="transition hover:text-zinc-100" href="/guard">
                Guard
              </Link>
              <Link className="transition hover:text-zinc-100" href="/extensions/install">
                Install
              </Link>
              {appContext ? (
                <>
                  <Link className="transition hover:text-zinc-100" href="/workspace">
                    Agent Control
                  </Link>
                </>
              ) : (
                <Link className="transition hover:text-zinc-100" href="/pricing">
                  Pricing
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {appContext ? (
              <OrganizationSwitcher
                action={setActiveOrganizationAction}
                activeOrganizationId={appContext.organization.id}
                organizations={appContext.memberships.map((membership) => ({
                  id: membership.organizationId,
                  name: membership.organization.name,
                }))}
                redirectTo="/skills"
              />
            ) : null}
            {authSetup.mode === "cognito" ? (
              <HeaderAuthControls
                configured={authSetup.configured}
                signedIn={Boolean(appContext)}
                accountLabel={appContext?.user.profile?.displayName ?? appContext?.user.email}
                logoutHref="/api/auth/cognito/logout?returnTo=/"
              />
            ) : (
              <div className="rounded border border-orange-400/40 bg-orange-400/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
                Dev Auth
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </>
  );

  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{shell}</body>
    </html>
  );
}
