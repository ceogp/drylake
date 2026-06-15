import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { setActiveOrganizationAction } from "@/app/actions";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { XupraGlobalHeader } from "@/components/xupra-global-header";
import {
  XUPRA_PUBLIC_SECTION_HEADER,
  XUPRA_PUBLIC_SECTION_KYA_VALUE,
  XUPRA_PUBLIC_SECTION_PRODUCTS_VALUE,
} from "@/KYAregistry/routing";
import {
  getConfiguredAppOrigin,
  getConfiguredMarketingOrigin,
  isConfiguredMarketingHost,
  isConfiguredOperatorPortalHost,
  normalizeHost,
} from "@/lib/site-hosts";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import "./globals.css";

const headingFont = Inter({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

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
  const operatorPortalHostRequest = isConfiguredOperatorPortalHost(requestHost);
  const xupraPublicSection = requestHeaders.get(XUPRA_PUBLIC_SECTION_HEADER);
  const kyaRegistryRequest = xupraPublicSection === XUPRA_PUBLIC_SECTION_KYA_VALUE;
  const xupraProductsRequest = xupraPublicSection === XUPRA_PUBLIC_SECTION_PRODUCTS_VALUE;
  const xupraPublicRequest = marketingHostRequest || kyaRegistryRequest || xupraProductsRequest;
  const authSetup = getAuthSetup();
  const allowDevFallback = authSetup.mode === "dev";
  const appContext = xupraPublicRequest || operatorPortalHostRequest
    ? null
    : await getCurrentAppContext({ allowDevFallback });
  const dryLakeOrigin = getConfiguredAppOrigin();
  const xupraHomepage = getConfiguredMarketingOrigin();

  const shell = (
    <>
      <XupraGlobalHeader
        accountLabel={appContext?.user.profile?.displayName ?? appContext?.user.email}
        appOrigin={dryLakeOrigin}
        authConfigured={authSetup.mode === "cognito" ? authSetup.configured : true}
        logoutHref="/api/auth/cognito/logout?returnTo=/"
        marketingOrigin={xupraHomepage}
        organizationSwitcher={appContext ? (
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
        portalLabel={operatorPortalHostRequest ? "Operator Portal" : undefined}
        signedIn={Boolean(appContext)}
      />
      {children}
    </>
  );

  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="xupra-light-site min-h-full flex flex-col">{shell}</body>
    </html>
  );
}
