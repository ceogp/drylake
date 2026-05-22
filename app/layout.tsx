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
  getConfiguredMarketingOrigin,
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
  const marketingOrigin = getConfiguredMarketingOrigin();
  const dryLakeOrigin = getConfiguredAppOrigin();

  const shell = marketingHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b-[4px] border-black bg-[#f7f4ea]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link className="flex items-center gap-3" href={marketingOrigin}>
            <Image
              alt="DryLake logo"
              className="h-11 w-11 rounded-[4px] border-[3px] border-black bg-white"
              height={44}
              src="/drylake-logo.svg"
              width={44}
            />
            <div className="rounded-[4px] border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-black">
              DryLake
            </div>
          </Link>
          <nav className="hidden items-center gap-3 text-sm font-black uppercase text-black md:flex">
            <Link className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href="/about">
              About
            </Link>
            <a className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href={dryLakeOrigin}>
              DryLake
            </a>
            <a className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href={`${dryLakeOrigin}/billing`}>
              Pricing
            </a>
          </nav>
        </div>
      </div>
      {children}
    </>
  ) : adminInternalHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b-[4px] border-black bg-[#f7f4ea]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link className="flex items-center gap-3" href="/admin">
            <Image
              alt="DryLake logo"
              className="h-11 w-11 rounded-[4px] border-[3px] border-black bg-white"
              height={44}
              src="/drylake-logo.svg"
              width={44}
            />
            <div className="rounded-[4px] border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-black">
              Xupra Internal Admin
            </div>
          </Link>
          <a
            className="rounded-[4px] border-[3px] border-black bg-white px-5 py-3 text-sm font-black uppercase text-black transition hover:bg-[#ffd60a]"
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
      <div className="sticky top-0 z-50 border-b-[4px] border-black bg-[#f7f4ea]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <Link className="flex items-center gap-3" href="/">
              <Image
                alt="DryLake logo"
                className="h-11 w-11 rounded-[4px] border-[3px] border-black bg-white"
                height={44}
                src="/drylake-logo.svg"
                width={44}
              />
              <div className="rounded-[4px] border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-black">
                DryLake
              </div>
            </Link>
            <nav className="hidden items-center gap-3 text-sm font-black uppercase text-black md:flex">
              <Link className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href="/upload">
                Import
              </Link>
              <Link className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href="/settings">
                Settings
              </Link>
              <Link className="border-[3px] border-black bg-white px-3 py-2 transition hover:bg-[#ffd60a]" href="/billing">
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
              <div className="rounded-[4px] border-[3px] border-black bg-white px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-black">
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
