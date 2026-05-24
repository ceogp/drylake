import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { setActiveOrganizationAction } from "@/app/actions";
import { clerkTapeAppearance } from "@/components/drylake-auth-shell";
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

export const metadata: Metadata = {
  title: {
    default: "DryLake",
    template: "%s | DryLake",
  },
  description: "DryLake is a visual kanban and pipeline planner for assigning coding phases to AI coding agents.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
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
  const useClerkUi = !adminInternalHostRequest && authSetup.mode === "clerk" && authSetup.configured;
  const appContext = marketingHostRequest || adminInternalHostRequest
    ? null
    : await getCurrentAppContext({ allowDevFallback });
  const dryLakeOrigin = getConfiguredAppOrigin();

  const shell = marketingHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <a className="flex items-center gap-3" href={xupraHomepage}>
            <Image
              alt="DryLake logo"
              className="h-10 w-10 rounded border border-zinc-700 bg-zinc-950 object-contain p-1"
              height={44}
              src="/blackwhite.webp"
              width={44}
            />
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-100">
                DryLake
              </div>
              <div className="hidden text-xs text-zinc-500 sm:block">
                Save tokens and time using AI Agents.
              </div>
            </div>
          </a>
          <nav className="hidden items-center gap-3 text-sm font-semibold text-zinc-300 md:flex">
            <Link className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 transition hover:border-orange-400 hover:text-orange-200" href="/about">
              About
            </Link>
            <a className="rounded border border-emerald-400 bg-emerald-400 px-3 py-2 text-zinc-950 transition hover:bg-emerald-300" href={dryLakeOrigin}>
              DryLake
            </a>
            <a className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 transition hover:border-orange-400 hover:text-orange-200" href={`${dryLakeOrigin}/pricing`}>
              Pricing
            </a>
          </nav>
        </div>
      </div>
      {children}
    </>
  ) : adminInternalHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-[#090a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link className="flex items-center gap-3" href="/admin">
            <Image
              alt="DryLake logo"
              className="h-10 w-10 rounded border border-zinc-700 bg-zinc-950 object-contain p-1"
              height={44}
              src="/blackwhite.webp"
              width={44}
            />
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
            <a className="flex items-center gap-3" href={xupraHomepage}>
              <Image
                alt="DryLake logo"
                className="h-10 w-10 rounded border border-zinc-700 bg-zinc-950 object-contain p-1"
                height={44}
                src="/blackwhite.webp"
                width={44}
              />
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-100">
                  DryLake
                </div>
                <div className="hidden text-xs text-zinc-500 lg:block">
                  Save tokens and time using AI Agents.
                </div>
              </div>
            </a>
            <nav className="hidden items-center gap-3 text-sm font-semibold text-zinc-300 md:flex">
              <Link className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 transition hover:border-orange-400 hover:text-orange-200" href="/upload">
                Import
              </Link>
              <Link className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 transition hover:border-orange-400 hover:text-orange-200" href="/settings">
                Settings
              </Link>
              <Link className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 transition hover:border-orange-400 hover:text-orange-200" href="/billing">
                Billing
              </Link>
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
                redirectTo="/upload"
              />
            ) : null}
            {useClerkUi ? (
              <HeaderAuthControls />
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
      <body className="min-h-full flex flex-col">
        {useClerkUi ? <ClerkProvider appearance={clerkTapeAppearance}>{shell}</ClerkProvider> : shell}
      </body>
    </html>
  );
}
