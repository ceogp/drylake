import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { setActiveOrganizationAction } from "@/app/actions";
import { HeaderAuthControls } from "@/components/header-auth-controls";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
  getConfiguredAdminInternalOrigin,
  getConfiguredAppOrigin,
  getConfiguredMarketingOrigin,
  isConfiguredAdminInternalHost,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";
import { getIsPlatformAdmin } from "@/lib/services/access";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Xupra DryLake",
  description: "Agent transfer and deployment control plane",
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
  const isPlatformAdmin = marketingHostRequest || adminInternalHostRequest
    ? false
    : await getIsPlatformAdmin({ allowDevFallback });
  const marketingOrigin = getConfiguredMarketingOrigin();
  const dryLakeOrigin = getConfiguredAppOrigin();
  const adminInternalOrigin = getConfiguredAdminInternalOrigin();

  const shell = marketingHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
          <Link className="flex items-center gap-3" href={marketingOrigin}>
            <Image
              alt="Xupra logo"
              className="h-11 w-11 rounded-2xl shadow-[0_12px_32px_rgba(249,115,22,0.18)]"
              height={44}
              src="/xupra-logo.svg"
              width={44}
            />
            <div className="rounded-full border border-stone-300/70 bg-stone-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-stone-900">
              Xupra
            </div>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-stone-600 md:flex">
            <a className="transition hover:text-stone-950" href={dryLakeOrigin}>
              DryLake
            </a>
            <a className="transition hover:text-stone-950" href={`${dryLakeOrigin}/extensions/install`}>
              Install
            </a>
            <a className="transition hover:text-stone-950" href={`${dryLakeOrigin}/billing`}>
              Pricing
            </a>
          </nav>
        </div>
      </div>
      {children}
    </>
  ) : adminInternalHostRequest ? (
    <>
      <div className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
          <Link className="flex items-center gap-3" href="/admin">
            <Image
              alt="Xupra logo"
              className="h-11 w-11 rounded-2xl shadow-[0_12px_32px_rgba(249,115,22,0.18)]"
              height={44}
              src="/xupra-logo.svg"
              width={44}
            />
            <div className="rounded-full border border-stone-300/70 bg-stone-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-stone-900">
              Xupra Internal Admin
            </div>
          </Link>
          <a
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
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
      <div className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div className="flex items-center gap-4">
            <Link className="flex items-center gap-3" href="/">
              <Image
                alt="Xupra logo"
                className="h-11 w-11 rounded-2xl shadow-[0_12px_32px_rgba(249,115,22,0.18)]"
                height={44}
                src="/xupra-logo.svg"
                width={44}
              />
              <div className="rounded-full border border-orange-300/70 bg-orange-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-orange-900">
                Xupra DryLake
              </div>
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-stone-600 md:flex">
              <Link className="transition hover:text-stone-950" href="/get-started">
                Get Started
              </Link>
              <Link className="transition hover:text-stone-950" href="/extensions">
                Extension
              </Link>
              <Link className="transition hover:text-stone-950" href="/workspace">
                Upload
              </Link>
              <Link className="transition hover:text-stone-950" href="/settings">
                Settings
              </Link>
              <Link className="transition hover:text-stone-950" href="/billing">
                Billing
              </Link>
              {isPlatformAdmin && adminInternalOrigin ? (
                <a className="transition hover:text-stone-950" href={`${adminInternalOrigin}/admin`}>
                  Internal Admin
                </a>
              ) : null}
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
                redirectTo="/app"
              />
            ) : null}
            {useClerkUi ? (
              <HeaderAuthControls />
            ) : (
              <div className="rounded-full border border-stone-300 bg-white px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-600">
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
        {useClerkUi ? <ClerkProvider>{shell}</ClerkProvider> : shell}
      </body>
    </html>
  );
}
